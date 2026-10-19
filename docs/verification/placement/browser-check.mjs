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
      ArrowRight: 39,
      ArrowLeft: 37,
      Home: 36,
      End: 35,
      ' ': 32,
      z: 90,
      Backspace: 8,
    }[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
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
  ev(`({
 count:document.querySelectorAll('[data-neume-kind]').length,
 notes:Array.from(document.querySelectorAll('[data-note-id]')).map(n=>({id:n.dataset.noteId,disabled:n.getAttribute('aria-disabled'),tab:n.tabIndex})),
 tool:document.querySelector('.neume-palette [aria-pressed=true]').dataset.tool,
 insert:document.querySelector('.editor-insert').textContent.trim(),
 target:document.querySelector('select[aria-label="Active syllable"]').value,
 focus:document.activeElement.classList.contains('score')?'score':document.activeElement.dataset.noteId??document.activeElement.dataset.tool??document.activeElement.id??document.activeElement.tagName,
 preview:!!document.querySelector('.score__placement-preview'),scrollY,
 message:document.querySelector('[role=status]').textContent})`);
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
const choose = (kind) => click(`[data-tool="${kind}"]`);
const focus = (selector) =>
  ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);
const selectedPitch = () =>
  ev(
    `document.querySelector('.score__note[aria-pressed=true] .score__note-hit-target')?.getAttribute('y')`,
  );
