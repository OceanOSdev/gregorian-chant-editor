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
const out = 'docs/verification/syllables';
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
  title: 'Syllable entry',
  clef: { type: 'c', staffLine: 3 },
  syllables: [{ id: 's1', text: 'Ky' }],
  neumes: [
    {
      id: 'n1',
      kind: 'punctum',
      lyricSyllableId: 's1',
      notes: [{ id: 'note1', staffPosition: 2 }],
    },
  ],
};
await ev(`mountChantFixture(${JSON.stringify(base)})`);
await pause();
const key = async (key, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    modifiers,
    windowsVirtualKeyCode:
      key.length === 1
        ? key.toUpperCase().charCodeAt(0)
        : ({ Tab: 9, Escape: 27, Enter: 13 }[key] ?? 0),
    ...(key === 'Enter' ? { text: '\r', windowsVirtualKeyCode: 13 } : {}),
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers });
  await pause();
};
const click = async (selector) => {
  await ev(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`,
  );
  const point = await ev(
    `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    ...point,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    ...point,
  });
  await pause();
};
const type = async (text) => {
  await send('Input.insertText', { text });
  await pause();
};
const texts = () =>
  ev(
    `Array.from(document.querySelectorAll('.syllable-strip [data-syllable-id]')).map(b=>b.textContent.trim().replace(/^\\d+\\.\\s*/,''))`,
  );
const active = () =>
  ev(
    `document.querySelector('[data-syllable-id][aria-pressed=true]')?.dataset.syllableId`,
  );
const focus = () =>
  ev(`document.activeElement.id || document.activeElement.dataset.syllableId`);
