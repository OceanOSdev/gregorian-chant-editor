import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const screenshotDirectory = await mkdtemp(
  join(tmpdir(), 'chant-vowel-alignment-'),
);
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

const viewport = async (width) =>
  send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
await viewport(1440);
await send('Page.navigate', {
  url: editorUrl + '/docs/verification/placement/browser-fixture.html',
});
for (let i = 0; i < 50; i++) {
  await pause();
  if (await ev("typeof mountChantFixture === 'function'")) break;
}
const words = ['Ky', 'ri', 'e', 'lé', 'son', 'au', 'qui', 'æ'];
const fixture = {
  title: 'Stage 4A — vowel alignment',
  lyricLanguage: 'la',
  clef: { type: 'c', staffLine: 3 },
  syllables: words.map((text, i) => ({
    id: `s${i}`,
    text,
    startsAtNeumeId: `n${i}`,
    boundaryBefore: i === 0 ? 'word' : 'continuation',
  })),
  neumes: Array.from({ length: 20 }, (_, i) => ({
    id: `n${i}`,
    kind: 'punctum',
    notes: [{ id: `note${i}`, staffPosition: 2 }],
  })),
};
const mount = async (doc = fixture) => {
  await ev(`mountChantFixture(${JSON.stringify(doc)})`);
  await pause();
  await pause();
};
const key = async (key, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    modifiers,
    windowsVirtualKeyCode:
      {
        Enter: 13,
        Tab: 9,
        Escape: 27,
        ArrowDown: 40,
        ArrowUp: 38,
        Home: 36,
        End: 35,
        Backspace: 8,
      }[key] ?? 0,
    ...(key === 'Enter' ? { text: '\r' } : {}),
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers });
  await pause();
};
const focus = async (selector) => {
  await ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await pause();
};
const click = async (selector) => {
  const point = await ev(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
};
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    join(screenshotDirectory, name + '.png'),
    Buffer.from(data, 'base64'),
  );
};
const music = () =>
  ev(
    `Array.from(document.querySelectorAll('[data-note-id]')).map(n=>[n.dataset.noteId,n.innerHTML])`,
  );
const musicalContours = () =>
  ev(
    `Array.from(document.querySelectorAll('[data-neume-id]')).map(n=>{const b=n.querySelector('.score__ink').getBBox(),system=n.closest('[data-system-index]'),line=system.querySelector('line');return [n.dataset.neumeId,n.dataset.neumeKind,b.width,b.height,b.y-Number(line.getAttribute('y1'))]})`,
  );
const positions = () =>
  ev(
    `Array.from(document.querySelectorAll('.score__lyric')).map(n=>({text:n.textContent,x:Number(n.getAttribute('x'))}))`,
  );
const chooseLanguage = async (value) => {
  await focus('[aria-label="Lyric language"]');
  assert(['la', 'und'].includes(value));
  await key(value === 'la' ? 'Home' : 'End');
  await key('Tab');
};
await mount();
assert.equal(
  await ev(`document.querySelector('[aria-label="Lyric language"]').value`),
  'la',
);
const originalMusic = await music();
const originalContours = await musicalContours();
const automatic = await positions();
const nucleusCenters =
  await ev(`Array.from(document.querySelectorAll('.score__lyric')).map((n,i)=>{
  const ranges=[[1,1],[1,1],[0,1],[1,1],[1,1],[0,2],[2,1],[0,1]];
  const [start,count]=ranges[i];
  return n.getStartPositionOfChar(start).x+n.getSubStringLength(start,count)/2;
})`);
for (const [i, center] of nucleusCenters.entries())
  assert(
    Math.abs(
      center -
        (await ev(
          `(()=>{const b=document.querySelectorAll('[data-neume-id]')[${i}].querySelector('.score__ink').getBBox();return b.x+6})()`,
        )),
    ) < 0.05,
  );

