import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-pes-subpunctis-'));
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
const send = async (method, params = {}) => {
  if (!firefox) return rawSend(method, params);
  switch (method) {
    case 'Runtime.evaluate': {
      const result = await rawSend('script.evaluate', {
        expression: `(async()=>JSON.stringify(await (0,eval)(${JSON.stringify(params.expression)})))()`,
        target: { context },
        awaitPromise: true,
      });
      if (result.type === 'exception') throw Error(JSON.stringify(result));
      return {
        result: {
          value:
            result.result.value === undefined
              ? undefined
              : JSON.parse(result.result.value),
        },
      };
    }
    case 'Emulation.setDeviceMetricsOverride':
      return rawSend('browsingContext.setViewport', {
        context,
        viewport: { width: params.width, height: params.height },
      });
    case 'Page.navigate':
      return rawSend('browsingContext.navigate', {
        context,
        url: params.url,
        wait: 'complete',
      });
    case 'Page.printToPDF':
      return rawSend('browsingContext.print', { context, background: true });
    case 'Page.captureScreenshot':
      return rawSend('browsingContext.captureScreenshot', {
        context,
        origin: 'viewport',
        format: { type: 'image/png' },
      });
    case 'Input.dispatchMouseEvent':
      return rawSend('input.performActions', {
        context,
        actions: [
          {
            type: 'pointer',
            id: 'mouse',
            parameters: { pointerType: 'mouse' },
            actions: [
              {
                type: 'pointerMove',
                x: Math.round(params.x),
                y: Math.round(params.y),
                origin: 'viewport',
              },
              ...(params.type === 'mousePressed'
                ? [{ type: 'pointerDown', button: 0 }]
                : params.type === 'mouseReleased'
                  ? [{ type: 'pointerUp', button: 0 }]
                  : []),
            ],
          },
        ],
      });
    default:
      throw Error(method);
  }
};
const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const url = process.env.CHANT_PREVIEW_URL ?? 'http://127.0.0.1:4173/';
const storageKey = 'gregorian-chant-editor:active-document:v1';
const raw = () => ev(`localStorage.getItem('${storageKey}')`);
async function ready() {
  for (let i = 0; i < 60; i++) {
    await pause();
    if (await ev(`!!document.querySelector('section[aria-label="Document"]')`))
      return;
  }
  throw Error('Editor did not load');
}
async function navigate() {
  await send('Page.navigate', { url });
  await ready();
}
async function importText(text) {
  await ev(`window.confirm=()=>true`);
  await ev(
    `(()=>{const input=document.querySelector('input[type="file"]');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],'score.chant.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  await pause();
}
async function key(key, code = key, shift = false) {
  if (firefox) {
    const value =
      {
        Enter: '\uE007',
        Delete: '\uE017',
        Tab: '\uE004',
        Escape: '\uE00C',
        ArrowUp: '\uE013',
        ArrowDown: '\uE015',
        ArrowRight: '\uE014',
        Home: '\uE011',
        End: '\uE010',
        ' ': '\uE00D',
      }[key] ?? key;
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            ...(shift ? [{ type: 'keyDown', value: '\uE008' }] : []),
            { type: 'keyDown', value },
            { type: 'keyUp', value },
            ...(shift ? [{ type: 'keyUp', value: '\uE008' }] : []),
          ],
        },
      ],
    });
  } else
    for (const type of ['keyDown', 'keyUp'])
      await rawSend('Input.dispatchKeyEvent', {
        type,
        key,
        code,
        modifiers: shift ? 8 : 0,
        ...(type === 'keyDown' && (key === 'Enter' || key === ' ')
          ? { text: key === 'Enter' ? '\r' : ' ' }
          : {}),
        windowsVirtualKeyCode: {
          Tab: 9,
          Escape: 27,
          Enter: 13,
          ArrowUp: 38,
          ArrowDown: 40,
          ArrowRight: 39,
          Home: 36,
          End: 35,
          Delete: 46,
          ' ': 32,
        }[key],
      });
  await pause();
}
const selector = (id) => `[data-note-id="${id}"]`;
async function select(id) {
  // Native SVG keyboard activation also works for overlapping compound hit boxes.
  await ev(`document.querySelector(${JSON.stringify(selector(id))}).focus()`);
  await key('Enter');
  assert.equal(
    await ev(
      `document.querySelector(${JSON.stringify(selector(id))}).getAttribute('aria-pressed')`,
    ),
    'true',
  );
}
async function change(label, value) {
  return ev(
    `(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.focus();e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return JSON.parse(localStorage.getItem('${storageKey}'));})()`,
  );
}
async function snapshot(name, target = '.score-workspace') {
  await ev(
    `document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'start'})`,
  );
  const rendered = await ev(
    `({svg:document.querySelector('svg.score').outerHTML,css:[...document.styleSheets].flatMap(s=>[...s.cssRules].map(r=>r.cssText)).join('\\n')})`,
  );
  await writeFile(join(output, name + '.json'), JSON.stringify(rendered));
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
}
const score = async () => JSON.parse(await raw()).document;
async function hydrate(value) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value);
  await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(bytes)})`);
  await navigate();
  assert.equal(await raw(), bytes, 'hydration must not write');
  assert.equal(
    await ev(`document.querySelector('svg.score title').textContent`),
    JSON.parse(bytes).document.title,
    'the fixture must actually decode, not fall back',
  );
  return bytes;
}