const screenshot = async (name) => {
  const r = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(`${out}/${name}.png`, Buffer.from(r.data, 'base64'));
};
await click('#new-syllable');
await type('ri');
await screenshot('new-syllable-desktop');
await click('.syllable-form button');
assert.deepEqual(await texts(), ['Ky', 'ri']);
assert.equal(await focus(), 'new-syllable');
assert.equal(await ev(`document.querySelector('#new-syllable').value`), '');
const riId = await active();
assert.notEqual(riId, 's1');
await type('e');
await key('Enter');
assert.deepEqual(await texts(), ['Ky', 'ri', 'e']);
assert.equal(await focus(), 'new-syllable');
await type('  ');
await key('Enter');
assert.equal((await texts()).length, 3);
assert.equal(
  await ev(`document.querySelector('.syllable-form button').disabled`),
  true,
);
await key('z', 2); // Browser input undo must not undo semantic creation.
assert.equal((await texts()).length, 3);
record('creation', {
  enterAndButtonEquivalent: true,
  retainedFocus: true,
  clearedInput: true,
  noOverwrite: true,
  blankRejected: true,
  nativeUndoGuard: true,
});
await click('[data-syllable-id="s1"]');
assert.equal(await active(), 's1');
assert.equal(await focus(), 'edit-syllable');
assert.equal(await ev(`document.querySelector('#edit-syllable').value`), 'Ky');
await key('a', 2);
await type('Kyr');
await screenshot('editing-desktop');
await key('Escape');
assert.deepEqual(await texts(), ['Ky', 'ri', 'e']);
assert.equal(await focus(), 's1');
await click('[data-syllable-id="s1"]');
await key('a', 2);
await type('Kyr');
await key('Enter');
assert.deepEqual(await texts(), ['Kyr', 'ri', 'e']);
assert.equal(await focus(), 's1');
assert.equal(
  await ev(`document.querySelectorAll('[data-note-id="note1"]').length`),
  1,
);
await click('[aria-label="Undo last edit"]');
assert.deepEqual(await texts(), ['Ky', 'ri', 'e']);
await click('[aria-label="Redo last undone edit"]');
assert.deepEqual(await texts(), ['Kyr', 'ri', 'e']);
await click('[data-syllable-id="s1"]');
await type('draft');
await click('.syllable-edit button[type="button"]');
assert.deepEqual(await texts(), ['Kyr', 'ri', 'e']);
await click('[aria-label="Undo last edit"]');
assert.deepEqual(await texts(), ['Ky', 'ri', 'e']); // Cancel added no history.
await click('[aria-label="Redo last undone edit"]');
record('editing', {
  populated: true,
  enterSave: true,
  cancelAndEscape: true,
  cancelNoHistory: true,
  stableIdAndNote: true,
  undoRedo: true,
  focusReturned: true,
});
await click('[data-syllable-id="s1"]');
await type('discard');
await click(`[data-syllable-id="${riId}"]`);
assert.equal(await active(), riId);
assert.equal(await ev(`document.querySelector('#edit-syllable').value`), 'ri');
await key('a', 2);
await type('ree');
await click('.syllable-edit button[type="submit"]');
assert.deepEqual(await texts(), ['Kyr', 'ree', 'e']);
// Creation draft stays separate; blurring the edit never saves it.
await click('[data-syllable-id="s1"]');
await type('discard');
await click('#new-syllable');
await key('a', 2);
await type('lei');
await key('Enter');
assert.deepEqual(await texts(), ['Kyr', 'ree', 'e', 'lei']);
await click('[aria-label="Undo last edit"]');
assert.deepEqual(await texts(), ['Kyr', 'ree', 'e']);
await click('[aria-label="Redo last undone edit"]');
assert.deepEqual(await texts(), ['Kyr', 'ree', 'e', 'lei']);
// IME Enter is ignored by both forms; synthetic composition supplements native typing.
await click('#new-syllable');
await type('son');
await ev(
  `document.querySelector('#new-syllable').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}))`,
);
assert.equal((await texts()).length, 4);
await key('Enter');
const sonId = await active();
await click('[data-tool="punctum"]');
const point = await ev(
  `(()=>{const s=document.querySelector('.score');const p=new DOMPoint(300,100).matrixTransform(s.getScreenCTM());return {x:p.x,y:p.y}})()`,
);
await send('Input.dispatchMouseEvent', {
  type: 'mousePressed',
  button: 'left',
  clickCount: 1,
  ...point,
});
await send('Input.dispatchMouseEvent', {
  type: 'mouseReleased',
  button: 'left',
  clickCount: 1,
  ...point,
});
await pause();
assert.equal(await active(), sonId);
assert.equal(await ev(`document.querySelectorAll('[data-note-id]').length`), 2);
assert.match(
  await ev(
    `document.querySelector('.score').getAttribute('aria-describedby') || ''`,
  ),
  /./,
);
await key('Escape');
record('targets and drafts', {
  switching: true,
  saveButton: true,
  blurNoCommit: true,
  creationUndoRedo: true,
  compositionGuard: true,
  graphicalPlacement: true,
});
for (const width of [390, 320]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await click('#new-syllable');
  await screenshot(`new-syllable-${width}`);
  await click('[data-syllable-id="s1"]');
  await screenshot(`editing-${width}`);
  assert.equal(
    await ev(`document.documentElement.scrollWidth <= innerWidth`),
    true,
  );
  await key('Tab');
  assert.equal(await ev(`document.activeElement.textContent.trim()`), 'Save');
  await key('Tab');
  assert.equal(await ev(`document.activeElement.textContent.trim()`), 'Cancel');
  await key('Enter');
  assert.equal(await focus(), 's1');
  record(`responsive ${width}`, {
    noPageOverflow: true,
    keyboardSaveCancel: true,
  });
}
// Cancel must not restore an old selection or undo an unrelated note move.
await click('[data-syllable-id="s1"]');
await type('unsaved');
await click('[data-note-id="note1"]');
const beforeY = await ev(
  `document.querySelector('[data-note-id="note1"]').outerHTML`,
);
await key('ArrowUp');
const afterY = await ev(
  `document.querySelector('[data-note-id="note1"]').outerHTML`,
);
assert.notEqual(afterY, beforeY);
await click('.syllable-edit button[type="button"]');
assert.equal(
  await ev(
    `document.querySelector('[data-note-id="note1"]').getAttribute('aria-pressed')`,
  ),
  'true',
);
assert.equal(
  await ev(`document.querySelector('[data-note-id="note1"]').outerHTML`),
  afterY,
);
record('cancel isolation', {
  noteMovePreserved: true,
  selectionPreserved: true,
});
// Keep large lyric sequences in one scrollable row, with no page overflow.
await ev(
  `mountChantFixture({...${JSON.stringify(base)},syllables:Array.from({length:80},(_,i)=>({id:'long-'+i,text:'syllable'+i})),neumes:[]})`,
);
await pause();
assert.equal(
  await ev(`document.documentElement.scrollWidth <= innerWidth`),
  true,
);
assert.equal(
  await ev(
    `document.querySelector('.syllable-strip').scrollWidth > document.querySelector('.syllable-strip').clientWidth`,
  ),
  true,
);
await click('#new-syllable');
await type('draft');
await click('[data-syllable-id="long-0"]');
assert.equal(
  await ev(`document.querySelector('#new-syllable').value`),
  'draft',
);
await ev(
  `document.querySelector('#edit-syllable').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}))`,
);
assert.equal(await focus(), 'edit-syllable');
await key('Escape');
record('long sequence and drafts', {
  horizontalScroll: true,
  noPageOverflow: true,
  creationDraftPreserved: true,
  editCompositionGuard: true,
});
await writeFile(
  `${out}/browser-results.json`,
  JSON.stringify(results, null, 2) + '\n',
);
ws.close();
