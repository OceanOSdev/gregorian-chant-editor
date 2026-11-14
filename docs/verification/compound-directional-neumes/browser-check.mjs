import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
// Stage 9B-3 compound directional neumes (ADR 0025).
const output = await mkdtemp(join(tmpdir(), 'chant-compound-directional-'));
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
const menus = () =>
  ev(
    `[...document.querySelectorAll('[role="menu"]')].map(m=>m.getAttribute('aria-label'))`,
  );
const focusedTool = () => ev('document.activeElement?.dataset.tool ?? null');
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
  version: 9,
  document: {
    title: 'Stage 9B-3 compound directional neumes',
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
const syl = (id, text, at, boundaryBefore = 'word') => ({
  id,
  text,
  startsAtNeumeId: at,
  boundaryBefore,
});
const kinds = [
  'torculus-resupinus',
  'porrectus-flexus',
  'scandicus-flexus',
  'climacus-resupinus',
];
const familyOf = (kind) => kind.split('-')[0];
const label = (kind) => Title(kind).replace('-', ' ');
// Default contours (ADR 0025 plan) and click pitches inside the placement range.
const entryFirst = {
  'torculus-resupinus': 2,
  'porrectus-flexus': 4,
  'scandicus-flexus': 2,
  'climacus-resupinus': 5,
};
const contour = {
  'torculus-resupinus': [0, 2, 1, 3],
  'porrectus-flexus': [0, -2, 1, -1],
  'scandicus-flexus': [0, 1, 3, 2],
  'climacus-resupinus': [0, -1, -3, -2],
};
// Ghost path count: Punctum + Porrectus; Porrectus + fourth head (the join is
// a rect); Podatus + Clivis; virga + two diamonds + Punctum.
const ghostPaths = {
  'torculus-resupinus': 2,
  'porrectus-flexus': 2,
  'scandicus-flexus': 2,
  'climacus-resupinus': 4,
};
const menuPosition = {
  'torculus-resupinus': 1,
  'porrectus-flexus': 1,
  'scandicus-flexus': 3,
  'climacus-resupinus': 3,
};
const pressed = (id) =>
  ev(
    `document.querySelector('[data-note-id="${id}"]').getAttribute('aria-pressed')`,
  );
// Maintenance C: dismiss note properties natively before targeting score
// controls that the panel may cover.
async function closeNoteProperties() {
  const close = await ev(
    `(()=>{const e=document.querySelector('[aria-label="Close note properties"]');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  if (!close) return;
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...close,
      button: 'left',
      clickCount: 1,
    });
  await pause();
  assert.equal(
    await ev(
      `!!document.querySelector('[aria-label="Close note properties"]')`,
    ),
    false,
  );
}
const fixture = {
  ...base,
  document: {
    ...base.document,
    neumes: [
      neume('torculus-resupinus', 'tr', [2, 4, 3, 5]),
      neume('porrectus-flexus', 'pf', [4, 2, 3, 1]),
      neume('scandicus-flexus', 'sf', [2, 3, 5, 4]),
      neume('climacus-resupinus', 'cr', [5, 4, 3, 4]),
      neume('torculus-resupinus', 'tz', [2, 4, 2, 3]),
    ],
    syllables: [
      syl('l1', 'Chri', 'tr'),
      syl('l2', 'ste', 'pf', 'continuation'),
      syl('l3', 'e', 'sf'),
      syl('l4', 'le', 'cr'),
      syl('l5', 'i', 'tz', 'continuation'),
    ],
    divisions: [{ id: 'd1', kind: 'minor', beforeNeumeId: 'sf' }],
    // C clef on line 4: staff position 5 is B.
    accidentals: [{ id: 'b1', kind: 'flat', ownerNoteId: 'tr-3' }],
  },
};
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
    // Family menus: keyboard browse to the named figure, Escape, Tab.
    for (const kind of kinds) {
      const family = familyOf(kind);
      await pointer(arrow(family));
      assert.deepEqual(await menus(), [`${Title(family)} family`]);
      for (let i = 0; i < menuPosition[kind]; i++) await key('ArrowDown');
      assert.equal(
        await ev('document.activeElement.textContent.trim()'),
        label(kind),
      );
      const menuBox = await ev(
        `(()=>{const r=document.querySelector('[role="menu"]').getBoundingClientRect();return {left:r.left,right:r.right}})()`,
      );
      assert.ok(
        menuBox.left >= 0 && menuBox.right <= width,
        `menu inside viewport at ${width}px`,
      );
      await key('Escape');
      assert.equal(await focusedTool(), `${family}-menu`);
      assert.deepEqual(await menus(), []);
      await pointer(arrow(family));
      await key('Tab');
      assert.deepEqual(await menus(), []);
      assert.equal(await raw(), original);
    }
    await snapshot(`palette-${width}`, '.neume-palette');
    // Cross-menu switching across all six families: at most one menu open.
    const families = [
      'punctum',
      'podatus',
      'scandicus',
      'torculus',
      'climacus',
      'porrectus',
    ];
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
        await key('Escape');
        await ev(`document.querySelector('${arrow(to)}').focus()`);
        await pause();
        await key('Enter');
      }
      assert.deepEqual(await menus(), [`${Title(to)} family`]);
      await closeMenus();
    }
    assert.equal(
      await ev(
        `document.querySelectorAll('.neume-palette [tabindex="0"]').length`,
      ),
      1,
      'one toolbar Tab stop',
    );
    for (const kind of kinds) {
      const family = familyOf(kind);
      const first = entryFirst[kind];
      // A score click with a menu open only dismisses; then I and T.
      const unchanged = await raw();
      await choose(kind);
      assert.equal(
        await ev(`document.querySelector('${arrow(family)}').ariaLabel`),
        `${Title(family)} family variants, active ${label(kind)}`,
      );
      await pointer(arrow(family));
      await placeAt(first);
      assert.equal(await raw(), unchanged, 'score click only dismisses');
      assert.equal(await focusedTool(), `${family}-menu`);
      await key('i', 'KeyI');
      let doc = await score();
      assert.equal(doc.neumes.at(-1).kind, kind, 'I inserts the variant');
      await key('t', 'KeyT');
      assert.equal(await focusedTool(), `${family}-menu`);
      await undo();
      // Undo may re-serialize equivalent bytes; compare the document.
      assert.deepEqual(await score(), JSON.parse(unchanged).document);
      // One click places all four notes; the tool stays armed.
      await closeMenus();
      await choose(kind);
      const ghost = await placeAt(first);
      assert.equal(ghost.length, ghostPaths[kind], `${kind} ghost`);
      // A different pitch moves the real pointer (Firefox does not re-hover
      // an identical position).
      await placeAt(first + 1);
      doc = await score();
      const added = doc.neumes
        .filter((n) => n.kind === kind)
        .sort((a, b) => a.notes[0].staffPosition - b.notes[0].staffPosition);
      assert.equal(added.length, 2);
      added.forEach((n, i) =>
        assert.deepEqual(
          n.notes.map((x) => x.staffPosition),
          contour[kind].map((o) => first + i + o),
        ),
      );
      assert.equal(
        new Set(added.flatMap((n) => [n.id, ...n.notes.map((x) => x.id)])).size,
        10,
        'distinct IDs',
      );
      await undo();
      await undo();
      await ev(`document.querySelector('${primary('select')}').click()`);
      await pause();
    }
    assert.deepEqual(await score(), JSON.parse(original).document);
    // Contextual editing on a fixture of all four kinds.
    await hydrate(fixture);
    const before = await score();
    const specimen = [
      ['tr', 4],
      ['pf', 4],
      ['sf', 4],
      ['cr', 4],
    ];
    for (const [id, count] of specimen)
      for (let i = 0; i < count; i++) {
        const target = `[data-note-id="${id}-${i}"] .score__note-hit-target`;
        await ev(
          `document.querySelector('${target}').scrollIntoView({block:'center'})`,
        );
        const owner = await ev(
          `(()=>{const r=document.querySelector('${target}').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-note-id]')?.dataset.noteId})()`,
        );
        assert.equal(owner, `${id}-${i}`, `${id}-${i} owns its center`);
      }
    // Pointer selection of both ends of the diagonal strokes.
    for (const id of ['tr-1', 'tr-2', 'pf-0', 'pf-1', 'pf-3', 'cr-3']) {
      await closeNoteProperties();
      await pointer(`[data-note-id="${id}"] .score__note-hit-target`);
      assert.equal(await pressed(id), 'true', `${id} selected by pointer`);
    }
    await closeNoteProperties();
    for (const kind of kinds) {
      const id = {
        'torculus-resupinus': 'tr',
        'porrectus-flexus': 'pf',
        'scandicus-flexus': 'sf',
        'climacus-resupinus': 'cr',
      }[kind];
      assert.match(
        await ev(
          `document.querySelector('[data-note-id="${id}-3"]').getAttribute('aria-label')`,
        ),
        new RegExp(`fourth note of ${label(kind).toLowerCase()}`),
      );
    }
    // Exactly None/Final note mora; no authorable form.
    await select('tr-3');
    assert.deepEqual(
      await ev(
        `[...document.querySelector('[aria-label="Mora scope"]').options].map(o=>o.value)`,
      ),
      ['none', 'final'],
    );
    assert.equal(
      await ev(`document.querySelector('[aria-label="Form"]').disabled`),
      true,
    );
    await change('Mora scope', 'final');
    await change('Vertical episema', 'on');
    await select('tr-1');
    await change('Horizontal episema', 'on');
    const marked = await score();
    assert.deepEqual(
      marked.neumes[0].notes.map((n) => [
        n.mora ?? 0,
        !!n.episema,
        !!n.verticalEpisema,
      ]),
      [
        [0, false, false],
        [0, true, false],
        [0, false, false],
        [1, false, true],
      ],
    );
    assert.deepEqual(marked.accidentals, before.accidentals);
    // Invalid individual move rejects atomically with an announcement.
    await select('sf-0');
    await key('ArrowUp');
    assert.deepEqual(await score(), marked);
    assert.match(
      await announcement(),
      /scandicus flexus must keep its contour/,
    );
    // Valid individual move keeps IDs.
    await select('cr-3');
    await key('ArrowUp');
    assert.deepEqual(
      (await score()).neumes[3].notes.map((n) => [n.id, n.staffPosition]),
      [
        ['cr-0', 5],
        ['cr-1', 4],
        ['cr-2', 3],
        ['cr-3', 5],
      ],
    );
    await undo();
    assert.deepEqual(await score(), marked);
    // Whole-neume transposition.
    await ev(`document.querySelector('[data-note-id="pf-0"]').focus()`);
    await key('Enter', 'Enter', true);
    await key('ArrowDown');
    assert.deepEqual(
      (await score()).neumes[1].notes.map((n) => n.staffPosition),
      [3, 1, 2, 0],
    );
    await undo();
    assert.deepEqual(await score(), marked);
    // Normalization: first-note deletion yields a Porrectus, keeping IDs,
    // marks, B ownership and the lyric anchor; exact undo/redo.
    await select('tr-0');
    await key('Delete');
    const normalized = await score();
    assert.equal(normalized.neumes[0].kind, 'porrectus');
    assert.deepEqual(
      normalized.neumes[0].notes,
      marked.neumes[0].notes.slice(1),
    );
    assert.deepEqual(normalized.accidentals, marked.accidentals);
    assert.deepEqual(normalized.syllables, marked.syllables);
    await undo();
    assert.deepEqual(await score(), marked);
    await redo();
    assert.deepEqual(await score(), normalized);
    await undo();
    // Deleting the marked note removes the mora and the B with their owner.
    await select('tr-3');
    await key('Delete');
    const ownerless = await score();
    assert.equal(ownerless.neumes[0].kind, 'torculus');
    assert.ok(ownerless.neumes[0].notes.every((n) => !n.mora));
    assert.deepEqual(ownerless.accidentals, []);
    await undo();
    // Scandicus flexus middle deletion yields a Torculus.
    await select('sf-1');
    await key('Delete');
    assert.equal((await score()).neumes[2].kind, 'torculus');
    await undo();
    // Equal adjacent survivors reject with an announcement.
    await select('tz-1');
    await key('Delete');
    assert.deepEqual(await score(), marked);
    assert.match(await announcement(), /two equal adjacent pitches/);
    // Native v9 reload, export and import; a v8 file is rejected.
    const bytes = await raw();
    assert.equal(JSON.parse(bytes).version, 9);
    await navigate();
    assert.equal(await raw(), bytes, 'reload keeps v9 bytes');
    await ev(
      `window.__download=null;URL.createObjectURL=blob=>{window.__download=blob;return 'blob:captured'};HTMLAnchorElement.prototype.click=function(){}`,
    );
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export').click()`,
    );
    await pause();
    const exported = await ev('window.__download.text()');
    assert.deepEqual(JSON.parse(exported), JSON.parse(bytes));
    await importText(exported);
    assert.deepEqual(await score(), JSON.parse(bytes).document);
    const before8 = await raw();
    await importText(JSON.stringify({ ...JSON.parse(exported), version: 8 }));
    assert.equal(await raw(), before8, 'v8 rejects compound kinds');
    await snapshot('engraving-' + width);
    assert.equal(
      await ev(`document.documentElement.scrollWidth<=innerWidth`),
      true,
      'no horizontal page overflow',
    );
    // Wrapping: many groups stay whole across systems.
    const many = {
      ...base,
      document: {
        ...base.document,
        neumes: Array.from({ length: 24 }, (_, i) =>
          neume(
            kinds[i % 4],
            `w${i}`,
            [
              [2, 4, 3, 5],
              [4, 2, 3, 1],
              [2, 3, 5, 4],
              [5, 4, 3, 4],
            ][i % 4],
          ),
        ),
        syllables: Array.from({ length: 24 }, (_, i) =>
          syl(`ws${i}`, 'la', `w${i}`),
        ),
      },
    };
    await hydrate(many);
    const groups = await ev(
      `[...document.querySelectorAll('g[data-neume-kind]')].map(n=>({notes:n.querySelectorAll('[data-note-id]').length,h:n.getBBox().height}))`,
    );
    assert.equal(groups.length, 24);
    assert.ok(
      groups.every((g) => g.notes === 4 && g.h < 200),
      'whole groups',
    );
    assert.ok(
      (await ev(
        `new Set([...document.querySelectorAll('.score__staff-line')].map(l=>l.getAttribute('y1'))).size/4`,
      )) > 1,
      'wraps to more than one system',
    );
    await snapshot('wrapping-' + width);
  }
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox/BiDi' : 'Chromium/CDP',
      userAgent: await ev('navigator.userAgent'),
      output,
      checks:
        'six split families (keyboard browse to each named figure, Escape/Tab, viewport, cross-menu with at most one open, one Tab stop), dismiss-only score click then I/T recall, exact ghosts and repeated one-click placement of all four kinds with distinct IDs, centre-point hit ownership of all 16 constituents, pointer selection of both stroke ends, labels, None/Final mora only and disabled form, episemata, B ownership, move rejection announcement, valid move, whole-neume transpose, contour normalization with marks/B/lyric kept and exact undo/redo, mark/B removed with owner, equal-survivor rejection, v9 reload/export/import and v8 rejection, wrapping, at 1440px and 320px',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
