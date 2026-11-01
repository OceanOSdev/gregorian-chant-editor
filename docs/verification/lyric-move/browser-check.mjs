import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const screenshotDirectory = await mkdtemp(join(tmpdir(), 'chant-lyric-move-'));
console.log(`Screenshots: ${screenshotDirectory}`);
const editorUrl = process.env.CHANT_EDITOR_URL ?? 'http://127.0.0.1:5173';
const pages = await (await fetch('http://127.0.0.1:9230/json')).json();
const page = pages.find((candidate) => candidate.type === 'page');
assert(page, 'Open a Chromium tab before running browser checks');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let serial = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, (m) => (m.error ? reject(m.error) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const pause = () => new Promise((r) => setTimeout(r, 100));

await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', {
  url: editorUrl + '/docs/verification/placement/browser-fixture.html',
});
for (let i = 0; i < 50; i++) {
  await pause();
  if (await ev("typeof mountChantFixture === 'function'")) break;
}
const mount = async (
  count = 14,
  syllables = [
    {
      id: 'existing',
      text: 'old',
      startsAtNeumeId: 'n4',
      boundaryBefore: 'word',
    },
  ],
) => {
  await ev(
    `mountChantFixture(${JSON.stringify({ title: 'Stage 3', clef: { type: 'c', staffLine: 3 }, syllables, neumes: Array.from({ length: count }, (_, i) => ({ id: `n${i}`, kind: 'punctum', notes: [{ id: `note${i}`, staffPosition: 2 }] })) })})`,
  );
  await pause();
};
const button = async (text) => {
  const found = await ev(
    `(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b)return false;b.click();return true})()`,
  );
  assert(found, `Missing button ${text}`);
  await pause();
};
const key = async (key, text, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    windowsVirtualKeyCode:
      key === 'Backspace'
        ? 8
        : key === 'Delete'
          ? 46
          : key === 'Enter'
            ? 13
            : key === 'Tab'
              ? 9
              : key === 'Escape'
                ? 27
                : 0,
    text,
    modifiers,
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers });
  await pause();
};
const type = async (text) => {
  await send('Input.insertText', { text });
  await pause();
};
const click = async (selector) => {
  const point = await ev(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...point,
    button: 'left',
    clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...point,
    button: 'left',
    clickCount: 1,
  });
  await pause();
};
const note = (id) => click(`[data-note-id="note${id}"]`);
const lyric = (id = 'middle') =>
  click(`.score__lyric[data-syllable-id="${id}"]`);
const active = () =>
  ev(
    'document.activeElement.dataset.noteId ?? document.activeElement.dataset.syllableId ?? document.activeElement.textContent.trim()',
  );
const input = () => ev("document.querySelector('#lyric-input')?.value ?? null");
const moving = () => ev("!!document.querySelector('#lyric-move-help')");
const status = () => ev("document.querySelector('[role=status]').textContent");
const music = () =>
  ev(
    "Array.from(document.querySelectorAll('[data-neume-id]')).map(n=>[n.dataset.neumeId,n.querySelector('.score__ink').outerHTML,Array.from(n.querySelectorAll('[data-note-id]')).map(n=>n.dataset.noteId)])",
  );
const syllables = [
  { id: 'first', text: 'Ky', startsAtNeumeId: 'n1', boundaryBefore: 'word' },
  {
    id: 'middle',
    text: 'ri',
    startsAtNeumeId: 'n4',
    boundaryBefore: 'continuation',
  },
  {
    id: 'last',
    text: 'e',
    startsAtNeumeId: 'n7',
    boundaryBefore: 'continuation',
  },
];
const reset = () => mount(30, syllables);
const position = (id = 'middle') =>
  ev(
    `(()=>{const n=document.querySelector('.score__lyric[data-syllable-id="${id}"]');return [n.getAttribute('x'),n.getAttribute('y'),n.closest('[data-system-index]').dataset.systemIndex]})()`,
  );
const selected = () =>
  ev(
    "document.querySelector('.score__lyric[aria-pressed=true]')?.dataset.syllableId",
  );
