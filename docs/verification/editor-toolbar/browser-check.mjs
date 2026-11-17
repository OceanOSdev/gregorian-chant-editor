import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Readability M1: notation palette presentation state and editor action bar
// against the real production editor. Covers roving focus, remembered division
// kind, palette focus requests (T), New/Import presentation reset, the sticky
// toolbar's data-too-tall observer, and the action bar's clipboard/history
// buttons. Standalone CDP (Chromium) / WebDriver BiDi (Firefox) driver.
const output = await mkdtemp(join(tmpdir(), 'chant-editor-toolbar-'));
console.log(`Screenshots: ${output}`);
const firefox = Boolean(process.env.CHANT_FIREFOX_URL);
const pages = firefox
  ? []
  : await (
      await fetch(
        process.env.CHANT_CHROMIUM_URL ?? 'http://127.0.0.1:9230/json',
      )
    ).json();
const ws = new WebSocket(
  process.env.CHANT_FIREFOX_URL ??
    pages.find((p) => p.type === 'page').webSocketDebuggerUrl,
);
await new Promise((resolve) => ws.addEventListener('open', resolve));
let serial = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  }
});
const rawSend = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, (m) =>
      m.error || m.type === 'error'
        ? reject(Error(method + ': ' + JSON.stringify(m)))
        : resolve(m.result),
    );
    ws.send(JSON.stringify({ id, method, params }));
  });
let context;
let ownsSession = false;
const url = process.env.CHANT_PREVIEW_URL ?? 'http://127.0.0.1:4173/';
const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

async function ev(expression) {
  if (firefox) {
    const r = await rawSend('script.evaluate', {
      expression: `(async()=>JSON.stringify(await (${expression})))()`,
      target: { context },
      awaitPromise: true,
    });
    if (r.type === 'exception') throw Error(JSON.stringify(r));
    return r.result.value === undefined
      ? undefined
      : JSON.parse(r.result.value);
  }
  const r = await rawSend('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

async function viewport(width, height) {
  if (firefox)
    await rawSend('browsingContext.setViewport', {
      context,
      viewport: { width, height },
    });
  else
    await rawSend('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  await pause(300);
}

async function navigate() {
  if (firefox)
    await rawSend('browsingContext.navigate', {
      context,
      url,
      wait: 'complete',
    });
  else await rawSend('Page.navigate', { url });
  for (let i = 0; i < 60; i++) {
    await pause();
    if (await ev(`!!document.querySelector('.neume-palette')`)) return;
  }
  throw Error('Editor did not load');
}

async function shot(name) {
  const { data } = firefox
    ? await rawSend('browsingContext.captureScreenshot', {
        context,
        origin: 'viewport',
        format: { type: 'image/png' },
      })
    : await rawSend('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
}

const webDriverKeys = {
  ArrowLeft: '',
  ArrowUp: '',
  ArrowRight: '',
  ArrowDown: '',
  Enter: '',
  Escape: '',
  Tab: '',
  Home: '',
  End: '',
};
const virtualKeyCodes = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Enter: 13,
  Escape: 27,
  Tab: 9,
  Home: 36,
  End: 35,
};

/** One trusted key press through the browser's input pipeline. */
async function key(name, { shift = false } = {}) {
  if (firefox) {
    const value = webDriverKeys[name] ?? name;
    const shiftKey = '\uE008';
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            ...(shift ? [{ type: 'keyDown', value: shiftKey }] : []),
            { type: 'keyDown', value },
            { type: 'keyUp', value },
            ...(shift ? [{ type: 'keyUp', value: shiftKey }] : []),
          ],
        },
      ],
    });
  } else {
    const printable = name.length === 1;
    const params = {
      key: name,
      code: printable ? `Key${name.toUpperCase()}` : name,
      windowsVirtualKeyCode: printable
        ? name.toUpperCase().charCodeAt(0)
        : virtualKeyCodes[name],
      modifiers: shift ? 8 : 0,
    };
    await rawSend('Input.dispatchKeyEvent', {
      type: 'keyDown',
      ...params,
      ...(printable || name === 'Enter'
        ? { text: name === 'Enter' ? '\r' : name }
        : {}),
    });
    await rawSend('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
  }
  await pause(150);
}

async function clickSelector(selector) {
  const point = await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const t=e.closest('.editor-sticky-toolbar');if(!t||getComputedStyle(t).position!=='sticky')e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  if (firefox)
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'pointer',
          id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            {
              type: 'pointerMove',
              x: Math.round(point.x),
              y: Math.round(point.y),
              origin: 'viewport',
            },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    });
  else
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await rawSend('Input.dispatchMouseEvent', {
        type,
        ...point,
        button: 'left',
        clickCount: 1,
      });
  await pause(200);
}

