import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-8d-acceptance-'));
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
async function key(key, code = key) {
  if (firefox) {
    const value =
      {
        Enter: '\uE007',
        Delete: '\uE017',
        Tab: '\uE004',
        Escape: '\uE00C',
        ArrowLeft: '\uE012',
        ArrowRight: '\uE014',
        ArrowUp: '\uE013',
        ArrowDown: '\uE015',
      }[key] ?? key;
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value },
            { type: 'keyUp', value },
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
        windowsVirtualKeyCode: {
          Tab: 9,
          Escape: 27,
          Enter: 13,
          ArrowLeft: 37,
          ArrowRight: 39,
          ArrowUp: 38,
          ArrowDown: 40,
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

const button = async (name) => {
  await ev(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(name)} || b.getAttribute('aria-label')===${JSON.stringify(name)});if(!b)throw Error('Missing button');b.click()})()`,
  );
  await pause();
};
async function selectGlyph(id) {
  await ev(`document.querySelector('[data-accidental-id="${id}"]').focus()`);
  await key('Enter');
}
const note = (id, staffPosition) => ({ id, staffPosition });
const envelope = (document) => ({
  format: 'gregorian-chant-editor',
  version: 5,
  document: {
    title: 'Acceptance pitch indications',
    lyricLanguage: 'und',
    clef: { type: 'c', staffLine: 4 },
    clefChanges: [],
    divisions: [],
    syllables: [],
    accidentals: [],
    ...document,
  },
});
async function indication(id, text, written) {
  await select(id);
  assert.match(
    await ev(
      `document.querySelector('[aria-label="Selected note properties"]').textContent`,
    ),
    new RegExp(text),
  );
  assert.equal(
    await ev(
      `document.querySelector('select[aria-label="Written accidental"]').value`,
    ),
    written,
  );
}
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate();
  await hydrate(
    envelope({
      neumes: [2, 3, 5, 5, 5, -2].map((staffPosition, i) => ({
        id: `g${i}`,
        kind: 'punctum',
        notes: [note(`n${i}`, staffPosition)],
      })),
      syllables: [
        {
          id: 'word',
          text: 'Proba',
          startsAtNeumeId: 'g0',
          boundaryBefore: 'word',
        },
      ],
    }),
  );
  await indication('n2', 'Effective B-natural \\(default\\)', 'none');
  await change('Written accidental', 'flat');
  await indication('n2', 'Effective B-flat \\(written\\)', 'flat');
  const flat = (await score()).accidentals[0];
  await indication('n3', 'Effective B-flat \\(inherited\\)', 'none');
  await change('Written accidental', 'natural');
  await indication('n3', 'Effective B-natural \\(written\\)', 'natural');
  await indication('n4', 'Effective B-natural \\(inherited\\)', 'none');
  await indication('n5', 'Effective B-natural \\(default\\)', 'none');
  const beforePlacement = await raw();
  await selectGlyph(flat.id);
  await key('Tab');
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-label')`),
    'Accidental kind',
  );
  await key('Tab');
  assert.equal(
    await ev('document.activeElement.textContent'),
    'Place above earlier note',
  );
  if (firefox) {
    // This BiDi environment does not perform default HTML key activation (also
    // reproduced on a plain button outside React). SVG keyboard input works.
    await button('Place above earlier note');
  } else await key(' ', 'Space');
  assert.equal(
    await ev(
      `document.querySelectorAll('[aria-label="Resolve lyric draft before history"]').length`,
    ),
    0,
  );
  assert.equal(
    await ev(`document.querySelector('[aria-label="Lyric syllables"]').inert`),
    true,
  );
  assert.equal(await ev('document.activeElement.dataset.noteId'), 'n0');
  await key('ArrowRight');
  assert.equal(await ev('document.activeElement.dataset.noteId'), 'n1');
  await key('Enter');
  assert.deepEqual(
    (await score()).accidentals.find((a) => a.id === flat.id).placement,
    { kind: 'above-note', noteId: 'n1' },
  );
  assert.equal(
    await ev('document.activeElement.dataset.accidentalId'),
    flat.id,
  );
  const placed = await raw();
  await button('Undo last edit');
  assert.equal(await raw(), beforePlacement);
  await button('Redo last undone edit');
  assert.equal(await raw(), placed);
  await select('n2');
  await key('Delete');
  const deleted = await score();
  assert.ok(!deleted.accidentals.some((a) => a.id === flat.id));
  assert.ok(deleted.neumes.some((n) => n.notes.some((p) => p.id === 'n3')));
  assert.equal(deleted.accidentals.length, 1, 'the other natural remains');
  await button('Undo last edit');
  assert.equal(await raw(), placed);
  // A genuine dirty-lyric history request must still show its existing prompt.
  await ev(
    `document.querySelector('[data-syllable-id="word"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
  );
  await pause();
  await ev(
    `(()=>{const e=document.querySelector('#lyric-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Draft');e.dispatchEvent(new Event('input',{bubbles:true}))})()`,
  );
  await pause();
  await button('Undo last edit');
  assert.equal(
    await ev(
      `document.querySelectorAll('[aria-label="Resolve lyric draft before history"]').length`,
    ),
    1,
  );
  assert.equal(await ev('document.activeElement.textContent'), 'Save draft');
  assert.equal(await raw(), placed);
  await button('Cancel history');
  assert.equal(
    await ev(`document.querySelector('#lyric-input').value`),
    'Draft',
  );
  await button('Cancel draft and exit');
  assert.equal(await raw(), placed);

  const groups = [
    { id: 'ordinary-flat', kind: 'punctum', notes: [note('flat-note', 5)] },
    {
      id: 'ordinary-natural',
      kind: 'punctum',
      notes: [note('natural-note', 5)],
    },
    {
      id: 'torculus',
      kind: 'torculus',
      notes: [note('tor-first', 5), note('tor-middle', 6), note('tor-last', 5)],
    },
    {
      id: 'porrectus',
      kind: 'porrectus',
      notes: [note('por-first', 5), note('por-middle', 4), note('por-last', 5)],
    },
    {
      id: 'pes',
      kind: 'podatus',
      notes: [note('pes-first', 4), note('pes-last', 5)],
    },
    {
      id: 'clivis',
      kind: 'clivis',
      notes: [note('clivis-first', 6), note('clivis-last', 5)],
    },
  ];
  const owners = [
    'flat-note',
    'natural-note',
    'tor-first',
    'por-first',
    'pes-last',
    'clivis-last',
  ];
  await hydrate(
    envelope({
      title: 'Stage 8D — representative signed chant (synthetic)',
      lyricLanguage: 'la',
      neumes: groups,
      accidentals: owners.map((ownerNoteId, i) => ({
        id: `sign-${i}`,
        kind: i % 2 === 0 ? 'flat' : 'natural',
        ownerNoteId,
      })),
      syllables: ['Be', 'á', 'tus', 'qui', 'ti', 'met'].map((text, i) => ({
        id: `text-${i}`,
        text,
        startsAtNeumeId: groups[i].id,
        boundaryBefore: [0, 3, 4].includes(i) ? 'word' : 'continuation',
      })),
    }),
  );
  assert.equal(
    await ev(`document.querySelectorAll('[data-accidental-id]').length`),
    6,
  );
  for (const id of ['torculus', 'porrectus'])
    assert.equal(
      await ev(
        `document.querySelectorAll('[data-neume-id="${id}"] [data-accidental-id]').length`,
      ),
      1,
    );
  await snapshot('acceptance-signed-chant');
  await select('natural-note');
  await key('Tab');
  await snapshot('acceptance-note-properties');

  const beata = await readFile(
    new URL('beata-editor.chant.json', import.meta.url),
    'utf8',
  );
  await hydrate(beata);
  await selectGlyph('historical-flat');
  await key('Tab');
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-label')`),
    'Accidental kind',
  );
  await snapshot('acceptance-beata-toolbar');
  const beforeTarget = await raw();
  await button('Place above earlier note');
  await snapshot('acceptance-beata-targeting');
  assert.ok(
    await ev(
      `document.querySelectorAll('select[aria-label="Earlier note"] option').length > 0`,
    ),
  );
  await key('Escape');
  assert.equal(await raw(), beforeTarget);
  assert.equal(
    await ev('document.activeElement.dataset.accidentalId'),
    'historical-flat',
  );
  const result = {
    browser: firefox ? 'Firefox/BiDi' : 'Chromium/CDP',
    userAgent: await ev('navigator.userAgent'),
    bundle: await ev(`[...document.scripts].find(s=>s.type==='module').src`),
    output,
    htmlPlacementStart: firefox
      ? 'DOM activation; native Tab and SVG Arrow/Enter verified'
      : 'native Tab/Space activation',
    checks: [
      'default/written/inherited pitch indications',
      'natural cancellation reflected on following B',
      'other register remains default',
      'native keyboard new-anchor commit and glyph focus',
      'no false lyric-history dialog during targeting; genuine dirty-history prompt retained',
      'atomic keyboard-placement undo/redo',
      'owner deletion preserves other B/natural',
      'live ordinary/repeated-B/lyric visual sheet',
      'live note/glyph properties and Beata targeting/cancel',
    ],
  };
  await writeFile(
    join(output, 'acceptance-result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result));
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