assert.equal(
  await ev(`document.querySelectorAll('[data-system-index]').length > 1`),
  true,
);
await ev('window.scrollTo(0,0)');
await shot('latin-automatic');
await chooseLanguage('und');
const centered = await positions();
assert.notEqual(automatic[0].x, centered[0].x);
assert.notEqual(automatic[6].x, centered[6].x);
// Reflow may move complete neumes; their contours and pitches stay fixed.
assert.deepEqual(await musicalContours(), originalContours);
await ev('window.scrollTo(0,0)');
await shot('whole-string-baseline');
await click('[aria-label="Undo last edit"]');
assert.deepEqual(await positions(), automatic);
assert.deepEqual(await music(), originalMusic);
await click('[aria-label="Redo last undone edit"]');
assert.deepEqual(await positions(), centered);
await chooseLanguage('la');
// Independent selection and actual native Tab traversal to a different lyric.
await click('.score__lyric[data-syllable-id="s0"]');
await focus('.score__lyric[data-syllable-id="s0"]');
await key('Tab');
assert.equal(await ev(`document.activeElement.dataset.syllableId`), 's1');
assert.equal(
  await ev(
    `document.querySelector('.score__lyric[aria-pressed="true"]').dataset.syllableId`,
  ),
  's0',
);
// Keyboard-only range editing targets the selected Ky, never the focused ri.
await focus('[aria-label="Alignment"]');
await key('End');
await key('Tab');
await focus('[aria-label="Alignment segment start"]');
await key('End');
await key('Tab');
assert.deepEqual(await positions(), automatic);
await focus('[aria-label="Alignment segment start"]');
await key('Home');
await key('Tab');
const wholeManual = await positions();
assert.equal(wholeManual[0].x, centered[0].x);
await click('[aria-label="Undo last edit"]');
assert.deepEqual(await positions(), automatic);
await click('[aria-label="Redo last undone edit"]');
assert.deepEqual(await positions(), wholeManual);
await ev('window.scrollTo(0,0)');
await shot('manual-whole-Ky');
await ev("document.querySelector('fieldset').scrollIntoView({block:'center'})");
await shot('manual-controls');
await focus('fieldset button');
await key('Enter');
assert.deepEqual(await positions(), automatic);
// A dirty text draft survives language edits without save, retarget or focus theft.
await focus('.score__lyric[data-syllable-id="s0"]');
await key('Enter');
await send('Input.insertText', { text: 'x' });
await pause();
const draft = await ev(
  `({text:document.querySelector('#lyric-input').value,target:document.querySelector('#lyric-input').dataset.targetNeumeId})`,
);
await chooseLanguage('und');
assert.deepEqual(
  await ev(
    `({text:document.querySelector('#lyric-input').value,target:document.querySelector('#lyric-input').dataset.targetNeumeId})`,
  ),
  draft,
);
assert.equal(
  await ev(
    `document.querySelector('.score__lyric[data-syllable-id="s0"]').textContent`,
  ),
  'Ky',
);
assert.equal(
  await ev(
    `!document.querySelector('fieldset') || document.querySelector('fieldset').disabled`,
  ),
  true,
);
await focus('#lyric-input');
await key('Escape');
// Native text changes clear an override; undo restores it exactly.
await click('.score__lyric[data-syllable-id="s0"]');
await focus('[aria-label="Alignment"]');
await key('End');
await key('Tab');
await focus('.score__lyric[data-syllable-id="s0"]');
await key('Enter');
await send('Input.insertText', { text: 'x' });
await key('Enter');
assert.equal(
  await ev(`document.querySelector('[aria-label="Alignment"]').value`),
  'automatic',
);
await click('[aria-label="Undo last edit"]');
assert.equal(
  await ev(`document.querySelector('[aria-label="Alignment"]').value`),
  'manual',
);
// Greek combining grapheme/manual override and narrow multi-system responsive check.
await mount({
  ...fixture,
  lyricLanguage: 'el',
  syllables: [{ ...fixture.syllables[0], text: 'κἀ\u0301' }],
});
await click('.score__lyric');
await focus('[aria-label="Alignment"]');
await key('End');
await key('Tab');
assert.equal(
  await ev(
    `document.querySelector('[aria-label="Alignment segment start"]').options.length`,
  ),
  2,
);
await focus('[aria-label="Alignment segment start"]');
await key('End');
await key('Tab');
assert.equal(
  await ev(
    `document.querySelector('[aria-label="Alignment segment end"]').options.length`,
  ),
  1,
);
await viewport(320);
await ev('window.scrollTo(0,0)');
await pause();
await shot('narrow-greek-manual');
await ev("document.querySelector('fieldset').scrollIntoView({block:'center'})");
await shot('narrow-manual-controls');
assert.equal(
  await ev('document.documentElement.scrollWidth <= innerWidth'),
  true,
);
await mount();
await chooseLanguage('und');
await chooseLanguage('la');
await click('.score__lyric');
await focus('[aria-label="Alignment"]');
await key('End');
await key('Tab');
await focus('[aria-label="Alignment segment start"]');
await key('End');
await key('Tab');
// Reflow may move complete neumes; their contours and pitches stay fixed.
assert.deepEqual(await musicalContours(), originalContours);
await ev('window.scrollTo(0,0)');
await shot('narrow-latin-manual');
console.log(
  JSON.stringify(
    {
      automatic,
      centered,
      checks:
        'PASS: language/undo/redo, native keyboard manual ranges/reset, focus vs selection, dirty draft, text reset, combining marks, multi-system and 320px',
    },
    null,
    2,
  ),
);
ws.close();