// Native keyboard-only entry, including actual browser Tab traversal.
await mount();
await focus('[data-tool=select]');
await key('Tab');
assert(await ev(`document.activeElement.matches('.editor-insert')`));
await key('Enter');
assert.equal((await snapshot()).count, 1);
assert.equal((await snapshot()).focus, (await snapshot()).notes[0].id);
const firstPitch = await selectedPitch();
await key('ArrowUp');
assert.notEqual(await selectedPitch(), firstPitch);
await key('i');
assert.equal((await snapshot()).count, 2);
const second = (await snapshot()).notes[1].id;
await key('t');
assert.equal((await snapshot()).focus, 'punctum');
assert.equal((await snapshot()).tool, 'select');
await key('ArrowRight');
assert.equal((await snapshot()).focus, 'podatus');
assert.equal((await snapshot()).tool, 'select');
assert((await snapshot()).insert.startsWith('Insert Punctum'));
assert.equal(
  await ev(`document.querySelectorAll('.neume-palette [tabindex="0"]').length`),
  1,
);
await key('Enter');
assert.equal((await snapshot()).tool, 'podatus');
await key('i');
assert.equal((await snapshot()).tool, 'select');
assert.equal((await notation())[2].kind, 'podatus');
const podatusFirst = (await notation())[2].notes[0];
assert.equal((await snapshot()).focus, podatusFirst);
await key('Tab', 8);
assert.equal((await snapshot()).focus, second);
await key('Enter');
const priorPitch = await selectedPitch();
await key('ArrowDown');
assert.notEqual(await selectedPitch(), priorPitch);
await key('t');
await key('Tab');
assert(await ev(`document.activeElement.matches('.editor-insert')`));
await key('Tab');
assert(
  await ev(
    `document.activeElement.matches('select[aria-label="Active syllable"]')`,
  ),
);
await key('ArrowDown');
assert.equal((await snapshot()).target, 's2');
await key('Tab', 8);
await key('Enter');
assert.equal((await snapshot()).count, 4);
assert.equal((await notation())[3].kind, 'podatus');
assert.equal((await snapshot()).target, 's2');
record('keyboard-only entry and real Tab order', {
  passed: true,
  sequence:
    'Insert → ↑ → I → T → Right → Enter → I → Shift+Tab → Enter → ↓ → T → Tab → Tab → syllable → Shift+Tab → Enter',
});
// Palette browsing is independent from active tool and remembered kind.
await key('t');
await key('End');
assert.equal((await snapshot()).focus, 'porrectus');
assert.equal((await snapshot()).tool, 'select');
assert((await snapshot()).insert.startsWith('Insert Podatus'));
await key(' ');
assert.equal((await snapshot()).tool, 'porrectus');
await key('Escape');
assert.equal((await snapshot()).tool, 'select');
assert((await snapshot()).insert.startsWith('Insert Porrectus'));
await key('t');
assert.equal((await snapshot()).focus, 'porrectus');
record('roving focus and remembered kind', { passed: true });
for (const kind of kinds) {
  await mount();
  await choose(kind);
  const p = await scorePoint();
  await clickAt(p);
  await pause();
  let s = await snapshot();
  assert.equal(s.count, 1);
  assert.equal(s.tool, kind);
  assert.equal(s.focus, 'score');
  assert.equal(s.preview, false);
  assert(s.notes.every((n) => n.disabled === 'true' && n.tab === -1));
  await clickAt(p);
  await pause();
  assert.equal((await snapshot()).count, 2);
  await key('Escape');
  s = await snapshot();
  assert.equal(s.tool, 'select');
  assert.equal(s.focus, s.notes.find((n) => n.id === s.focus)?.id);
  assert(s.notes.every((n) => n.disabled === 'false' && n.tab === 0));
  await choose(kind);
  await click('.editor-insert');
  s = await snapshot();
  assert.equal(s.count, 3);
  assert.equal(s.tool, 'select');
  assert.equal((await notation())[2].kind, kind);
  assert.equal(s.focus, (await notation())[2].notes[0]);
  assert.equal(
    (await ev('focusCalls')).filter((c) => c.disabled === 'true').length,
    0,
  );
  record('persistent kind and contextual insertion', { kind, passed: true });
}
// Prospective systems replace visible ink without changing committed controls.
for (const scenario of ['new-system', 'reflow-existing']) {
  const document = {
    ...base,
    clef: { type: 'c', staffLine: 2 },
    neumes: Array.from({ length: 10 }, (_, i) => ({
      id: 'wrap' + i,
      kind: 'punctum',
      lyricSyllableId: scenario === 'reflow-existing' && i === 9 ? 's2' : 's1',
      notes: [{ id: 'wrap-note' + i, staffPosition: 2 }],
    })),
  };
  await mount(document);
  const original = await notation();
  const kind = scenario === 'new-system' ? 'punctum' : 'torculus';
  await choose(kind);
  const point = await scorePoint(scenario === 'new-system' ? 655 : 220, 100);
  const show = async () => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await pause();
  };
  await show();
  assert.equal(
    await ev(`document.querySelectorAll('[data-preview-system-index]').length`),
    2,
  );
  assert.equal(
    await ev(
      `document.querySelectorAll('[data-preview-system-index="1"] .score__staff-line').length`,
    ),
    4,
  );
  assert.equal(
    await ev(
      `document.querySelector('[data-preview-system-index="1"] .score__clef').textContent.trim()`,
    ),
    'C',
  );
  assert(
    await ev(
      `document.querySelector('[aria-label="Undo last edit"]').disabled`,
    ),
  );
  assert.deepEqual(await notation(), original);
  assert(
    await ev(
      `(()=>{const s=document.querySelector('.score__preview-scene');return s.getAttribute('aria-hidden')==='true'&&getComputedStyle(s).pointerEvents==='none'&&!s.querySelector('[role], [tabindex], [data-note-id], [data-neume-id]')})()`,
    ),
  );
  assert(
    await ev(
      `(()=>{const p=document.elementFromPoint(${point.x},${point.y});return !p.closest('.score__preview-scene')})()`,
    ),
  );
  if (scenario === 'reflow-existing')
    assert(
      await ev(
        `Array.from(document.querySelectorAll('[data-preview-system-index="1"] .score__lyric')).some(n=>n.textContent==='ri')`,
      ),
    );
  await key('Escape');
  assert.equal((await snapshot()).preview, false);
  assert.equal(
    await ev(`document.querySelector('.score__preview-scene')`),
    null,
  );
  assert.deepEqual(await notation(), original);
  assert(
    await ev(
      `document.querySelector('[aria-label="Undo last edit"]').disabled`,
    ),
  );
  await choose(kind);
  await show();
  const prospective = await ev(
    `Array.from(document.querySelectorAll('[data-preview-neume] > .score__ink')).map(n=>n.outerHTML)`,
  );
  const prospectiveStaff = await ev(
    `Array.from(document.querySelectorAll('.score__preview-scene .score__staff-line,.score__preview-scene .score__clef')).map(n=>n.outerHTML)`,
  );
  const previewImage = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    out + '/' + scenario + '-before.png',
    Buffer.from(previewImage.data, 'base64'),
  );
  await clickAt(point);
  await pause();
  assert.equal((await snapshot()).count, 11);
  assert.equal((await snapshot()).tool, kind);
  assert.equal((await snapshot()).preview, false);
  assert.equal(
    await ev(`document.querySelectorAll('[data-system-index]').length`),
    2,
  );
  assert.deepEqual(
    await ev(
      `Array.from(document.querySelectorAll('[data-neume-id] > .score__ink')).map(n=>n.outerHTML)`,
    ),
    prospective,
  );
  assert.deepEqual(
    await ev(
      `Array.from(document.querySelectorAll('[data-system-index] .score__staff-line,[data-system-index] .score__clef')).map(n=>n.outerHTML)`,
    ),
    prospectiveStaff,
  );
  const afterImage = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    out + '/' + scenario + '-after.png',
    Buffer.from(afterImage.data, 'base64'),
  );
  const inserted = await notation();
  await key('z', 2);
  assert.deepEqual(await notation(), original);
  await key('z', 10);
  assert.deepEqual(await notation(), inserted);
  record('prospective wrapping scene', {
    scenario,
    systems: 2,
    staffAndClefParity: true,
    allInkParity: true,
    decorative: true,
    cancellationNoHistory: true,
    atomicHistory: true,
  });
}
await mount();
await choose('clivis');
await clickAt(await scorePoint());
await pause();
await key('i');
assert.equal((await snapshot()).tool, 'select');
assert.equal((await notation())[1].kind, 'clivis');
assert.equal((await snapshot()).focus, (await notation())[1].notes[0]);
await key('Enter', 8);
await choose('podatus');
await choose('select');
assert.equal((await snapshot()).focus, (await notation())[1].notes[0]);
record('surface I and whole-neume Select focus', { passed: true });
await mount();
await choose('punctum');
const p = await scorePoint();
for (let i = 0; i < 12; i++) await clickAt(p);
await pause();
assert.equal((await snapshot()).count, 12);
assert.equal((await snapshot()).preview, false);
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
await ev(
  `(()=>{const s=document.querySelector('.score');const p=new DOMPoint(300,100).matrixTransform(s.getScreenCTM());for(let i=0;i<30;i++)s.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:p.x,clientY:p.y}))})()`,
);
await pause();
assert.equal((await snapshot()).count, 42);
record('rapid clicks and atomic history', {
  trustedClicks: 12,
  sameBatchClicks: 30,
  exactIdsRestored: true,
  successMutations: 12,
});
const invalidBefore = await notation();
const msgCount = await ev('messages.length');
await clickAt(await scorePoint(0, 100));
await pause();
assert.deepEqual(await notation(), invalidBefore);
await choose('punctum');
await send('Input.dispatchMouseEvent', {
  type: 'mouseMoved',
  ...(await scorePoint(400, 88)),
});
await pause();
assert.equal((await snapshot()).preview, true);
assert.equal(await ev('messages.length'), msgCount);
await choose('podatus');
assert.equal((await snapshot()).preview, false);
await choose('select');
assert.equal((await snapshot()).tool, 'select');
record('invalid intent, silent preview, switching and Select', {
  passed: true,
});
// Text/native controls, composition, modifiers, and unrelated controls never insert.
await mount();
await click('.editor-insert');
const beforeSafeguards = await notation();
await ev(
  `(()=>{for(const tag of ['textarea','div']){const n=document.createElement(tag);n.id='guard-'+tag;if(tag==='div')n.contentEditable='true';document.querySelector('main').append(n)}})()`,
);
for (const selector of [
  '#lyric-syllable',
  'select[aria-label="Active syllable"]',
  '#guard-textarea',
  '#guard-div',
  'button[aria-label="Add syllable"]',
]) {
  await focus(selector);
  await key('i');
  await key('t');
  assert.deepEqual(await notation(), beforeSafeguards);
  assert(
    await ev(`document.activeElement.matches(${JSON.stringify(selector)})`),
  );
}
await focus('[data-note-id]');
for (const options of [
  { isComposing: true },
  { ctrlKey: true },
  { altKey: true },
  { metaKey: true },
  { shiftKey: true },
  { repeat: true },
]) {
  await ev(
    `(()=>{const n=document.activeElement;for(const key of ['i','t'])n.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...${JSON.stringify(options)}}))})()`,
  );
  assert.deepEqual(await notation(), beforeSafeguards);
  assert(await ev(`document.activeElement.matches('[data-note-id]')`));
}
await click('#lyric-syllable');
await key('Home');
await send('Input.insertText', { text: 'draft' });
await key('z', 2);
assert.equal(await ev(`document.querySelector('#lyric-syllable').value`), 'Ky');
await key('z', 10);
assert(
  (await ev(`document.querySelector('#lyric-syllable').value`)).includes(
    'draft',
  ),
);
await key('Escape');
assert.equal(await ev(`document.querySelector('#lyric-syllable').value`), 'Ky');
assert.deepEqual(await notation(), beforeSafeguards);
record('text, native select, scope, IME and modifier safeguards', {
  passed: true,
  realIme: false,
});
await mount();
await choose('punctum');
await clickAt(await scorePoint());
await pause();
const guarded = await notation();
await ev(
  `(()=>{const n=document.querySelector('[data-note-id]');for(const key of ['ArrowUp','ArrowDown','Delete','Backspace','Enter',' '])n.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}))})()`,
);
await key('ArrowUp');
await key('Enter');
assert.deepEqual(await notation(), guarded);
await focus('select[aria-label="Active syllable"]');
await key('ArrowDown');
assert.equal((await snapshot()).message, 'Target: syllable 2, ri.');
assert.equal((await snapshot()).tool, 'punctum');
await choose('select');
assert.equal((await snapshot()).focus, 'select');
assert.equal(
  await ev(
    `document.querySelector('.neume-palette [tabindex="0"]').dataset.tool`,
  ),
  'select',
);
await choose('podatus');
await click('[aria-label="Add syllable"]');
assert.equal(await ev('document.activeElement.id'), 'lyric-syllable');
assert.equal((await snapshot()).message, 'Target: syllable 3, empty.');
await key('Tab');
await key('z', 2);
assert.equal((await snapshot()).target, 's2');
record('disabled note guards, target changes, fallback and lyric autofocus', {
  passed: true,
});
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
  await choose('punctum');
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
  const ax = await send('Accessibility.getFullAXTree');
  const focused = ax.nodes.find(
    (n) =>
      n.role?.value === 'group' &&
      n.properties?.some((p) => p.name === 'focused' && p.value.value),
  );
  assert.equal(focused?.name?.value, 'Score placement');
  assert.equal(
    focused?.description?.value,
    'Punctum. Target syllable 1, Ky. Escape selects the editing tool.',
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
  await ev(`document.querySelector('.score').focus({preventScroll:true})`);
  await key('Escape');
  assert.equal(
    (await snapshot()).focus,
    s.notes.find((n) => !n.id.startsWith('long'))?.id,
  );
  const focusBounds = await ev(
    `(()=>{const r=document.activeElement.getBoundingClientRect();return {top:r.top,bottom:r.bottom,scrollY}})()`,
  );
  // Browser scroll offsets round to CSS pixels; allow half a pixel at the margin.
  assert(focusBounds.top >= 7.5 && focusBounds.bottom <= 892.5);
  const restoredNote = (await snapshot()).focus;
  await key('ArrowUp');
  await key('z', 2);
  await key('z', 10);
  assert.equal((await snapshot()).focus, restoredNote);
  await key('i');
  assert.equal((await snapshot()).count, 362);
  assert.equal((await snapshot()).tool, 'select');
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-pressed')`),
    'true',
  );
  assert(
    await ev(
      `(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=7.5&&r.bottom<=innerHeight-7.5})()`,
    ),
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
    escapeRestoresFocus: true,
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
await choose('punctum');
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
  `(()=>{const n=document.querySelector('.score__note[aria-pressed=true]');const parent=n.closest('[data-neume-id]');const r=parent.getBoundingClientRect();return {scrollY,top:r.top,bottom:r.bottom,system:Number(parent.closest('[data-system-index]').dataset.systemIndex),ink:parent.querySelector('.score__ink').outerHTML}})()`,
);
assert.equal(revealed.ink, previewInk);
assert(revealed.scrollY > wrapBefore);
assert(revealed.top >= 8);
assert(revealed.bottom <= 900 - 7);
record('late reflow reveal and preview parity', {
  before: wrapBefore,
  after: revealed.scrollY,
  destinationSystem: revealed.system + 1,
  inkMatches: true,
});
// Nested scroll container: focusing a visible late destination preserves both offsets.
await mount(long);
await choose('punctum');
await ev(
  `(()=>{const w=document.createElement('div');w.className='verification-scroll';const s=document.querySelector('.score');s.before(w);w.append(s);w.style.height='600px';w.style.overflow='auto';document.querySelector('[data-system-index="23"]').scrollIntoView({block:'center',behavior:'instant'})})()`,
);
await pause();
const nestedBefore = await ev(
  `({window:scrollY,container:document.querySelector('.verification-scroll').scrollTop})`,
);
const ny = await ev(
  `Number(document.querySelector('[data-system-index="23"] .score__staff-line').getAttribute('y1'))-24`,
);
await clickAt(await scorePoint(400, ny));
await pause();
const nestedAfter = await ev(
  `({window:scrollY,container:document.querySelector('.verification-scroll').scrollTop})`,
);
assert.deepEqual(nestedAfter, nestedBefore);
record('nested scroll preservation', {
  before: nestedBefore,
  after: nestedAfter,
});
// Invalid CTM cannot create a document edit or announcement.
const invalidTransformBefore = await snapshot();
const ctPoint = await scorePoint(400, ny);
await ev(`void(window.savedCTM=document.querySelector('.score').getScreenCTM)`);
await ev(`void(document.querySelector('.score').getScreenCTM=()=>null)`);
await clickAt(ctPoint);
await pause();
assert.equal((await snapshot()).count, invalidTransformBefore.count);
assert.equal((await snapshot()).message, invalidTransformBefore.message);
await ev(`void(document.querySelector('.score').getScreenCTM=window.savedCTM)`);
record('invalid SVG transform', { passed: true });
// Undo removes the only target and restores the palette Select stop.
await mount({ ...base, syllables: [] });
await click('[aria-label="Add syllable"]');
await choose('punctum');
await key('z', 2);
assert.equal((await snapshot()).tool, 'select');
assert.equal((await snapshot()).focus, 'select');
assert.equal(
  (await snapshot()).message,
  'Undo. No target syllable. Select tool.',
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
  await choose('punctum');
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
  await focus('[data-tool=select]');
  for (const selector of [
    '.editor-insert',
    'select[aria-label="Active syllable"]',
    '[aria-label="Add syllable"]',
    '#lyric-syllable',
    '[aria-label="Undo last edit"]',
    'summary',
  ]) {
    await key('Tab');
    assert(
      await ev(`document.activeElement.matches(${JSON.stringify(selector)})`),
    );
    assert(
      await ev(
        `(()=>{const r=document.activeElement.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`,
      ),
    );
  }
  await ev(`document.querySelector('.score').focus({preventScroll:true})`);
  record('responsive layout', { width, noOverflow: true });
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