const focusedTool = () =>
  ev(
    `document.activeElement?.dataset?.tool ?? document.activeElement?.dataset?.variant ?? document.activeElement?.tagName`,
  );
const rovingStops = () =>
  ev(
    `[...document.querySelectorAll('.neume-palette button[tabindex="0"]')].map(b=>b.dataset.tool)`,
  );
const pressed = (tool) =>
  ev(
    `document.querySelector('.neume-palette [data-tool="${tool}"]').getAttribute('aria-pressed')`,
  );
const noteCount = () =>
  ev(`document.querySelectorAll('[data-note-id]').length`);
/**
 * The `focusRequest` prop NotationPalette last rendered with, read from the
 * React fiber attached to its toolbar element (`__reactFiber$…`, present in
 * production builds), switched to its current-tree twin when the DOM node
 * still references the alternate. Test-only introspection: it shows whether the session
 * still holds the palette request after the palette handled it.
 */
const paletteFocusRequest = () =>
  ev(
    `(()=>{const e=document.querySelector('.neume-palette');const k=Object.keys(e).find(k=>k.startsWith('__reactFiber$'));if(!k)throw Error('No React fiber on .neume-palette');const isPalette=f=>f.memoizedProps&&typeof f.memoizedProps==='object'&&'onFocusRequestHandled' in f.memoizedProps;let f=e[k];while(f&&!isPalette(f))f=f.return;if(!f)throw Error('NotationPalette fiber not found');const inCurrentTree=f=>{let r=f;while(r.return)r=r.return;return r.stateNode&&r.stateNode.current===r};const current=inCurrentTree(f)?f:f.alternate;if(!current||!inCurrentTree(current))throw Error('No current NotationPalette fiber');return current.memoizedProps.focusRequest})()`,
  );
const storageKey = 'gregorian-chant-editor:active-document:v1';
const selectionFingerprint = () =>
  ev(
    `[document.querySelectorAll('.score [class*="--selected"], .score [data-selected-neume-id]').length, !!document.querySelector('.note-context-toolbar, [aria-label*="note properties" i]')].join('|')`,
  );
const focusTool = async (tool) => {
  await ev(
    `document.querySelector('.neume-palette [data-tool="${tool}"]').focus()`,
  );
  await pause();
};
/** Opens the Division variants menu and returns its initially focused item. */
async function openDivisionMenu() {
  // Arrive by keyboard: headless Firefox script focus() emits no focus events.
  await focusTool('select');
  await key('End');
  assert.equal(await focusedTool(), 'division-menu');
  await key('Enter');
  assert.equal(
    await ev(
      `document.querySelector('.division-menu .neume-family-menu__arrow').getAttribute('aria-expanded')`,
    ),
    'true',
    'Enter opens the Division variants menu',
  );
  return focusedTool();
}

const importFixture = {
  format: 'gregorian-chant-editor',
  version: 10,
  document: {
    accidentals: [],
    title: 'Toolbar import',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: 6 }, (_, i) => ({
      id: 'n' + i,
      kind: 'punctum',
      notes: [{ id: 'note' + i, staffPosition: i % 4 }],
    })),
    syllables: [
      { id: 's1', text: 'Ky', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    ],
    divisions: [],
    clefChanges: [],
  },
};

/** Leaves remembered roving and division memory that a reset must clear. */
async function dirtyPaletteMemory() {
  assert.equal(await openDivisionMenu(), 'minima');
  await key('ArrowDown');
  await key('Enter');
  assert.equal(await focusedTool(), 'division-menu', 'choice returns focus');
  assert.equal(
    await ev(
      `document.querySelector('[data-tool="division-menu"]').dataset.activeVariant`,
    ),
    'minor',
  );
  await key('Escape'); // Global Escape returns to the editing tool.
  assert.equal(await pressed('select'), 'true');
  assert.equal(
    await openDivisionMenu(),
    'minor',
    'menu reopens at the remembered division kind',
  );
  await key('Escape');
  assert.equal(await focusedTool(), 'division-menu', 'Escape closes menu');
  assert.deepEqual(await rovingStops(), ['division-menu']);
}

async function assertPaletteReset(label) {
  assert.deepEqual(
    await rovingStops(),
    ['select'],
    `${label}: roving stop returns to Select`,
  );
  assert.equal(
    await openDivisionMenu(),
    'minima',
    `${label}: remembered division kind resets`,
  );
  await key('Escape');
  // Button refs are live after replacement: arrow browsing still moves focus.
  await focusTool('select');
  await key('ArrowRight');
  assert.equal(await focusedTool(), 'punctum', `${label}: refs still live`);
  assert.deepEqual(await rovingStops(), ['punctum']);
}

