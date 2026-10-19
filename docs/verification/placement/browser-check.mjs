import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const origin = process.env.CHANT_EDITOR_URL ?? 'http://127.0.0.1:5173';
const pages = await (
  await fetch(
    (process.env.CHANT_CHROME_URL ?? 'http://127.0.0.1:9250') + '/json',
  )
).json();
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
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
  new Promise((r, j) => {
    const id = ++serial;
    pending.set(id, (m) => (m.error ? j(m.error) : r(m.result)));
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
const pause = () => new Promise((r) => setTimeout(r, 40));
const results = { browser: await send('Browser.getVersion'), checks: [] };
const record = (name, value) => {
  results.checks.push({ name, ...value });
  console.log(name, JSON.stringify(value));
};
const out = 'docs/verification/placement';
await mkdir(out, { recursive: true });
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: origin });
await pause();
await pause();
await send('Page.navigate', {
  url: origin + '/docs/verification/placement/browser-fixture.html',
});
for (let i = 0; i < 100; i++) {
  await pause();
  if (await ev(`typeof mountChantFixture==='function'`)) break;
}
const base = {
  title: 'Placement verification',
  clef: { type: 'c', staffLine: 3 },
  syllables: [
    { id: 's1', text: 'Ky' },
    { id: 's2', text: 'ri' },
  ],
  neumes: [],
};
async function mount(document = base) {
  await ev(`mountChantFixture(${JSON.stringify(document)})`);
  await pause();
  await ev(
    `(()=>{window.focusCalls=[];window.messages=[];const region=document.querySelector('[role=status]');window.messageObserver?.disconnect();window.messageObserver=new MutationObserver(()=>messages.push(region.textContent));messageObserver.observe(region,{childList:true,subtree:true,characterData:true})})()`,
  );
}
await ev(
  `(()=>{for(const prototype of [HTMLElement.prototype,SVGElement.prototype]){const original=prototype.focus;prototype.focus=function(options){window.focusCalls?.push({tag:this.tagName,id:this.getAttribute('data-note-id'),disabled:this.getAttribute('aria-disabled'),preventScroll:options?.preventScroll});return original.call(this,options)}}})()`,
);
async function clickAt(p) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...p,
    button: 'left',
    clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...p,
    button: 'left',
    clickCount: 1,
  });
}
async function click(selector) {
  await ev(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',behavior:'instant'})`,
  );
  const p = await ev(
    `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  await clickAt(p);
  await pause();
}
const button = (text) => click(`button[aria-label="${text}"]`);
async function scorePoint(x = 300, y = 100) {
  return ev(
    `(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('.score').getScreenCTM());return {x:p.x,y:p.y}})()`,
  );
}
async function key(key, modifiers = 0) {
  const code =
    {
      Escape: 27,
      Tab: 9,
      Enter: 13,
      ArrowUp: 38,
      ArrowDown: 40,
      z: 90,
      Backspace: 8,
    }[key] ?? 0;
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    windowsVirtualKeyCode: code,
    modifiers,
    text: key === 'Enter' ? '\r' : undefined,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    windowsVirtualKeyCode: code,
    modifiers,
  });
  await pause();
}
const snapshot = () =>
  ev(
    `({count:document.querySelectorAll('[data-neume-kind]').length,notes:Array.from(document.querySelectorAll('[data-note-id]')).map(n=>({id:n.dataset.noteId,disabled:n.getAttribute('aria-disabled'),tab:n.tabIndex})),tool:document.querySelector('.editor-context__summary strong').textContent,target:document.querySelector('.editor-context__summary').textContent,repeat:document.querySelector('[type=checkbox]').checked,focus:document.activeElement.classList.contains('score')?'score':document.activeElement.dataset.noteId??document.activeElement.textContent,preview:!!document.querySelector('.score__placement-preview'),scrollY,message:document.querySelector('[role=status]').textContent})`,
  );
const notation = () =>
  ev(
    `Array.from(document.querySelectorAll('[data-neume-kind]')).map(n=>({id:n.dataset.neumeId,kind:n.dataset.neumeKind,notes:Array.from(n.querySelectorAll('[data-note-id]')).map(n=>n.dataset.noteId)}))`,
  );
const kinds = [
  'punctum',
  'podatus',
  'clivis',
  'scandicus',
  'torculus',
  'climacus',
  'porrectus',
];
for (const repeat of [false, true])
  for (const kind of kinds) {
    await mount();
    if (repeat) await click('[type=checkbox]');
    await button('Place ' + kind);
    const p = await scorePoint();
    await clickAt(p);
    await pause();
    const s = await snapshot();
    assert.equal(s.count, 1);
    assert.equal(s.repeat, repeat);
    assert.equal(s.focus, repeat ? 'score' : s.notes[0].id);
    assert.equal(s.preview, false);
    assert(s.notes.every((n) => n.disabled === (repeat ? 'true' : 'false')));
    assert.equal(
      s.tool,
      repeat
        ? 'Tool: Placing ' + kind[0].toUpperCase() + kind.slice(1)
        : 'Tool: Select/Edit',
    );
    assert.equal(
      (await ev('focusCalls')).filter((c) => c.disabled === 'true').length,
      0,
    );
    record('kind lifecycle', { kind, repeat, count: s.count, focus: s.focus });
  }
// Real trusted clicks, without intervening pointer movement.
await mount();
await click('[type=checkbox]');
await button('Place punctum');
const p = await scorePoint();
for (let i = 0; i < 12; i++) await clickAt(p);
await pause();
const rapid = await snapshot();
assert.equal(rapid.count, 12);
assert.equal(rapid.preview, false);
assert.equal(rapid.focus, 'score');
const committed = await notation();
assert.equal(new Set(committed.flatMap((n) => [n.id, ...n.notes])).size, 24);
assert.equal(
  (await ev('messages')).filter((m) => m === 'Punctum added.').length,
  12,
);
for (let i = 0; i < 3; i++) await key('z', 2);
assert.equal((await snapshot()).count, 9);
for (let i = 0; i < 3; i++) await key('z', 10);
assert.deepEqual(await notation(), committed);
record('rapid trusted clicks and history', {
  clicks: 12,
  neumes: rapid.count,
  messages: 12,
  restoredExactIds: true,
});
// Force multiple event dispatches into one JS turn to challenge stale closures.
await ev(
  `(()=>{const s=document.querySelector('.score');const p=new DOMPoint(300,100).matrixTransform(s.getScreenCTM());for(let i=0;i<30;i++)s.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:p.x,clientY:p.y}))})()`,
);
await pause();
assert.equal((await snapshot()).count, 42);
record('same-batch clicks', { additionalClicks: 30, totalNeumes: 42 });
// No changes from invalid clicks, preview/hover updates, or idempotent arming.
const beforeInvalid = await notation();
const invalid = await scorePoint(0, 100);
const msgCount = await ev('messages.length');
await clickAt(invalid);
await pause();
assert.deepEqual(await notation(), beforeInvalid);
assert.equal(await ev('messages.length'), msgCount);
await button('Place punctum');
assert.equal(await ev('messages.length'), msgCount);
await send('Input.dispatchMouseEvent', {
  type: 'mouseMoved',
  ...(await scorePoint(400, 88)),
});
await pause();
assert.equal((await snapshot()).preview, true);
assert.equal(await ev('messages.length'), msgCount);
await button('Place podatus');
assert.equal((await snapshot()).preview, false);
await click('[type=checkbox]');
assert.equal((await snapshot()).tool, 'Tool: Placing Podatus');
await clickAt(await scorePoint());
await pause();
assert.equal((await snapshot()).tool, 'Tool: Select/Edit');
assert.equal((await snapshot()).repeat, false);
record('invalid hover switching repetition', { passed: true });
// All Add actions leave placement consistently with either preference.
for (const repeat of [false, true])
  for (const kind of kinds) {
    await mount();
    if (repeat) await click('[type=checkbox]');
    await button('Place clivis');
    await button('Add ' + kind);
    const s = await snapshot();
    assert.equal(s.count, 1);
    assert.equal(s.tool, 'Tool: Select/Edit');
    assert.equal(s.repeat, repeat);
    assert.equal(s.focus, s.notes[0].id);
  }
record('Add consistency', { cases: 14, passed: true });
// Single sticky action identity, Finish focus, fallback, whole-neume selection.
await mount();
await ev(
  `void(window.originalFinish=document.querySelector('.editor-context button'))`,
);
await click('[type=checkbox]');
await button('Place podatus');
await clickAt(await scorePoint());
await pause();
const inserted = await snapshot();
await key('Escape');
assert.equal((await snapshot()).focus, inserted.notes[0].id);
assert.equal(
  await ev(`originalFinish===document.querySelector('.editor-context button')`),
  true,
);
await key('Enter', 8);
await button('Place punctum');
await click('.editor-context button');
assert.equal((await snapshot()).focus, inserted.notes[0].id);
await button('Place punctum');
await click('button[aria-label="Syllable 2: ri"]');
await click('.editor-context button');
assert.equal(await ev(`document.activeElement===originalFinish`), true);
assert.equal((await snapshot()).message, 'Placement finished.');
record('Finish identity and restoration', { passed: true });
// Target changes and lyric draft/input keyboard lifecycle, without disarming.
await button('Place punctum');
await click('button[aria-label="Syllable 1: Ky"]');
assert.equal((await snapshot()).message, 'Target: syllable 1, Ky.');
await click('[id=lyric-syllable]');
const beforeNativeTextUndo = await notation();
await send('Input.insertText', { text: ' draft' });
await key('z', 2);
assert.equal(await ev(`document.querySelector('#lyric-syllable').value`), 'Ky');
assert.deepEqual(await notation(), beforeNativeTextUndo);
await key('z', 10);
assert(
  (await ev(`document.querySelector('#lyric-syllable').value`)).includes(
    'draft',
  ),
);
await key('Escape');
assert.equal(await ev(`document.querySelector('#lyric-syllable').value`), 'Ky');
assert.equal((await snapshot()).tool, 'Tool: Placing Punctum');
await click('button[aria-label="Syllable 2: ri"]');
await click('button[aria-label="Syllable 1: Ky"]');
const add = await ev(
  `(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Add syllable');b.click();return true})()`,
);
assert(add);
await pause();
assert.equal(await ev(`document.activeElement.id`), 'lyric-syllable');
assert((await snapshot()).message.includes('syllable 3, empty'));
await key('Tab');
await key('z', 2);
assert((await snapshot()).message.includes('Target: syllable 2, ri.'));
record('syllable input history', { passed: true });
// Score keys and disabled-note handlers must not edit during placement.
await mount();
await click('[type=checkbox]');
await button('Place punctum');
await clickAt(await scorePoint());
await pause();
const guarded = await notation();
await key('ArrowUp');
await key('Enter');
await ev(
  `(()=>{const n=document.querySelector('[data-note-id]');for(const key of ['ArrowUp','ArrowDown','Delete','Backspace','Enter',' '])n.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}))})()`,
);
await pause();
assert.deepEqual(await notation(), guarded);
await click('[type=checkbox]');
await key('Escape');
assert.equal((await snapshot()).tool, 'Tool: Select/Edit');
record('placement key guards and checkbox Escape', { passed: true });
// Long actual React score: destination focus, unchanged viewport, short AX name,
// no disabled focus, ordinary reverse Tab to the sticky Finish action.
const long = {
  ...base,
  syllables: [base.syllables[0]],
  neumes: Array.from({ length: 360 }, (_, i) => ({
    id: 'long' + i,
    kind: 'punctum',
    lyricSyllableId: 's1',
    notes: [{ id: 'long-note' + i, staffPosition: 2 }],
  })),
};
for (const width of [1440, 390, 320]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await mount(long);
  await click('[type=checkbox]');
  await button('Place punctum');
  await ev(
    `(()=>{const n=document.querySelector('[data-system-index="23"]');n.scrollIntoView({block:'center',behavior:'instant'})})()`,
  );
  await pause();
  const late = await ev(
    `(()=>{const line=document.querySelector('[data-system-index="23"] .score__staff-line');return Number(line.getAttribute('y1'))-24})()`,
  );
  const pos = await scorePoint(400, late);
  const before = await ev('scrollY');
  await clickAt(pos);
  await pause();
  const s = await snapshot();
  assert.equal(s.count, 361);
  assert.equal(s.focus, 'score');
  assert.equal(s.scrollY, before);
  assert(s.target.includes('system 24'));
  const ax = await send('Accessibility.getFullAXTree');
  const focused = ax.nodes.find(
    (n) =>
      n.role?.value === 'group' &&
      n.properties?.some((p) => p.name === 'focused' && p.value.value),
  );
  assert.equal(focused?.name?.value, 'Score placement');
  assert.equal(
    focused?.description?.value,
    'Punctum. Target syllable 1, Ky. Keep placing on. Escape finishes.',
  );
  assert.equal(
    (await ev('focusCalls')).filter((c) => c.disabled === 'true').length,
    0,
  );
  await key('Tab');
  assert.equal(
    await ev(`document.activeElement?.getAttribute('aria-disabled')==='true'`),
    false,
  );
  // Resume root focus explicitly after ordinary forward traversal may leave page content.
  await ev(`document.querySelector('.score').focus({preventScroll:true})`);
  await key('Tab', 8);
  assert.equal(
    await ev(
      `document.activeElement===document.querySelector('.editor-context button')`,
    ),
    true,
  );
  await key('Enter');
  assert.equal(
    (await snapshot()).focus,
    s.notes.find((n) => !n.id.startsWith('long'))?.id,
  );
  assert.equal(
    await ev(
      `(()=>{const n=document.querySelector('.score__note[aria-pressed=true]').getBoundingClientRect();return n.top>document.querySelector('.editor-context').getBoundingClientRect().bottom&&n.bottom<innerHeight})()`,
    ),
    true,
  );
  const r = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    out + `/late-system-${width}.png`,
    Buffer.from(r.data, 'base64'),
  );
  record('long score focus', {
    width,
    systems: await ev(
      `document.querySelectorAll('[data-system-index]').length`,
    ),
    before,
    after: s.scrollY,
    shortAccessibleName: focused.name.value,
    tabFinish: true,
  });
}
// Actual reflow reveal and committed/preview shared ink in a late system.
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await mount(long);
await click('[type=checkbox]');
await button('Place punctum');
const bottomY = await ev(
  `Number(document.querySelector('[data-system-index="23"] .score__staff-line').getAttribute('y1'))-24`,
);
const absolute = await scorePoint(655, bottomY);
await ev(`scrollBy({top:${absolute.y}-innerHeight+24,behavior:'instant'})`);
await pause();
const wrapPoint = await scorePoint(655, bottomY);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...wrapPoint });
await pause();
const previewInk = await ev(
  `document.querySelector('.score__placement-preview .score__ink')?.outerHTML`,
);
assert(previewInk);
const wrapBefore = await ev('scrollY');
await clickAt(wrapPoint);
await pause();
const revealed = await ev(
  `(()=>{const n=document.querySelector('.score__note[aria-pressed=true]');const parent=n.closest('[data-neume-id]');const r=parent.getBoundingClientRect();return {scrollY,top:r.top,bottom:r.bottom,strip:document.querySelector('.editor-context').getBoundingClientRect().bottom,system:Number(parent.closest('[data-system-index]').dataset.systemIndex),ink:parent.querySelector('.score__ink').outerHTML}})()`,
);
assert.equal(revealed.ink, previewInk);
assert(revealed.scrollY > wrapBefore);
assert(revealed.top > revealed.strip);
assert(revealed.bottom <= 900 - 7);
record('late reflow reveal and preview parity', {
  before: wrapBefore,
  after: revealed.scrollY,
  destinationSystem: revealed.system + 1,
  inkMatches: true,
});
// Nested scroll container: focusing a visible late destination preserves both offsets.
await mount(long);
await click('[type=checkbox]');
await button('Place punctum');
await ev(
  `(()=>{const w=document.querySelector('.editor-score-workspace');w.style.height='600px';w.style.overflow='auto';document.querySelector('[data-system-index="23"]').scrollIntoView({block:'center',behavior:'instant'})})()`,
);
await pause();
const nestedBefore = await ev(
  `({window:scrollY,container:document.querySelector('.editor-score-workspace').scrollTop})`,
);
const ny = await ev(
  `Number(document.querySelector('[data-system-index="23"] .score__staff-line').getAttribute('y1'))-24`,
);
await clickAt(await scorePoint(400, ny));
await pause();
const nestedAfter = await ev(
  `({window:scrollY,container:document.querySelector('.editor-score-workspace').scrollTop})`,
);
assert.deepEqual(nestedAfter, nestedBefore);
record('nested scroll preservation', {
  before: nestedBefore,
  after: nestedAfter,
});
// Invalid CTM cannot create a document edit or announcement.
const invalidBefore = await snapshot();
const ctPoint = await scorePoint(400, ny);
await ev(`void(window.savedCTM=document.querySelector('.score').getScreenCTM)`);
await ev(`void(document.querySelector('.score').getScreenCTM=()=>null)`);
await clickAt(ctPoint);
await pause();
assert.equal((await snapshot()).count, invalidBefore.count);
assert.equal((await snapshot()).message, invalidBefore.message);
await ev(`void(document.querySelector('.score').getScreenCTM=window.savedCTM)`);
record('invalid SVG transform', { passed: true });
// Undo removes the only target; keep the same visible Finish/Select control mounted.
await mount({ ...base, syllables: [] });
await click('.editor-lyrics > button');
await button('Place punctum');
await key('z', 2);
assert.equal((await snapshot()).tool, 'Tool: Select/Edit');
assert.equal(
  await ev(
    `document.activeElement===document.querySelector('.editor-context button')`,
  ),
  true,
);
assert.equal(
  (await snapshot()).message,
  'Undo. No target syllable. Placement finished.',
);
record('missing target fallback', { passed: true });
// Default application UI at desktop and narrow sizes.
for (const width of [1440, 390, 320]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: origin });
  for (let i = 0; i < 100; i++) {
    await pause();
    if (
      await ev(
        `document.querySelector('h1')?.textContent==='Gregorian Chant Editor'`,
      )
    )
      break;
  }
  await click('[type=checkbox]');
  await button('Place punctum');
  await ev(
    `document.querySelector('.score').scrollIntoView({block:'nearest',behavior:'instant'})`,
  );
  await clickAt(await scorePoint(300, 100));
  await pause();
  assert.equal((await snapshot()).focus, 'score');
  assert.equal(
    await ev(
      'document.documentElement.scrollWidth<=document.documentElement.clientWidth',
    ),
    true,
  );
  const r = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    out + `/placement-${width}.png`,
    Buffer.from(r.data, 'base64'),
  );
}
await writeFile(
  out + '/browser-results.json',
  JSON.stringify(results, null, 2) + '\n',
);
console.log('ALL CHECKS PASSED');
ws.close();
