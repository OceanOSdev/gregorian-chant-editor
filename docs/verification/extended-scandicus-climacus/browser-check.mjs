import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(
  join(tmpdir(), 'chant-extended-scandicus-climacus-'),
);
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
const arrow = (family) => `button[data-tool="${family}-menu"]`;
const primary = (family) => `button[data-tool="${family}"]`;
const Title = (family) => family[0].toUpperCase() + family.slice(1);
const variantLabel = (variant) => {
  const [family, count] = variant.split('-');
  return count ? `${Title(family)} (${count} notes)` : Title(family);
};
const menus = () =>
  ev(
    `[...document.querySelectorAll('[role="menu"]')].map(m=>m.getAttribute('aria-label'))`,
  );
const focusedTool = () => ev('document.activeElement?.dataset.tool ?? null');
const selectedTool = () =>
  ev(
    `[...document.querySelectorAll('.neume-palette [aria-pressed="true"]')].map(n=>n.dataset.tool)`,
  );
const activeVariant = (family) =>
  ev(`document.querySelector('${arrow(family)}').dataset.activeVariant`);
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
async function choose(variant) {
  const family = variant.split('-')[0];
  await pointer(arrow(family));
  await pointer(`[data-variant="${variant}"]`);
  assert.equal(await activeVariant(family), variant);
}
async function closeMenus() {
  for (let i = 0; i < 3 && (await menus()).length; i++) await key('Escape');
  assert.deepEqual(await menus(), []);
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
  version: 8,
  document: {
    title: 'Stage 9B-2 extended scandicus and climacus',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 4 },
    neumes: [],
    syllables: [],
    divisions: [],
    clefChanges: [],
    accidentals: [],
  },
};
const neume = (kind, id, pitches, marks = {}) => ({
  id,
  kind,
  notes: pitches.map((p, i) => ({
    id: id + '-' + i,
    staffPosition: p,
    ...(marks[i] ?? {}),
  })),
});
const scandicus = (...args) => neume('scandicus', ...args);
const climacus = (...args) => neume('climacus', ...args);
const punctum = (id, p) => neume('punctum', id, [p]);
const syl = (id, text, at, boundaryBefore = 'word') => ({
  id,
  text,
  startsAtNeumeId: at,
  boundaryBefore,
});
// Ghost ink per entry variant: the Scandicus staircase draws one body per
// Pes/Punctum element; Climacus draws a virga and one diamond per later note.
const ghostInk = {
  'scandicus-4': 2,
  'scandicus-5': 3,
  'climacus-4': 4,
  'climacus-5': 5,
};
const entryPitches = (variant, first) => {
  const [family, count] = variant.split('-');
  const sign = family === 'scandicus' ? 1 : -1;
  return Array.from({ length: Number(count) }, (_, i) => first + sign * i);
};
// Click pitches inside the existing graphical placement range for both rows.
const entryFirst = { scandicus: 2, climacus: 5 };
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
    for (const family of ['scandicus', 'climacus']) {
      // Menu open, keyboard browse, Escape keeps placement state and storage.
      await pointer(arrow(family));
      assert.deepEqual(await menus(), [`${Title(family)} family`]);
      assert.equal(
        await ev(`document.querySelector('${arrow(family)}').ariaExpanded`),
        'true',
      );
      assert.equal(
        await ev('document.activeElement.textContent.trim()'),
        Title(family),
      );
      await key('ArrowDown');
      assert.equal(
        await ev('document.activeElement.textContent.trim()'),
        `${Title(family)} (4 notes)`,
      );
      await key('ArrowDown');
      assert.equal(
        await ev('document.activeElement.textContent.trim()'),
        `${Title(family)} (5 notes)`,
      );
      const menuBox = await ev(
        `(()=>{const r=document.querySelector('[role="menu"]').getBoundingClientRect();return {left:r.left,right:r.right}})()`,
      );
      assert.ok(
        menuBox.left >= 0 && menuBox.right <= width,
        `menu inside viewport at ${width}px: ${JSON.stringify(menuBox)}`,
      );
      await snapshot(`${family}-menu-open-${width}`, '.neume-palette');
      await key('Escape');
      assert.equal(await focusedTool(), `${family}-menu`);
      assert.deepEqual(await menus(), []);
      assert.equal(await raw(), original);
      assert.equal(await activeVariant(family), undefined);
      await choose(`${family}-5`);
      assert.deepEqual(await selectedTool(), [], 'primary not pressed');
      assert.equal(
        await ev(`document.querySelector('${arrow(family)}').ariaLabel`),
        `${Title(family)} family variants, active ${Title(family)} (5 notes)`,
      );
      await snapshot(`${family}-menu-closed-active-${width}`, '.neume-palette');
      // Primary with the menu open: ordinary figure, menu closed, focus kept.
      await pointer(arrow(family));
      assert.equal(
        await ev(
          `document.querySelector('[data-variant="${family}-5"]').ariaChecked`,
        ),
        'true',
      );
      await pointer(primary(family));
      assert.deepEqual(await menus(), []);
      assert.equal(await activeVariant(family), family);
      assert.deepEqual(await selectedTool(), [family]);
      assert.equal(await focusedTool(), family);
      assert.equal(await raw(), original);
      // Tab leaves normally and closes.
      await pointer(arrow(family));
      await key('Tab');
      assert.deepEqual(await menus(), []);
      assert.equal(await raw(), original);
    }
    // Cross-menu switching across all four families: never two menus open.
    const families = ['punctum', 'podatus', 'scandicus', 'climacus'];
    for (let i = 0; i < families.length; i++) {
      const from = families[i];
      const to = families[(i + 1) % families.length];
      await pointer(arrow(from));
      assert.deepEqual(await menus(), [`${Title(from)} family`]);
      const exposed = await ev(
        `(()=>{const b=document.querySelector('${arrow(to)}');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b})()`,
      );
      if (exposed) await pointer(arrow(to));
      else {
        // A wrapped narrow toolbar can place an open menu over a later
        // chevron (Stage 9A); switch with real keys instead.
        await key('Escape');
        assert.deepEqual(await menus(), []);
        await ev(`document.querySelector('${arrow(to)}').focus()`);
        await pause();
        await key('Enter');
      }
      assert.deepEqual(await menus(), [`${Title(to)} family`]);
      await closeMenus();
    }
    assert.equal(await raw(), original);
    // Dismissal-only score click: no edit, chevron focus, I/T still work.
    for (const family of ['scandicus', 'climacus']) {
      // An earlier undo may have re-serialized the same document.
      const unchanged = await raw();
      await choose(`${family}-5`);
      await pointer(arrow(family));
      await placeAt(entryFirst[family]);
      assert.equal(await raw(), unchanged, 'score click only dismisses');
      assert.deepEqual(await menus(), []);
      assert.equal(await focusedTool(), `${family}-menu`);
      await key('i', 'KeyI');
      const doc = await score();
      assert.equal(doc.neumes.length, 1, 'I works after dismissal');
      assert.equal(doc.neumes[0].kind, family);
      assert.equal(doc.neumes[0].notes.length, 5);
      await key('t', 'KeyT');
      assert.equal(await focusedTool(), `${family}-menu`);
      await undo();
      assert.equal((await score()).neumes.length, 0);
    }
    // One-click placement of each exact variant, staying armed.
    for (const variant of [
      'scandicus-4',
      'scandicus-5',
      'climacus-4',
      'climacus-5',
    ]) {
      const family = variant.split('-')[0];
      const count = Number(variant.split('-')[1]);
      const first = entryFirst[family];
      await choose(variant);
      const beforeIds = new Set((await score()).neumes.map((n) => n.id));
      const ghost = await placeAt(first);
      assert.equal(ghost.length, ghostInk[variant], `${variant} ghost ink`);
      await placeAt(first + 1);
      let doc = await score();
      const added = doc.neumes
        .filter((n) => !beforeIds.has(n.id))
        .sort((a, b) => a.notes[0].staffPosition - b.notes[0].staffPosition);
      assert.equal(added.length, 2);
      assert.deepEqual(
        added.map((n) => n.notes.map((x) => x.staffPosition)),
        [entryPitches(variant, first), entryPitches(variant, first + 1)],
      );
      assert.ok(added.every((n) => n.kind === family));
      assert.equal(
        new Set(added.flatMap((n) => [n.id, ...n.notes.map((x) => x.id)])).size,
        2 + 2 * count,
      );
      assert.equal(JSON.parse(await raw()).version, 8);
      assert.equal(await activeVariant(family), variant);
      await pointer('[data-tool="select"]');
      await ev(`document.querySelector('[data-note-id]').focus()`);
      await key('t', 'KeyT');
      assert.equal(await focusedTool(), `${family}-menu`);
      assert.equal(await activeVariant(family), undefined, 'T does not arm');
      await key('i', 'KeyI');
      const recalledIds = new Set(doc.neumes.map((n) => n.id));
      doc = await score();
      const recalled = doc.neumes.filter((n) => !recalledIds.has(n.id));
      assert.equal(recalled.length, 1);
      assert.equal(recalled[0].kind, family);
      assert.equal(recalled[0].notes.length, count);
      await pointer(primary(family));
      assert.equal(await activeVariant(family), family);
    }
    // Keyboard-only selection from the roving toolbar.
    for (const family of ['scandicus', 'climacus']) {
      await ev(`document.querySelector('${primary(family)}').focus()`);
      const beforeMenu = await raw();
      await key('ArrowRight');
      assert.equal(await focusedTool(), `${family}-menu`);
      await key('Enter');
      await key('End');
      assert.equal(
        await ev('document.activeElement.textContent.trim()'),
        `${Title(family)} (5 notes)`,
      );
      await key('Home');
      await key('ArrowDown');
      await key('Enter');
      assert.equal(await activeVariant(family), `${family}-4`);
      assert.equal(await raw(), beforeMenu);
      await key('Escape');
      assert.deepEqual(await selectedTool(), ['select']);
      const keyboardIds = new Set((await score()).neumes.map((n) => n.id));
      await key('i', 'KeyI');
      const keyed = (await score()).neumes.filter(
        (n) => !keyboardIds.has(n.id),
      );
      assert.equal(keyed.length, 1);
      assert.equal(keyed[0].kind, family);
      assert.equal(keyed[0].notes.length, 4);
    }
    // Ordinary authored quilismatic Scandicus is unchanged; the primary
    // resets to the ordinary default shape.
    await change('Quilisma figure', 'scandicus');
    assert.deepEqual(await selectedTool(), ['quilisma']);
    const beforeQuilisma = new Set((await score()).neumes.map((n) => n.id));
    await placeAt(1);
    const quilismatic = (await score()).neumes.filter(
      (n) => !beforeQuilisma.has(n.id),
    );
    assert.equal(quilismatic.length, 1);
    assert.equal(quilismatic[0].kind, 'scandicus');
    assert.deepEqual(
      quilismatic[0].notes.map((n) => n.form ?? null),
      [null, 'quilisma', null],
    );
    await pointer(primary('scandicus'));
    assert.deepEqual(await selectedTool(), ['scandicus']);
    assert.equal(await activeVariant('scandicus'), 'scandicus');
    // Native v8 refresh, export and import; a v7 file with a four-note
    // Scandicus is rejected and leaves the score.
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
    assert.equal(JSON.parse(exported).version, 8);
    await importText(exported);
    assert.deepEqual(await score(), JSON.parse(bytes).document);
    const before7 = await raw();
    await importText(JSON.stringify({ ...JSON.parse(exported), version: 7 }));
    assert.equal(await raw(), before7, 'v7 rejects longer groups');
    // Contextual editing, hit ownership, movement, normalization, history.
    await hydrate({
      ...base,
      document: {
        ...base.document,
        neumes: [
          scandicus('s4', [2, 3, 4, 6]),
          scandicus('s5', [1, 2, 3, 4, 6]),
          climacus('c4', [6, 5, 4, 3]),
          climacus('c5', [7, 6, 4, 3, 1]),
          scandicus('q', [2, 3, 5], { 1: { form: 'quilisma' } }),
        ],
        syllables: [
          syl('l1', 'Al', 's4'),
          syl('l2', 'le', 's5', 'continuation'),
          syl('l3', 'lu', 'c4', 'continuation'),
          syl('l4', 'ia', 'c5', 'continuation'),
        ],
      },
    });
    for (const [id, count] of [
      ['s4', 4],
      ['s5', 5],
      ['c4', 4],
      ['c5', 5],
      ['q', 3],
    ])
      for (let i = 0; i < count; i++) {
        const target = `[data-note-id="${id}-${i}"] .score__note-hit-target`;
        await ev(
          `document.querySelector('${target}').scrollIntoView({block:'center'})`,
        );
        const owner = await ev(
          `(()=>{const t=document.querySelector('[data-note-id="${id}-${i}"]');const r=t.querySelector('.score__note-hit-target').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-note-id]')?.dataset.noteId})()`,
        );
        assert.equal(owner, `${id}-${i}`, 'pointer target owns its center');
      }
    await pointer('[data-note-id="s5-3"] .score__note-hit-target');
    assert.equal(
      await ev(
        `document.querySelector('[data-note-id="s5-3"]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    assert.match(
      await ev(
        `document.querySelector('[data-note-id="s5-3"]').getAttribute('aria-label')`,
      ),
      /fourth note of five-note scandicus/,
    );
    // Provisional matrix for longer groups: None only (owner gate pending);
    // no authorable form on longer groups.
    assert.deepEqual(
      await ev(
        `[...document.querySelector('[aria-label="Mora scope"]').options].map(o=>o.value)`,
      ),
      ['none'],
    );
    assert.equal(
      await ev(`document.querySelector('[aria-label="Mora scope"]').disabled`),
      true,
    );
    assert.equal(
      await ev(`document.querySelector('[aria-label="Form"]').disabled`),
      true,
    );
    await change('Vertical episema', 'on');
    await change('Horizontal episema', 'on');
    // The ordinary three-note matrix and quilisma remain available.
    await select('q-1');
    assert.deepEqual(
      await ev(
        `[...document.querySelector('[aria-label="Mora scope"]').options].map(o=>o.value)`,
      ),
      ['none', 'final', 'final-two'],
    );
    assert.equal(
      await ev(`document.querySelector('[aria-label="Form"]').value`),
      'quilisma',
    );
    // B on a later constituent: C clef line 4, staff position 5 is B.
    await select('c4-1');
    await change('Written accidental', 'flat');
    const marked = await score();
    assert.equal(marked.neumes[1].notes[3].verticalEpisema, true);
    assert.equal(marked.neumes[1].notes[3].episema, true);
    assert.deepEqual(
      marked.accidentals.map((a) => a.ownerNoteId),
      ['c4-1'],
    );
    // Invalid single move rejects atomically with an announcement.
    await select('s5-2');
    await key('ArrowUp');
    assert.deepEqual(await score(), marked);
    assert.match(
      await announcement(),
      /five-note scandicus must be strictly higher/,
    );
    await select('c4-1');
    await key('ArrowUp');
    assert.deepEqual(await score(), marked);
    assert.match(
      await announcement(),
      /four-note climacus must be strictly lower/,
    );
    // Valid single move keeps IDs.
    await select('s5-4');
    await key('ArrowUp');
    assert.equal((await score()).neumes[1].notes[4].staffPosition, 7);
    await undo();
    assert.deepEqual(await score(), marked);
    // Whole-group transpose.
    await ev(`document.querySelector('[data-note-id="c5-0"]').focus()`);
    await key('Enter', 'Enter', true);
    await key('ArrowDown');
    assert.deepEqual(
      (await score()).neumes[3].notes.map((n) => n.staffPosition),
      [6, 5, 3, 2, 0],
    );
    await undo();
    assert.deepEqual(await score(), marked);
    // Deletion keeps the family (5 -> 4 -> 3), then 3 -> 2 is unchanged.
    await select('s5-0');
    await key('Delete');
    const four = await score();
    assert.equal(four.neumes[1].kind, 'scandicus');
    assert.deepEqual(
      four.neumes[1].notes.map((n) => n.id),
      ['s5-1', 's5-2', 's5-3', 's5-4'],
    );
    assert.equal(four.neumes[1].notes[2].verticalEpisema, true, 'mark kept');
    await select('s5-4');
    await key('Delete');
    const three = await score();
    assert.equal(three.neumes[1].kind, 'scandicus');
    assert.equal(three.neumes[1].notes.length, 3);
    await select('s5-2');
    await key('Delete');
    assert.equal((await score()).neumes[1].kind, 'podatus');
    await undo();
    await undo();
    await undo();
    assert.deepEqual(await score(), marked);
    await redo();
    assert.deepEqual(await score(), four);
    await undo();
    await select('c5-3');
    await key('Delete');
    const climacusFour = (await score()).neumes[3];
    assert.equal(climacusFour.kind, 'climacus');
    assert.deepEqual(
      climacusFour.notes.map((n) => n.id),
      ['c5-0', 'c5-1', 'c5-2', 'c5-4'],
    );
    await undo();
    assert.deepEqual(await score(), marked);
    const markedBytes = await raw();
    assert.equal(JSON.parse(markedBytes).version, 8);
    await navigate();
    assert.equal(await raw(), markedBytes, 'reload keeps marked v8 bytes');
    await snapshot('interaction-' + width);
    // Five-note insertion through the clef-boundary Insert controls.
    for (const variant of ['scandicus-5', 'climacus-5']) {
      const family = variant.split('-')[0];
      await hydrate({
        ...base,
        document: {
          ...base.document,
          neumes: [punctum('a', 2), punctum('b', 3)],
          clefChanges: [
            {
              id: 'C',
              clef: { type: 'c', staffLine: 3 },
              beforeNeumeId: 'b',
              beforeDivisionId: null,
            },
          ],
        },
      });
      await choose(variant);
      await pointer('[data-tool="select"]');
      for (const side of ['after', 'before']) {
        await pointer('[data-clef-change-id="C"]');
        const before = await score();
        const label = `Insert ${variantLabel(variant)} ${side} clef`;
        assert.ok(
          await ev(
            `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)})`,
          ),
          label,
        );
        await ev(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
        );
        await pause();
        const after = await score();
        const added = after.neumes.filter(
          (n) => !before.neumes.some((o) => o.id === n.id),
        );
        assert.equal(added.length, 1, side);
        assert.equal(added[0].kind, family);
        assert.equal(added[0].notes.length, 5);
        assert.equal(
          new Set([added[0].id, ...added[0].notes.map((n) => n.id)]).size,
          6,
        );
        const clefAnchor = after.clefChanges[0].beforeNeumeId;
        if (side === 'after') assert.equal(clefAnchor, added[0].id);
        else
          assert.equal(
            after.neumes[
              after.neumes.findIndex((n) => n.id === added[0].id) + 1
            ].id,
            clefAnchor,
          );
      }
    }
    // Specimens: both counts and directions, adjacent/skipped/mixed
    // intervals, line/space, Mocquereau Fig. 34 and Demetria p. 40 contours,
    // the ordinary three-note figures, signs, a B, lyrics and wrapping.
    const specimen = {
      ...base,
      document: {
        ...base.document,
        neumes: [
          punctum('a', 2),
          scandicus('sc3', [2, 3, 4]),
          scandicus('scq', [2, 3, 5], { 1: { form: 'quilisma' } }),
          scandicus('fig34a', [2, 3, 4, 6]),
          scandicus('fig34b', [1, 2, 3, 4, 6]),
          scandicus('s4-step', [1, 2, 3, 4]),
          scandicus('s4-skip', [0, 2, 4, 6]),
          scandicus('s5-mixed', [-2, 0, 1, 4, 5]),
          climacus('cl3', [5, 4, 3]),
          climacus('dem40', [6, 5, 4, 3]),
          climacus('c4-skip', [8, 5, 3, 0]),
          climacus('c5-step', [6, 5, 4, 3, 2]),
          climacus('c5-mixed', [7, 4, 3, 1, -2]),
          scandicus('s-signs', [1, 2, 3, 4, 6], {
            0: { episema: true },
            1: { verticalEpisema: true },
            2: { episema: true, verticalEpisema: true },
            4: { episema: true },
          }),
          climacus('c-signs', [6, 5, 4, 3, 2], {
            0: { episema: true },
            2: { verticalEpisema: true },
            4: { episema: true, verticalEpisema: true },
          }),
          scandicus('s-flat', [2, 3, 5, 6]),
          ...Array.from({ length: 12 }, (_, i) =>
            i % 2
              ? climacus('wrap' + i, [6, 5, 4, 3, 2])
              : scandicus('wrap' + i, [1, 2, 3, 4, 6]),
          ),
        ],
        syllables: [
          syl('l1', 'Al', 'a'),
          syl('l2', 'le', 'sc3', 'continuation'),
          syl('l3', 'lú', 'scq', 'continuation'),
          syl('l4', 'ia', 'fig34a', 'continuation'),
          syl('l5', 'Ky', 'fig34b'),
          syl('l6', 'ri', 's4-step', 'continuation'),
          syl('l7', 'e', 's4-skip', 'continuation'),
          syl('l8', 'e', 's5-mixed'),
          syl('l9', 'lé', 'cl3', 'continuation'),
          syl('l10', 'i', 'dem40', 'continuation'),
          syl('l11', 'son', 'c4-skip', 'continuation'),
          syl('l12', 'Chri', 'c5-step'),
          syl('l13', 'ste', 'c5-mixed', 'continuation'),
          syl('l14', 'e', 's-signs'),
          syl('l15', 'lé', 'c-signs', 'continuation'),
          syl('l16', 'i', 's-flat', 'continuation'),
          syl('l17', 'son', 'wrap0', 'continuation'),
        ],
        accidentals: [{ id: 'acc', kind: 'flat', ownerNoteId: 's-flat-2' }],
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
      `[...document.querySelectorAll('g[data-neume-kind="scandicus"],g[data-neume-kind="climacus"]')].map(n=>({id:n.dataset.neumeId,notes:n.querySelectorAll('[data-note-id]').length,w:n.getBBox().width,h:n.getBBox().height}))`,
    );
    assert.equal(groups.length, 27);
    assert.ok(
      groups.every((g) => g.w > 0 && g.h < 200 && g.notes >= 3),
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
        'Scandicus/Climacus split menus open/ArrowDown/Escape/Tab/primary-reset/active name, menus inside viewport, cross-menu switching across all four families with at most one menu, score-dismiss then I/T, exact ghosts and repeat placement of all four variants with distinct IDs, T/I recall, keyboard End/Home/ArrowDown/Enter selection, ordinary quilismatic Scandicus and primary reset, v8 reload/export/import and v7 rejection, centre-point hit ownership of every constituent, count-aware labels, None-only mora and disabled form on longer groups with the three-note matrix/quilisma intact, episemata, B on a later constituent, move rejection announcements, valid move, whole-group transpose, 5->4->3->2 deletion with undo/redo, five-note clef-boundary Insert before/after, specimens and wrapping at 1440px and 320px',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