async function checkStickyThreshold(label) {
  await pause(300);
  const state = await ev(
    `(()=>{const t=document.querySelector('.editor-sticky-toolbar');return {flag:t.dataset.tooTall,expected:String(t.getBoundingClientRect().height>innerHeight/2),position:getComputedStyle(t).position,height:Math.round(t.getBoundingClientRect().height)}})()`,
  );
  assert.equal(
    state.flag,
    state.expected,
    `${label}: data-too-tall tracks toolbar height (${state.height}px)`,
  );
  console.log(
    `  sticky ${label}: data-too-tall=${state.flag} position=${state.position} height=${state.height}`,
  );
  return state;
}

try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  await viewport(1440, 1100);
  await navigate();
  await ev(`localStorage.clear()`);
  await navigate();

  // 1. Initial roving stop and keyboard browsing without arming anything.
  assert.deepEqual(await rovingStops(), ['select']);
  assert.equal(await pressed('select'), 'true');
  await focusTool('select');
  await key('ArrowRight');
  assert.equal(await focusedTool(), 'punctum');
  await key('ArrowRight');
  assert.equal(await focusedTool(), 'punctum-menu');
  await key('End');
  assert.equal(await focusedTool(), 'division-menu');
  await key('Home');
  assert.equal(await focusedTool(), 'select');
  await key('ArrowLeft');
  assert.equal(await focusedTool(), 'division-menu', 'ArrowLeft wraps');
  assert.deepEqual(await rovingStops(), ['division-menu']);
  assert.equal(await pressed('select'), 'true', 'browsing never arms a tool');
  console.log('PASS: roving focus, Home/End/wrap, browsing does not arm');

  // 2. Remembered division kind and New resets presentation memory.
  await dirtyPaletteMemory();
  await ev(`window.confirm=()=>true`);
  const newButton = await ev(
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='New')`,
  );
  assert.ok(newButton, 'New button exists');
  await ev(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New');b.setAttribute('data-toolbar-check','new')})()`,
  );
  await clickSelector('[data-toolbar-check="new"]');
  await pause(300);
  assert.equal(await noteCount(), 0, 'New replaced the score');
  await assertPaletteReset('New');
  console.log('PASS: New resets roving stop and remembered division kind');

  // 3. Import resets presentation memory too.
  await dirtyPaletteMemory();
  await ev(
    `(()=>{const input=document.querySelector('input[type="file"]');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(importFixture))}],'score.chant.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause(500);
  assert.equal(await noteCount(), 6, 'Import replaced the score');
  await assertPaletteReset('Import');
  console.log('PASS: Import resets roving stop and remembered division kind');

  // 3b. Recovery reload: a foreign autosave (as another tab would write) is
  // detected on window focus; Load cached score reloads it and must reset
  // presentation memory through the same path as New/Import.
  await dirtyPaletteMemory();
  const cached = {
    ...importFixture,
    document: { ...importFixture.document, title: 'Reloaded cache' },
  };
  await ev(
    `(localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(cached))}),window.dispatchEvent(new Event('focus')),true)`,
  );
  await pause(300);
  await ev(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Load cached score');if(!b)throw Error('No recovery after foreign autosave');b.setAttribute('data-toolbar-check','reload')})()`,
  );
  await clickSelector('[data-toolbar-check="reload"]');
  await pause(300);
  assert.match(
    await ev(
      `document.querySelector('section[aria-label="Document"]').textContent`,
    ),
    /Reloaded cache/,
    'reload loaded the cached score',
  );
  await assertPaletteReset('Reload');
  console.log('PASS: recovery reload resets roving stop and division kind');

  // 4. T from the score focuses the remembered tool without selection, and
  // the handled palette request is cleared from the session.
  await ev(`document.querySelector('[data-note-id="note2"]').focus()`);
  await pause();
  const before = await selectionFingerprint();
  await key('t');
  assert.equal(await focusedTool(), 'punctum', 'T reaches Punctum');
  assert.deepEqual(await rovingStops(), ['punctum']);
  assert.equal(await selectionFingerprint(), before, 'T changes no selection');
  assert.equal(
    await paletteFocusRequest(),
    null,
    'handled palette focus request is acknowledged (cleared)',
  );
  await key('ArrowRight');
  await pause(300);
  assert.equal(
    await focusedTool(),
    'punctum-menu',
    'arrow browsing after T is not undone by a refocus',
  );
  // Arm a family variant; T then targets that family's menu stop.
  await clickSelector('[data-tool="podatus-menu"]');
  await clickSelector('[data-variant="epiphonus"]');
  assert.equal(await pressed('select'), 'false');
  await key('Escape');
  assert.equal(await pressed('select'), 'true');
  await ev(`document.querySelector('[data-note-id="note3"]').focus()`);
  await pause();
  await key('t');
  assert.equal(await focusedTool(), 'podatus-menu', 'T reaches variant menu');
  assert.equal(await paletteFocusRequest(), null, 'second request cleared');
  await shot('t-focus-variant');
  console.log('PASS: T palette focus request, variant target, request cleared');

  // 5. Quilisma figure select arms through the session and is remembered.
  await ev(
    `(()=>{const s=document.querySelector('select[aria-label="Quilisma figure"]');s.value='scandicus';s.dispatchEvent(new Event('change',{bubbles:true}))})()`,
  );
  await pause(200);
  assert.equal(await pressed('quilisma'), 'true');
  assert.equal(
    await ev(
      `document.querySelector('select[aria-label="Quilisma figure"]').value`,
    ),
    'scandicus',
  );
  await key('Escape');
  console.log('PASS: Quilisma figure arms and is remembered');

  // 6. Action bar: Copy/Paste/Undo/Redo buttons share the session commands.
  assert.equal(
    await ev(
      `document.querySelector('button[aria-label="Copy selected music"]').disabled`,
    ),
    true,
    'Copy is disabled without a selection',
  );
  assert.equal(
    await ev(
      `document.querySelector('.editor-clipboard[aria-keyshortcuts^="Control+V"]').getAttribute('aria-label')`,
    ),
    'Paste (clipboard empty)',
  );
  await ev(`document.querySelector('[data-note-id="note1"]').focus()`);
  await pause();
  await key('Enter', { shift: true });
  await key('ArrowRight', { shift: true });
  assert.match(
    await ev(`document.querySelector('#range-selection-status')?.textContent`),
    /^2 neumes selected/,
  );
  assert.equal(
    await ev(
      `[...document.querySelectorAll('.editor-actions button')].filter(b=>b.getAttribute('aria-describedby')==='range-selection-status').length`,
    ),
    2,
    'Lyrics and Insert describe the passage status',
  );
  await clickSelector('button[aria-label="Copy selected music"]');
  assert.equal(
    await ev(
      `document.querySelector('.editor-clipboard[aria-keyshortcuts^="Control+V"]').getAttribute('aria-label')`,
    ),
    'Paste 2 copied neumes',
  );
  const notesBeforePaste = await noteCount();
  await clickSelector('.editor-clipboard[aria-keyshortcuts^="Control+V"]');
  assert.equal(await noteCount(), notesBeforePaste + 2, 'Paste inserts');
  await clickSelector('button[aria-label="Undo last edit"]');
  assert.equal(await noteCount(), notesBeforePaste, 'Undo restores');
  await clickSelector('button[aria-label="Redo last undone edit"]');
  assert.equal(await noteCount(), notesBeforePaste + 2, 'Redo reapplies');
  assert.match(
    await ev(`document.querySelector('.editor-insert').textContent`),
    /^Insert .+ I$/,
  );
  console.log('PASS: action bar Copy/Paste/Undo/Redo and labels');

  // 7. Sticky toolbar observer at desktop, narrow, short and 150% zoom.
  await ev(`window.scrollTo(0,0)`);
  const desktop = await checkStickyThreshold('1440x1100');
  assert.equal(desktop.flag, 'false');
  await viewport(320, 1100);
  await checkStickyThreshold('320x1100');
  await shot('sticky-320');
  await viewport(320, 500);
  const short = await checkStickyThreshold('320x500');
  assert.equal(short.flag, 'true', 'short narrow viewport falls back');
  assert.equal(short.position, 'static', 'fallback toolbar is not sticky');
  await viewport(1440, 1100);
  await ev(`document.querySelector('main').style.zoom='1.5'`);
  await checkStickyThreshold('1440x1100 at 150% zoom');
  await shot('sticky-zoom');
  await ev(`document.querySelector('main').style.zoom=''`);
  await checkStickyThreshold('1440x1100 after zoom');
  console.log('PASS: sticky data-too-tall observer at 1440/320/short/150%');

  console.log(
    `PASS: editor toolbar (${firefox ? 'Firefox' : 'Chromium'}) palette roving, reset on New/Import/reload, T focus, action bar and sticky threshold.`,
  );
} finally {
  if (ownsSession) await rawSend('session.end').catch(() => {});
  ws.close();
}
