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
    `mountChantFixture(${JSON.stringify({ title: 'Stage 3', divisions: [], lyricLanguage: 'la', clef: { type: 'c', staffLine: 3 }, syllables, neumes: Array.from({ length: count }, (_, i) => ({ id: `n${i}`, kind: 'punctum', notes: [{ id: `note${i}`, staffPosition: 2 }] })) })})`,
  );
  await pause();
  // Each fixture starts at the top rather than inheriting the previous case's
  // panel/input scroll position. Reveal behavior is exercised explicitly below.
  await ev('window.scrollTo(0, 0)');
  await pause();
};
const pointerClick = async (point) => {
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
const button = async (text) => {
  const point = await ev(
    `(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b)return null;b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  assert(point, `Missing button ${text}`);
  await pointerClick(point);
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
    // Native summary/button Enter activation requires Chromium's character
    // payload; React keydown handlers alone would pass without exercising it.
    text: text ?? (key === 'Enter' ? '\r' : undefined),
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
  await pointerClick(point);
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

// Independent selection, Lyrics target, and engraved keyboard focus survive
// move completion/cancellation. Selection buttons must use the semantic ID.
for (const outcome of ['commit', 'cancel']) {
  for (const action of [
    'Edit selected syllable',
    'Delete selected syllable',
    'focused-delete',
  ]) {
    await reset();
    await lyric('middle');
    await ev(
      "document.querySelector('.score__lyric[data-syllable-id=first]').focus()",
    );
    await key('l', 'l');
    assert.equal(await input(), 'Ky');
    assert.equal(await selected(), 'middle');
    await ev(
      "document.querySelector('.score__lyric[data-syllable-id=last]').focus()",
    );
    assert.equal(await active(), 'last');
    assert.equal(await selected(), 'middle');
    await button('Move syllable: ri');
    if (outcome === 'commit') await note(3);
    else await key('Escape');
    assert.equal(await moving(), false);
    assert.equal(await selected(), 'middle');
    assert(
      await ev(
        "document.querySelector('.lyric-actions').textContent.includes('Lyrics target: Ky')",
      ),
    );
    assert(
      await ev(
        "document.querySelector('.lyric-actions').textContent.includes('Selection (purple cue): ri')",
      ),
    );
    if (action === 'focused-delete') {
      await ev(
        "document.querySelector('.score__lyric[data-syllable-id=last]').focus()",
      );
      await key('Delete');
      assert.deepEqual(
        await ev(
          "Array.from(document.querySelectorAll('.score__lyric')).map(n=>n.dataset.syllableId)",
        ),
        ['first', 'middle'],
      );
    } else {
      await button(action);
      if (action === 'Edit selected syllable') {
        assert.equal(await input(), 'ri');
        assert.equal(
          await ev(
            "document.querySelector('#lyric-input').dataset.targetNeumeId",
          ),
          outcome === 'commit' ? 'n3' : 'n4',
        );
      } else {
        assert.deepEqual(
          await ev(
            "Array.from(document.querySelectorAll('.score__lyric')).map(n=>n.dataset.syllableId)",
          ),
          ['first', 'last'],
        );
        assert.equal(
          await ev(
            "document.querySelector('.score__lyric[data-syllable-id=first]').textContent",
          ),
          'Ky',
        );
      }
    }
  }
}
// Starting while editing used a neume selection; cancellation restores it.
await reset();
await lyric('middle');
await key('Enter');
await button('Move syllable: ri');
await key('Escape');
assert.equal(
  await ev(
    "document.querySelector('[data-selected-neume-id]')?.dataset.selectedNeumeId",
  ),
  'n4',
);
assert.equal(await active(), 'note4');
assert.equal(await selected(), undefined);
assert(
  await ev(
    "document.querySelector('.lyric-actions').textContent.includes('Lyrics target: ri')",
  ),
);
// Enter on native Keyboard help must open it, preserving mode/history/preview.
await reset();
await startMove();
await key('ArrowLeft');
for (let i = 0; i < 20 && (await active()) !== 'Keyboard help'; i++)
  await key('Tab', undefined, 8);
assert.equal(await active(), 'Keyboard help');
assert.equal(await ev("document.querySelector('.editor-help').open"), false);
await key('Enter');
assert.equal(await ev("document.querySelector('.editor-help').open"), true);
assert(await moving());
assert.deepEqual(await position(), original);
assert(
  await ev(
    "document.querySelector('[data-neume-id=n3] .score__move-target--preview') !== null",
  ),
);
await key('Escape');
assert(
  await ev(
    'document.querySelector(\'[aria-label="Undo last edit"]\').disabled',
  ),
);
// Ordinary Lyrics activation still prioritizes Edit over the earlier Move action.
await reset();
await note(4);
await button('Lyrics');
assert.equal(await active(), 'Edit syllable');
await key('Enter');
assert.equal(await input(), 'ri');
await key('Escape');
// Native Tab + Enter activation of Move and its controls, without DOM click().
await lyric('middle');
for (
  let i = 0;
  i < 40 && !String(await active()).startsWith('Move syllable:');
  i++
)
  await key('Tab');
assert.match(await active(), /^Move syllable:/);
await key('Enter');
assert(await moving());
await key('ArrowRight');
assert.equal(await active(), 'note5');
for (let i = 0; i < 60 && (await active()) !== 'Previous destination'; i++)
  await key('Tab');
assert.equal(await active(), 'Previous destination');
await key('Enter');
assert.equal(await active(), 'note3');
await key('Escape');
// Visible padding and borders own real pointer input, not only constituent notes.
for (const edge of ['left', 'right', 'top', 'bottom']) {
  await reset();
  await startMove();
  const point = await ev(
    `(()=>{const r=document.querySelector('[data-neume-id=n3] .score__move-target');r.scrollIntoView({block:'nearest'});const b=r.getBoundingClientRect();return {x:${edge === 'left' ? 'b.left+0.5' : edge === 'right' ? 'b.right-0.5' : 'b.left+b.width/2'},y:${edge === 'top' ? 'b.top+0.5' : edge === 'bottom' ? 'b.bottom-0.5' : 'b.top+b.height/2'}}})()`,
  );
  assert.equal(
    await ev(
      `document.elementFromPoint(${point.x},${point.y}).closest('[data-neume-id]')?.dataset.neumeId`,
    ),
    'n3',
  );
  await pointerClick(point);
  assert.equal(await moving(), false);
  assert.match(await status(), /neume 4/);
  assert.deepEqual(await music(), originalMusic);
  await button('Undo');
  assert.deepEqual(await position(), original);
  assert(
    await ev(
      'document.querySelector(\'[aria-label="Undo last edit"]\').disabled',
    ),
  );
}
// All seven kinds keep highlighted and pointer rectangles identical/disjoint.
const { neumes: mixed } = await ev(
  `(async()=>{const {staffPosition:p}=await import('/src/editor/domain/chant-document.ts');return {neumes:[['punctum',[2]],['podatus',[2,3]],['clivis',[4,3]],['scandicus',[1,2,3]],['torculus',[2,4,3]],['climacus',[5,3,1]],['porrectus',[4,2,3]]].map(([kind,positions],i)=>({id:'mix'+i,kind,notes:positions.map((v,j)=>({id:'mixnote'+i+'-'+j,staffPosition:p(v)}))}))}})()`,
);
for (let target = 0; target < mixed.length; target++) {
  await ev(
    `mountChantFixture(${JSON.stringify({ title: 'Mixed targets', divisions: [], lyricLanguage: 'la', clef: { type: 'c', staffLine: 3 }, neumes: mixed, syllables: [{ id: 'source', text: 'Al', startsAtNeumeId: target === 0 ? 'mix1' : 'mix0', boundaryBefore: 'word' }] })})`,
  );
  await pause();
  await lyric('source');
  await button('Move syllable');
  const bounds = await ev(
    "Array.from(document.querySelectorAll('.score__move-hit-target')).map(n=>({system:n.closest('[data-system-index]').dataset.systemIndex,x:+n.getAttribute('x'),right:+n.getAttribute('x') + +n.getAttribute('width')}))",
  );
  for (let i = 1; i < bounds.length; i++)
    if (bounds[i - 1].system === bounds[i].system)
      assert(bounds[i - 1].right + 3 < bounds[i].x);
  const point = await ev(
    `(()=>{const n=document.querySelector('[data-neume-id=mix${target}] .score__move-target'),h=document.querySelector('[data-neume-id=mix${target}] .score__move-hit-target');for(const a of ['x','y','width','height','rx'])if(n.getAttribute(a)!==h.getAttribute(a))throw Error('cue and hit bounds differ');n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();return {x:r.left+0.5,y:r.top+r.height/2}})()`,
  );
  await pointerClick(point);
  assert.equal(await moving(), false);
  assert((await status()).endsWith('neume ' + (target + 1) + '.'));
}
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