const startMove = async () => {
  await lyric();
  await button('Move syllable');
  assert(await moving());
};
await reset();
const original = await position();
const originalMusic = await music();
const originalFirst = await position('first');
const originalLast = await position('last');
// Normal clicks select and never begin moving.
await note(3);
assert.equal(await moving(), false);
await startMove();
assert.equal(await active(), 'note4');
assert.equal(await selected(), 'middle');
for (const [target, message] of [
  [1, /already starts/],
  [0, /cross/],
  [4, /current anchor/],
]) {
  await note(target);
  assert(await moving());
  assert.match(await status(), message);
  assert.deepEqual(await position(), original);
}
await note(3); // Pointer commits immediately, with no confirmation step.
assert.equal(await moving(), false);
assert.equal(await active(), 'middle');
assert.equal(await selected(), 'middle');
assert.deepEqual(await music(), originalMusic);
const earlier = await position();
assert.notDeepEqual(earlier, original);
assert.deepEqual(await position('first'), originalFirst);
assert.deepEqual(await position('last'), originalLast);
await button('Undo');
assert.deepEqual(await position(), original);
assert(
  await ev(
    'document.querySelector(\'[aria-label="Undo last edit"]\').disabled',
  ),
);
await button('Redo');
assert.deepEqual(await position(), earlier);
await button('Move syllable');
await key('ArrowRight');
assert.equal(await active(), 'note4');
assert.equal(await selected(), 'middle');
assert.deepEqual(await position(), earlier);
await key('ArrowRight');
assert.equal(await active(), 'note5');
await key('Enter');
const later = await position();
assert.equal(await moving(), false);
assert.notDeepEqual(later, earlier);
await button('Move syllable');
await button('Previous destination');
assert.equal(await active(), 'note4');
await key('Tab'); // Native traversal never selects a candidate.
assert.equal(await selected(), 'middle');
await key('Escape');
assert.equal(await moving(), false);
assert.deepEqual(await position(), later);
assert.equal(await active(), 'middle');
await button('Undo');
assert.deepEqual(await position(), earlier); // cancellation added no undo entry
// Edge anchors can reach lyricless prefixes and suffixes across systems.
await lyric('first');
await button('Move syllable');
await note(0);
assert.equal(await moving(), false);
await lyric('last');
await button('Move syllable');
for (let i = 0; i < 22; i++) await key('ArrowRight');
assert.equal(await active(), 'note29');
assert.equal(await selected(), 'last');
await key('Enter');
assert.equal(await moving(), false);
assert.notEqual((await position('last'))[2], originalLast[2]);
// Existing edit: valid dirty text saves once before move; unchanged/cleared add no entry.
for (const text of ['ré', 'ri', '']) {
  await reset();
  await lyric();
  await key('Enter');
  await ev("document.querySelector('#lyric-input').select()");
  if (text) await type(text);
  else await key('Backspace');
  await button('Move syllable');
  assert(await moving());
  await note(3);
  assert.equal(
    await ev(
      "document.querySelector('.score__lyric[data-syllable-id=middle]').textContent",
    ),
    text === 'ré' ? 'ré' : 'ri',
  );
  await button('Undo');
  assert.deepEqual(await position(), original);
  assert.equal(
    await ev(
      'document.querySelector(\'[aria-label="Undo last edit"]\').disabled',
    ),
    text !== 'ré',
  );
}
await reset();
await lyric();
await key('Enter');
await ev(
  "document.querySelector('#lyric-input').value='two words';document.querySelector('#lyric-input').dispatchEvent(new Event('input',{bubbles:true}))",
);
// React requires the native setter for a deliberate invalid controlled draft.
await ev(
  "(()=>{const n=document.querySelector('#lyric-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,'bad text');n.dispatchEvent(new Event('input',{bubbles:true}))})()",
);
await button('Move syllable');
assert.equal(await moving(), false);
assert.equal(await input(), 'bad text');
assert.match(await status(), /one syllable/);
await key('Escape');
// Narrow multi-system preview remains visible and keyboard selectable.
await send('Emulation.setDeviceMetricsOverride', {
  width: 320,
  height: 700,
  deviceScaleFactor: 1,
  mobile: false,
});
await reset();
await startMove();
await key('ArrowRight');
assert.equal(await active(), 'note5');
assert.equal(await selected(), 'middle');
assert(
  await ev(
    '(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()',
  ),
);
const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
});
await writeFile(
  join(screenshotDirectory, 'narrow-move.png'),
  Buffer.from(screenshot.data, 'base64'),
);
await key('Enter');
assert.equal(await moving(), false);
assert(await ev('document.documentElement.scrollWidth<=innerWidth'));
ws.close();
console.log(
  'Stage 3 browser checks passed: pointer, keyboard, rejection, history, drafts, focus, multi-system and narrow viewport.',
);