async function pointer(selector) {
  await ev(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`,
  );
  await pause();
  const point = await ev(
    `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
}
const parrow = 'button[data-tool="podatus-menu"]';
const pprimary = 'button[data-tool="podatus"]';
const carrow = 'button[data-tool="punctum-menu"]';
const menus = () =>
  ev(
    `[...document.querySelectorAll('[role="menu"]')].map(m=>m.getAttribute('aria-label'))`,
  );
const focusedTool = () => ev('document.activeElement?.dataset.tool ?? null');
const selectedTool = () =>
  ev(
    `[...document.querySelectorAll('.neume-palette [aria-pressed="true"]')].map(n=>n.dataset.tool)`,
  );
const family = () =>
  ev(`document.querySelector('${parrow}').dataset.activeVariant`);
const announcement = () =>
  ev(`document.querySelector('.editor-announcement').textContent`);
const undo = async () => {
  await ev(
    `document.querySelector('button[aria-label="Undo last edit"]').click()`,
  );
  await pause();
};
const redo = async () => {
  await ev(
    `document.querySelector('button[aria-label="Redo last undone edit"]').click()`,
  );
  await pause();
};
async function choose(kind) {
  await pointer(parrow);
  await pointer(`[data-variant="${kind}"]`);
  assert.equal(await family(), kind);
}
async function placeAt(pitch = 2, systemIndex = 0) {
  await ev(
    `document.querySelector('svg.score').scrollIntoView({block:'center'})`,
  );
  await pause();
  const point = await ev(
    `(()=>{const svg=document.querySelector('svg.score'),lines=[...svg.querySelectorAll('.score__staff-line')],bottom=Math.max(...lines.slice(${systemIndex * 4},${systemIndex * 4 + 4}).map(l=>Number(l.getAttribute('y1'))));const p=new DOMPoint(300,bottom-${pitch}*12).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y}})()`,
  );
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await pause();
  const paths = await ev(
    `[...document.querySelectorAll('.score__placement-ghost path')].map(p=>p.getAttribute('d'))`,
  );
  assert.ok(paths.length >= 1, 'ghost visible');
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
  return paths;
}
const base = {
  format: 'gregorian-chant-editor',
  version: 7,
  document: {
    title: 'Stage 9B-1 pes subpunctis',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 4 },
    neumes: [],
    syllables: [],
    divisions: [],
    clefChanges: [],
    accidentals: [],
  },
};
const pes = (id, pitches, marks = {}) => ({
  id,
  kind: 'pes-subpunctis',
  notes: pitches.map((p, i) => ({
    id: id + '-' + i,
    staffPosition: p,
    ...(marks[i] ?? {}),
  })),
});
const punctum = (id, p) => ({
  id,
  kind: 'punctum',
  notes: [{ id: id + '-0', staffPosition: p }],
});
const syl = (id, text, at, boundaryBefore = 'word') => ({
  id,
  text,
  startsAtNeumeId: at,
  boundaryBefore,
});
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate();
    await hydrate(base);
    const original = await raw();
    // Menu open, keyboard browse, Escape keeps placement state and storage.
    await pointer(parrow);
    assert.deepEqual(await menus(), ['Podatus family']);
    assert.equal(
      await ev(`document.querySelector('${parrow}').ariaExpanded`),
      'true',
    );
    assert.equal(
      await ev('document.activeElement.textContent.trim()'),
      'Podatus',
    );
    await key('ArrowDown');
    assert.equal(
      await ev('document.activeElement.textContent.trim()'),
      'Pes subbipunctis',
    );
    const menuBox = await ev(
      `(()=>{const r=document.querySelector('[role="menu"]').getBoundingClientRect();return {left:r.left,right:r.right}})()`,
    );
    assert.ok(
      menuBox.left >= 0 && menuBox.right <= width,
      `menu inside viewport at ${width}px: ${JSON.stringify(menuBox)}`,
    );
    await snapshot('podatus-menu-open-' + width, '.neume-palette');
    await key('Escape');
    assert.equal(await focusedTool(), 'podatus-menu');
    assert.deepEqual(await menus(), []);
    assert.equal(await raw(), original);
    assert.equal(await family(), undefined);
    await choose('pes-subtripunctis');
    assert.deepEqual(await selectedTool(), [], 'plain Podatus not pressed');
    assert.equal(
      await ev(`document.querySelector('${parrow}').ariaLabel`),
      'Podatus family variants, active Pes subtripunctis',
    );
    await snapshot('podatus-menu-closed-active-' + width, '.neume-palette');
    // Primary with the menu open: plain Podatus, menu closed, primary focus.
    await pointer(parrow);
    assert.equal(
      await ev(
        `document.querySelector('[data-variant="pes-subtripunctis"]').ariaChecked`,
      ),
      'true',
    );
    await pointer(pprimary);
    assert.deepEqual(await menus(), []);
    assert.equal(await family(), 'podatus');
    assert.deepEqual(await selectedTool(), ['podatus']);
    assert.equal(await focusedTool(), 'podatus');
    assert.equal(await raw(), original);
    await pointer(parrow);
    assert.deepEqual(await menus(), ['Podatus family'], 'no stale state');
    // Cross-menu switching never leaves two menus open or edits the score.
    await pointer(carrow);
    assert.deepEqual(await menus(), ['Punctum family']);
    const exposed = await ev(
      `(()=>{const b=document.querySelector('${parrow}');const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b})()`,
    );
    if (exposed) {
      await pointer(parrow);
    } else {
      // At 320px the open Punctum menu covers the wrapped Podatus chevron,
      // as Stage 9A documented; switch with real keys instead. (Headless
      // Firefox emits no blur for programmatic focus, so close with Escape.)
      assert.equal(width, 320);
      await key('Escape');
      assert.deepEqual(await menus(), []);
      assert.equal(await focusedTool(), 'punctum-menu');
      await ev(`document.querySelector('${parrow}').focus()`);
      await pause();
      await key('Enter');
    }
    assert.deepEqual(await menus(), ['Podatus family']);
    await key('Escape');
    await pointer(carrow);
    await key('Escape');
    assert.deepEqual(await menus(), []);
    assert.equal(await raw(), original);
    // Tab leaves normally and closes.
    await pointer(parrow);
    await key('Tab');
    assert.deepEqual(await menus(), []);
    assert.equal(await raw(), original);
    // Dismissal-only score click: no edit, chevron focus, I/T still work.
    await choose('pes-subtripunctis');
    await pointer(parrow);
    await placeAt(2);
    assert.equal(await raw(), original, 'score click only dismisses');
    assert.deepEqual(await menus(), []);
    assert.equal(await focusedTool(), 'podatus-menu');
    await key('i', 'KeyI');
    let doc = await score();
    assert.equal(doc.neumes.length, 1, 'I works after dismissal');
    assert.equal(doc.neumes[0].kind, 'pes-subpunctis');
    assert.equal(doc.neumes[0].notes.length, 5);
    await key('t', 'KeyT');
    assert.equal(await focusedTool(), 'podatus-menu');
    await undo();
    assert.equal((await score()).neumes.length, 0);
    // One-click placement of each exact variant, staying armed.
    for (const [kind, count] of [
      ['pes-subbipunctis', 4],
      ['pes-subtripunctis', 5],
    ]) {
      await choose(kind);
      const beforeIds = new Set((await score()).neumes.map((n) => n.id));
      const ghost = await placeAt(2);
      assert.equal(ghost.length, 1 + count - 2, 'Podatus body + diamonds');
      await placeAt(3);
      doc = await score();
      const added = doc.neumes
        .filter((n) => !beforeIds.has(n.id))
        .sort((a, b) => a.notes[0].staffPosition - b.notes[0].staffPosition);
      assert.equal(added.length, 2);
      assert.deepEqual(
        added.map((n) => n.notes.map((x) => x.staffPosition)),
        count === 4
          ? [
              [2, 4, 3, 2],
              [3, 5, 4, 3],
            ]
          : [
              [2, 5, 4, 3, 2],
              [3, 6, 5, 4, 3],
            ],
      );
      assert.ok(added.every((n) => n.kind === 'pes-subpunctis'));
      assert.equal(
        new Set(added.flatMap((n) => [n.id, ...n.notes.map((x) => x.id)])).size,
        2 + 2 * count,
      );
      assert.equal(JSON.parse(await raw()).version, 7);
      assert.equal(await family(), kind);
      await pointer('[data-tool="select"]');
      await ev(`document.querySelector('[data-note-id]').focus()`);
      await key('t', 'KeyT');
      assert.equal(await focusedTool(), 'podatus-menu');
      assert.equal(await family(), undefined, 'T does not arm Podatus');
      await key('i', 'KeyI');
      const recalledIds = new Set(doc.neumes.map((n) => n.id));
      const recalled = (await score()).neumes.filter(
        (n) => !recalledIds.has(n.id),
      );
      assert.equal(recalled.length, 1);
      assert.equal(recalled[0].notes.length, count);
      await pointer(pprimary);
      assert.equal(await family(), 'podatus');
    }
    // Keyboard-only selection from the roving toolbar.
    await ev(`document.querySelector('${pprimary}').focus()`);
    const beforeMenu = await raw();
    await key('ArrowRight');
    assert.equal(await focusedTool(), 'podatus-menu');
    await key('Enter');
    await key('End');
    assert.equal(
      await ev('document.activeElement.textContent.trim()'),
      'Pes subtripunctis',
    );
    await key('Home');
    await key('ArrowDown');
    await key('Enter');
    assert.equal(await family(), 'pes-subbipunctis');
    assert.equal(await raw(), beforeMenu);
    await key('Escape');
    assert.deepEqual(await selectedTool(), ['select']);
    const keyboardIds = new Set((await score()).neumes.map((n) => n.id));
    await key('i', 'KeyI');
    const keyed = (await score()).neumes.filter((n) => !keyboardIds.has(n.id));
    assert.equal(keyed.length, 1);
    assert.equal(keyed[0].notes.length, 4);
    // Native v7 refresh, export and import.
    const bytes = await raw();
    await navigate();
    assert.equal(await raw(), bytes);
    await ev(
      `window.__download=null;URL.createObjectURL=blob=>{window.__download=blob;return 'blob:captured'};HTMLAnchorElement.prototype.click=function(){}`,
    );
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export').click()`,
    );
    await pause();
    const exported = await ev('window.__download.text()');
    assert.deepEqual(JSON.parse(exported), JSON.parse(bytes));
    assert.equal(JSON.parse(exported).version, 7);
    await importText(exported);
    assert.deepEqual(await score(), JSON.parse(bytes).document);
    // A v6 file containing the new kind is rejected and leaves the score.
    const before6 = await raw();
    await importText(JSON.stringify({ ...JSON.parse(exported), version: 6 }));
    assert.equal(await raw(), before6);
    // Contextual editing, hit ownership, movement, normalization, history.
    await hydrate({
      ...base,
      document: {
        ...base.document,
        neumes: [
          pes('k', [6, 7, 6, 4, 3]),
          pes('p', [2, 4, 3, 2]),
          pes('b', [5, 6, 5, 4]),
        ],
        syllables: [syl('s1', 'Chri', 'k'), syl('s2', 'ste', 'p')],
      },
    });
    for (const id of ['k', 'p', 'b']) {
      const count = id === 'k' ? 5 : 4;
      for (let i = 0; i < count; i++) {
        const target = `[data-note-id="${id}-${i}"] .score__note-hit-target`;
        await ev(
          `document.querySelector('${target}').scrollIntoView({block:'center'})`,
        );
        const owner = await ev(
          `(()=>{const r=document.querySelector('${target}').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-note-id]')?.dataset.noteId})()`,
        );
        assert.equal(owner, `${id}-${i}`, 'pointer target owns its center');
      }
    }
    await pointer('[data-note-id="k-3"] .score__note-hit-target');
    assert.equal(
      await ev(
        `document.querySelector('[data-note-id="k-3"]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    assert.match(
      await ev(
        `document.querySelector('[data-note-id="k-3"]').getAttribute('aria-label')`,
      ),
      /fourth note of pes subtripunctis/,
    );
    assert.equal(
      await ev(
        `document.querySelector('[aria-label="Mora scope"]').getAttribute('aria-disabled')`,
      ),
      'true',
    );
    assert.ok(
      await ev(
        `document.querySelector('.note-context-toolbar').textContent.includes('Mora authoring is unavailable for pes subtripunctis')`,
      ),
    );
    await change('Vertical episema', 'on');
    await change('Horizontal episema', 'on');
    await select('b-2');
    await change('Written accidental', 'flat');
    const marked = await score();
    assert.equal(marked.neumes[0].notes[3].verticalEpisema, true);
    assert.equal(marked.neumes[0].notes[3].episema, true);
    assert.equal(marked.accidentals[0].ownerNoteId, 'b-0');
    // Invalid single move: the inner diamond cannot reach the apex.
    await select('k-2');
    await key('ArrowUp');
    assert.deepEqual(await score(), marked);
    assert.match(await announcement(), /strictly descend/);
    // Valid single move keeps IDs.
    await select('k-4');
    await key('ArrowDown');
    assert.equal((await score()).neumes[0].notes[4].staffPosition, 2);
    await undo();
    assert.deepEqual(await score(), marked);
    // Whole-group transpose.
    await ev(`document.querySelector('[data-note-id="p-0"]').focus()`);
    await key('Enter', 'Enter', true);
    await key('ArrowUp');
    assert.deepEqual(
      (await score()).neumes[1].notes.map((n) => n.staffPosition),
      [3, 5, 4, 3],
    );
    await undo();
    assert.deepEqual(await score(), marked);
    // Deletion normalizes to Climacus; four descending survivors are rejected.
    await ev(`document.querySelector('[data-note-id="p-0"]').focus()`);
    await key('Enter');
    await key('Delete');
    const reduced = await score();
    assert.equal(reduced.neumes[1].kind, 'climacus');
    assert.deepEqual(
      reduced.neumes[1].notes.map((n) => n.id),
      ['p-1', 'p-2', 'p-3'],
    );
    await undo();
    assert.deepEqual(await score(), marked);
    await redo();
    assert.deepEqual(await score(), reduced);
    await undo();
    await ev(`document.querySelector('[data-note-id="k-0"]').focus()`);
    await key('Enter');
    await key('Delete');
    assert.deepEqual(await score(), marked);
    assert.match(await announcement(), /four descending notes/);
    await snapshot('interaction-' + width);
    // Specimens: both counts, adjacent/wider intervals, line/space, signs,
    // Kyrie XI fragments, lyrics, neighbors and an accidental; plus wrapping.
    const specimen = {
      ...base,
      document: {
        ...base.document,
        neumes: [
          punctum('a', 2),
          pes('bi-line', [2, 4, 3, 2]),
          pes('bi-space', [1, 3, 2, 1]),
          pes('bi-wide', [0, 4, 2, -1]),
          pes('tri-line', [2, 5, 4, 3, 2]),
          pes('tri-space', [1, 4, 3, 2, 1]),
          punctum('z', 3),
          pes('christe', [6, 7, 6, 4, 3], { 3: { verticalEpisema: true } }),
          pes('kyrie', [2, 3, 2, 0, -1], { 3: { verticalEpisema: true } }),
          pes('signs', [2, 4, 3, 2], {
            0: { episema: true },
            1: { episema: true },
            2: { verticalEpisema: true },
            3: { episema: true, verticalEpisema: true },
          }),
          pes('flat', [5, 6, 5, 4]),
          ...Array.from({ length: 10 }, (_, i) =>
            pes('wrap' + i, i % 2 ? [2, 4, 3, 2] : [1, 4, 3, 2, 1]),
          ),
        ],
        syllables: [
          syl('l1', 'in', 'a'),
          syl('l2', 'ten', 'bi-line', 'continuation'),
          syl('l3', 'tá', 'bi-space', 'continuation'),
          syl('l4', 'ti', 'bi-wide', 'continuation'),
          syl('l5', 'o', 'tri-line', 'continuation'),
          syl('l6', 'nem', 'tri-space', 'continuation'),
          syl('l7', 'Chri', 'z'),
          syl('l8', 'ste', 'christe', 'continuation'),
          syl('l9', 'e', 'kyrie'),
          syl('l10', 'lé', 'signs', 'continuation'),
          syl('l11', 'i', 'flat', 'continuation'),
          syl('l12', 'son', 'wrap0', 'continuation'),
        ],
        accidentals: [{ id: 'acc', kind: 'flat', ownerNoteId: 'flat-0' }],
      },
    };
    await hydrate(specimen);
    await snapshot('engraving-' + width);
    assert.equal(
      await ev(`document.documentElement.scrollWidth<=innerWidth`),
      true,
      'no horizontal page overflow',
    );
    assert.equal(
      await ev(
        `document.querySelectorAll('.neume-palette [tabindex="0"]').length`,
      ),
      1,
      'one toolbar Tab stop',
    );
    const groups = await ev(
      `[...document.querySelectorAll('g[data-neume-kind="pes-subpunctis"]')].map(n=>{const b=n.getBBox();return {w:b.width,h:b.height}})`,
    );
    assert.equal(groups.length, 19);
    assert.ok(
      groups.every((g) => g.w > 0 && g.h < 160),
      'whole groups',
    );
    assert.ok(
      (await ev(
        `new Set([...document.querySelectorAll('.score__staff-line')].map(l=>l.getAttribute('y1'))).size/4`,
      )) > 1,
      'specimen wraps to more than one system',
    );
  }
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox/BiDi' : 'Chromium/CDP',
      userAgent: await ev('navigator.userAgent'),
      output,
      checks:
        'Podatus split menu open/Escape/Tab/primary-reset/cross-menu/score-dismiss/keyboard, exact ghosts and repeat placement of both variants, I/T recall, v7 reload/export/import and v6 rejection, hit ownership, disabled mora, episemata/ictus, B ownership, move rejection/acceptance, whole-group move, normalization/rejection/undo/redo, specimens/wrapping at 1440px and 320px',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
