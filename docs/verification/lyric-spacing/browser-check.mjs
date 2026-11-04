import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const screenshotDirectory = await mkdtemp(
  join(tmpdir(), 'chant-lyric-spacing-'),
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
        a: 65,
        Enter: 13,
        Tab: 9,
        Escape: 27,
        ArrowDown: 40,
        ArrowRight: 39,
        ArrowLeft: 37,
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
const words = [
  'Ky',
  'ri',
  'e',
  'e',
  'lé',
  'i',
  'son',
  'longissimum',
  'verbum',
  'misericordiam',
  'sempiternam',
];
const fixture = {
  title: 'Kyrie eleison — lyric spacing and wrapping',
  divisions: [],
  lyricLanguage: 'la',
  clef: { type: 'c', staffLine: 3 },
  syllables: words.map((text, i) => ({
    id: `s${i}`,
    text,
    startsAtNeumeId: `n${i}`,
    boundaryBefore: [0, 3, 7, 8, 9, 10].includes(i) ? 'word' : 'continuation',
  })),
  neumes: Array.from({ length: 22 }, (_, i) => ({
    id: `n${i}`,
    kind: 'punctum',
    notes: [{ id: `note${i}`, staffPosition: 2 }],
  })),
};
await mount();
await ev('window.scrollTo(0,0)');
await shot(
  process.env.CHANT_BASELINE
    ? 'before-spacing-wrapping'
    : 'after-spacing-wrapping',
);
if (process.env.CHANT_BASELINE) {
  ws.close();
  process.exit(0);
}
const geometry = () =>
  ev(
    `Array.from(document.querySelectorAll('[data-system-index]')).map(s=>({index:Number(s.dataset.systemIndex), notes:Array.from(s.querySelectorAll('[data-note-id]')).map(n=>n.dataset.noteId), lyrics:Array.from(s.querySelectorAll('.score__lyric')).map(n=>({id:n.dataset.syllableId,x:Number(n.getAttribute('x')),width:n.getComputedTextLength()}))}))`,
  );
const assertClear = async () => {
  for (const s of await geometry())
    for (let i = 1; i < s.lyrics.length; i++) {
      const a = s.lyrics[i - 1],
        b = s.lyrics[i];
      assert(
        b.x - b.width / 2 >= a.x + a.width / 2 - 0.1,
        `overlap: ${a.id}, ${b.id}`,
      );
    }
  await assertInkClear();
};
// Regression: advance boxes can abut while the final f still paints over lu.
const sameWord = {
  ...fixture,
  title: 'Same-word painted-overhang regression',
  syllables: ['Al', 'lealsdkfjaasdfhasdf', 'lu', 'ia', 'bla'].map(
    (text, i) => ({
      id: `s${i}`,
      text,
      startsAtNeumeId: `n${i}`,
      boundaryBefore: i ? 'continuation' : 'word',
    }),
  ),
};
const assertInkClear = async () => {
  const gaps =
    await ev(`Array.from(document.querySelectorAll('[data-system-index]')).flatMap(s=>{
    const texts=Array.from(s.querySelectorAll('.score__lyric'));
    return texts.slice(1).map((t,i)=>{const a=texts[i].getBBox(),b=t.getBBox();return b.x-a.x-a.width});
  })`);
  assert(
    gaps.every((g) => g >= -0.05),
    `painted glyph overlap: ${gaps}`,
  );
  return gaps;
};
await mount(sameWord);
const sameWordGeometry = await geometry();
const sameWordGaps = await assertInkClear();
await ev('window.scrollTo(0,0)');
await shot('same-word-overhang-after');
await viewport(320);
await pause();
await assertInkClear();
await shot('same-word-overhang-320');
await viewport(1440);
await pause();
// Selected decoration must never cross the neighboring glyphs or move music.
for (const [width, zoom] of [
  [1440, 1],
  [320, 1],
  [480, 1.5],
]) {
  await viewport(width);
  await ev(`document.documentElement.style.zoom='${zoom}'`);
  await pause();
  const unselected = await geometry();
  await click('.score__lyric[data-syllable-id="s1"]');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  const cue = await ev(
    `(()=>{const t=document.querySelector('.score__lyric[data-syllable-id="s1"]'),g=t.parentElement,r=g.querySelector('.score__lyric-selection'),next=document.querySelector('.score__lyric[data-syllable-id="s2"]');return {pressed:t.getAttribute('aria-pressed'),outline:getComputedStyle(g).outlineStyle,stroke:getComputedStyle(r).stroke,pointer:getComputedStyle(r).pointerEvents,hidden:r.getAttribute('aria-hidden'),behind:g.firstElementChild===r,gap:next.getBBox().x-r.getBBox().x-r.getBBox().width}})()`,
  );
  assert.equal(cue.pressed, 'true');
  assert.equal(cue.outline, 'none');
  assert.equal(cue.stroke, 'none');
  assert.equal(cue.pointer, 'none');
  assert.equal(cue.hidden, 'true');
  assert.equal(cue.behind, true);
  assert(cue.gap >= -0.05);
  await assertInkClear();
  assert.deepEqual(await geometry(), unselected);
  await ev('window.scrollTo(0,0)');
  await shot(`selected-cue-${width}-${zoom}`);
  await click('[data-note-id="note0"]');
  assert.equal(
    await ev(`document.querySelectorAll('.score__lyric-selection').length`),
    0,
  );
  assert.deepEqual(await geometry(), unselected);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  await ev('window.scrollTo(0,0)');
  await shot(`unselected-cue-${width}-${zoom}`);
}
await ev(`document.documentElement.style.zoom='1'`);
await viewport(1440);
await pause();
// A longer version must wrap normally, then an unbreakable version must isolate.
// The suffix fills the room reclaimed by the tighter initial-clef spacing.
await focus('.score__lyric[data-syllable-id="s1"]');
await key('Enter');
await key('a', 2);
await send('Input.insertText', {
  text: 'lealsdkfjaasdfhasdf'.repeat(3) + 'mm',
});
await key('Enter');
const wrapped = await geometry();
assert(wrapped[1].lyrics.some((l) => l.id === 's1'));
assert.equal(
  await ev(`document.querySelector('.score').viewBox.baseVal.width`),
  720,
);
await assertInkClear();
await ev('window.scrollTo(0,0)');
await shot('same-word-overhang-wrapped');
await click('[aria-label="Undo last edit"]');
assert.deepEqual(await geometry(), sameWordGeometry);
await click('[aria-label="Redo last undone edit"]');
assert.deepEqual(await geometry(), wrapped);
await focus('.score__lyric[data-syllable-id="s1"]');
await key('Enter');
await key('a', 2);
await send('Input.insertText', { text: 'lealsdkfjaasdfhasdf'.repeat(8) });
await key('Enter');
assert.equal((await geometry())[1].notes.length, 1);
assert.equal((await geometry())[2].lyrics[0].id, 's2');
assert(await ev(`document.querySelector('.score').viewBox.baseVal.width>720`));
await assertInkClear();
console.log('Same-word painted gaps:', sameWordGaps);
await mount();
await assertClear();
const original = await geometry();
assert.equal(
  await ev(`document.querySelector('.score').viewBox.baseVal.width`),
  720,
);
// Native selection, Tab independence, text-edit reflow and exact undo/redo.
await click('.score__lyric[data-syllable-id="s0"]');
await focus('.score__lyric[data-syllable-id="s0"]');
await key('Tab');
assert.equal(await ev('document.activeElement.dataset.syllableId'), 's1');
assert.equal(
  await ev(
    `document.querySelector('.score__lyric[aria-pressed="true"]').dataset.syllableId`,
  ),
  's0',
);
await focus('.score__lyric[data-syllable-id="s7"]');
await key('Enter');
await key('a', 2);
await send('Input.insertText', { text: 'a'.repeat(55) });
await key('Enter');
assert.notDeepEqual(await geometry(), original);
await assertClear();
await click('[aria-label="Undo last edit"]');
assert.deepEqual(await geometry(), original);
await click('[aria-label="Redo last undone edit"]');
assert.notDeepEqual(await geometry(), original);
await click('[aria-label="Undo last edit"]');
// Native boundary edits enlarge only the necessary incoming advance.
// s8 is an interior word boundary; s10 now starts a system and need not move.
await click('.score__lyric[data-syllable-id="s8"]');
await focus('[aria-label="Word boundary"]');
await key('End');
await key('Tab');
const joined = await geometry();
assert.notDeepEqual(joined, original);
await click('[aria-label="Undo last edit"]');
assert.deepEqual(await geometry(), original);
await click('[aria-label="Redo last undone edit"]');
assert.deepEqual(await geometry(), joined);
await click('[aria-label="Undo last edit"]');
// Real pointer conversion, local ghost, whole-neume insertion and atomic history.
await ev(`(async()=>{
  const l=await import('/src/editor/layout/layout-chant.ts');
  const m=await import('/src/editor/rendering/use-lyric-measurement.ts');
  const r=await import('/src/editor/interaction/resolve-graphical-neume-placement.ts');
  window.resolveFixture=(doc,point)=>r.resolveGraphicalNeumePlacement(l.layoutChant(doc,m.createSvgLyricMeasurer()),'punctum',point);
})()`);
const place = async (doc, point) => {
  const expected = await ev(
    `resolveFixture(${JSON.stringify(doc)},${JSON.stringify(point)}).insertionIndex`,
  );
  await click('[data-tool="punctum"]');
  await ev(
    `(()=>{const s=document.querySelector('.score');const p=new DOMPoint(${point.x},${point.y}).matrixTransform(s.getScreenCTM());window.scrollBy(0,p.y-innerHeight/2)})()`,
  );
  const client = await ev(
    `(()=>{const p=new DOMPoint(${point.x},${point.y}).matrixTransform(document.querySelector('.score').getScreenCTM());return {x:p.x,y:p.y}})()`,
  );
  assert(client.x > 0 && client.x < 1440);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...client });
  await pause();
  assert.equal(
    await ev(`document.querySelectorAll('.score__placement-ghost').length`),
    1,
  );
  const before = await ev(
    `Array.from(document.querySelectorAll('[data-note-id]')).map(n=>n.dataset.noteId)`,
  );
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...client,
      button: 'left',
      clickCount: 1,
    });
  await pause();
  const after = await ev(
    `Array.from(document.querySelectorAll('[data-note-id]')).map(n=>n.dataset.noteId)`,
  );
  assert.equal(after.length, before.length + 1);
  const added = after.find((n) => !before.includes(n));
  assert.equal(after.indexOf(added), expected);
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-label')`),
    'Score placement',
  );
  await key('Escape');
  assert.equal(await ev('document.activeElement.dataset.noteId'), added);
  assert(
    await ev(
      `(()=>{const n=document.activeElement.getBoundingClientRect(),v=document.querySelector('.score-viewport').getBoundingClientRect();return n.left>=v.left-1&&n.right<=v.right+1})()`,
    ),
  );
  await click('[aria-label="Undo last edit"]');
  assert.deepEqual(
    await ev(
      `Array.from(document.querySelectorAll('[data-note-id]')).map(n=>n.dataset.noteId)`,
    ),
    before,
  );
  await click('[aria-label="Redo last undone edit"]');
  assert.deepEqual(
    await ev(
      `Array.from(document.querySelectorAll('[data-note-id]')).map(n=>n.dataset.noteId)`,
    ),
    after,
  );
};
await place(fixture, { x: 300, y: 368 });
// Font readiness can move a focused control between system groups. Force the
// provisional layout for a frame, then restore metrics and retain the same ID.
// s10 crosses the measured/provisional system boundary with the new capacity.
await mount();
await focus('.score__lyric[data-syllable-id="s10"]');
const focusedSystem = await ev(
  `document.activeElement.closest('[data-system-index]').dataset.systemIndex`,
);
await ev(`document.fonts.dispatchEvent(new Event('loading'))`);
await pause();
assert.equal(await ev('document.activeElement.dataset.syllableId'), 's10');
assert.notEqual(
  await ev(
    `document.activeElement.closest('[data-system-index]').dataset.systemIndex`,
  ),
  focusedSystem,
);
await ev(`document.fonts.dispatchEvent(new Event('loadingdone'))`);
await pause();
assert.equal(await ev('document.activeElement.dataset.syllableId'), 's10');
assert.equal(
  await ev(
    `document.activeElement.closest('[data-system-index]').dataset.systemIndex`,
  ),
  focusedSystem,
);
// All neume kinds preserve actual rendered glyphs and text clearance.
const kinds = [
  'punctum',
  'podatus',
  'clivis',
  'scandicus',
  'torculus',
  'climacus',
  'porrectus',
];
const contours = [
  [2],
  [2, 4],
  [4, 2],
  [1, 2, 4],
  [2, 4, 3],
  [4, 3, 2],
  [4, 2, 3],
];
await mount({
  ...fixture,
  neumes: fixture.neumes.map((n, i) => ({
    ...n,
    kind: kinds[i % 7],
    notes: contours[i % 7].map((p, j) => ({
      id: `note${i}-${j}`,
      staffPosition: p,
    })),
  })),
});
await assertClear();
await ev('window.scrollTo(0,0)');
await shot('all-neume-kinds');
// Real font substitution and font-loading event invalidation/recovery.
await ev(
  `(async()=>{const face=new FontFace('Stage4BFallback','local("DejaVu Sans")');await face.load();document.fonts.add(face);const style=document.createElement('style');style.textContent='text { font-family: Stage4BFallback, serif !important; }';document.head.append(style);window.spacingFontStyle=style;document.fonts.dispatchEvent(new Event('loading'));document.fonts.dispatchEvent(new Event('loadingdone'));})()`,
);
await pause();
await assertClear();
await shot('font-fallback');
await ev(
  'spacingFontStyle.remove();document.fonts.dispatchEvent(new Event("loadingdone"))',
);
await pause();
// Exceptional left, right and two-sided overhangs, real keyboard scrolling at 320px.
for (const direction of ['left', 'right', 'both']) {
  const huge = {
    ...fixture,
    syllables: [
      {
        ...fixture.syllables[0],
        text: 'b'.repeat(300),
        alignment:
          direction === 'both'
            ? undefined
            : direction === 'left'
              ? { start: 299, end: 300 }
              : { start: 0, end: 1 },
      },
    ],
  };
  await mount(huge);
  await viewport(320);
  await ev('window.scrollTo(0,0)');
  await pause();
  const canvas = await ev(
    `(()=>{const s=document.querySelector('.score'),v=s.viewBox.baseVal,t=document.querySelector('.score__lyric'),w=t.getComputedTextLength(),x=Number(t.getAttribute('x')),r=document.querySelector('.score-viewport');return {x:v.x,width:v.width,left:x-w/2,right:x+w/2,css:s.getBoundingClientRect().width,scroll:r.scrollWidth,client:r.clientWidth,page:document.documentElement.scrollWidth}})()`,
  );
  assert(canvas.width > 720);
  assert(canvas.x <= canvas.left - 11);
  assert(canvas.x + canvas.width >= canvas.right + 11);
  assert(Math.abs(canvas.css - canvas.width) < 3);
  assert(canvas.page <= 320);
  assert(canvas.scroll > canvas.client);
  assert.equal((await geometry())[0].notes.length, 1);
  await focus('.score-viewport');
  await key('ArrowRight');
  await new Promise((r) => setTimeout(r, 300));
  assert(await ev(`document.querySelector('.score-viewport').scrollLeft>0`));
  await key('End', 2);
  await new Promise((r) => setTimeout(r, 300));
  // Native horizontal wheel reaches the complete right edge without page overflow.
  await ev('window.scrollTo(0,0)');
  const wheelPoint = await ev(
    `(()=>{const r=document.querySelector('.score-viewport').getBoundingClientRect();return {x:r.left+20,y:Math.max(10,r.top+30)}})()`,
  );
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    ...wheelPoint,
    deltaX: 10000,
    deltaY: 0,
  });
  await new Promise((r) => setTimeout(r, 300));
  assert(
    await ev(
      `(()=>{const v=document.querySelector('.score-viewport');return v.scrollLeft>=v.scrollWidth-v.clientWidth-2})()`,
    ),
  );
  await ev('window.scrollTo(0,0)');
  await shot(`overflow-${direction}-320`);
  await viewport(1440);
  // Scroll to the normal staff inside the enlarged canvas before placing on system 2.
  await ev(
    `document.querySelector('.score-viewport').scrollLeft=${300 - canvas.x - 200}`,
  );
  await pause();
  await place(huge, { x: 300, y: 368 });
}
await mount();
await viewport(320);
await ev('window.scrollTo(0,0)');
await pause();
await shot('ordinary-320');
assert(await ev('document.documentElement.scrollWidth<=innerWidth'));
assert.equal(
  await ev(`document.querySelector('.score').viewBox.baseVal.width`),
  720,
);
await assertClear();
console.log(
  'PASS: measured clearance, native text reflow/undo/redo, selection/Tab, pointer preview/insertion/focus on later systems, all seven kinds, fallback font/reload, left/right/both overflow, native keyboard scrolling, 320px local containment.',
);
ws.close();
