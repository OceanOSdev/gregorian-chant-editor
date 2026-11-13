import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-b-accidentals-'));
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
  await ev(
    `(()=>{const input=document.querySelector('input[type="file"]');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],'score.chant.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  await pause();
}
async function key(key, code = key) {
  if (firefox) {
    const value =
      {
        Enter: '\uE007',
        Delete: '\uE017',
        Tab: '\uE004',
        Escape: '\uE00C',
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

const p = (id, staffPosition, extra = {}) => ({ id, staffPosition, ...extra });
function fixture(lower = false) {
  const prefix = lower
    ? Array.from({ length: 22 }, (_, i) => ({
        id: 'lead' + i,
        kind: 'punctum',
        notes: [p('lead-note' + i, 3)],
      }))
    : [];
  return {
    format: 'gregorian-chant-editor',
    version: 5,
    document: {
      title: 'Stage 8D accidental interaction specimen',
      lyricLanguage: 'la',
      clef: { type: 'c', staffLine: 4 },
      clefChanges: [],
      divisions: [],
      accidentals: [],
      syllables: [
        ...(prefix.length
          ? [
              {
                id: 'lead-text',
                text: 'Proba',
                startsAtNeumeId: 'lead0',
                boundaryBefore: 'word',
              },
            ]
          : []),
        {
          id: 'o',
          text: 'o',
          startsAtNeumeId: 'descending',
          boundaryBefore: 'word',
        },
        {
          id: 'mnis',
          text: 'mnis',
          startsAtNeumeId: 'repeat',
          boundaryBefore: 'continuation',
        },
      ],
      neumes: [
        ...prefix,
        {
          id: 'descending',
          kind: 'climacus',
          notes: [p('c', 6), p('a1', 4), p('g1', 3)],
        },
        {
          id: 'f',
          kind: 'punctum',
          notes: [p('anchorF', 2, { form: 'inclinatum' })],
        },
        {
          id: 'ga',
          kind: 'podatus',
          notes: [p('g', 3, { form: 'quilisma' }), p('a', 4)],
        },
        {
          id: 'b',
          kind: 'climacus',
          notes: [p('ownerB', 5), p('a2', 4), p('g2', 3)],
        },
        {
          id: 'repeat',
          kind: 'torculus',
          notes: [
            p('repeatFirst', 5),
            p('repeatMiddle', 6),
            p('repeatLast', 5),
          ],
        },
        {
          id: 'porrectus',
          kind: 'porrectus',
          notes: [p('porFirst', 5), p('porMiddle', 4), p('porLast', 5)],
        },
        { id: 'cancel', kind: 'punctum', notes: [p('naturalB', 5)] },
      ],
    },
  };
}
const button = async (text) => {
  await ev(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)} || b.getAttribute('aria-label')===${JSON.stringify(text)});if(!b)throw Error('Missing button '+${JSON.stringify(text)});b.click()})()`,
  );
  await pause();
};
const glyph = (id) => `[data-accidental-id="${id}"]`;
async function pointer(selector) {
  await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();window.scrollBy({top:r.top+r.height/2-innerHeight/2,behavior:'instant'});})()`,
  );
  await pause();
  const p = await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=(e.querySelector('.score__note-hit-target')??e).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...p,
      button: 'left',
      clickCount: 1,
    });
  await pause();
}
async function selectGlyph(id) {
  await ev(`document.querySelector(${JSON.stringify(glyph(id))}).focus()`);
  await key('Enter');
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
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate();
  await hydrate(fixture(true));
  await select('ownerB');
  await key('Tab');
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-label')`),
    'Written accidental',
  );
  await key('ArrowDown');
  await key('Tab');
  const signed = JSON.parse(await raw());
  assert.equal(signed.version, 5);
  assert.equal(signed.document.accidentals.length, 1);
  const id = signed.document.accidentals[0].id;
  assert.equal(signed.document.accidentals[0].ownerNoteId, 'ownerB');
  await snapshot('lower-default');
  await select('repeatLast');
  await change('Written accidental', 'flat');
  const repeated = (await score()).accidentals.find(
    (a) => a.ownerNoteId === 'repeatFirst',
  );
  assert.ok(repeated);
  await select('repeatFirst');
  assert.equal(
    await ev(
      `document.querySelector('select[aria-label="Written accidental"]').value`,
    ),
    'flat',
  );
  await select('porLast');
  await change('Written accidental', 'natural');
  assert.ok(
    (await score()).accidentals.some(
      (a) => a.ownerNoteId === 'porFirst' && a.kind === 'natural',
    ),
  );
  await select('naturalB');
  await change('Written accidental', 'natural');
  await selectGlyph(id);
  await key('Tab');
  await key('ArrowDown');
  await key('Tab');
  assert.equal(
    (await score()).accidentals.find((a) => a.id === id).kind,
    'natural',
  );
  await change('Accidental kind', 'flat');
  assert.equal(
    (await score()).accidentals.find((a) => a.id === id).ownerNoteId,
    'ownerB',
  );
  const beforeTarget = await raw();
  await selectGlyph(id);
  await key('Tab');
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-label')`),
    'Accidental kind',
  );
  await button('Place above earlier note');
  assert.equal(
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete accidental').disabled`,
    ),
    true,
  );
  assert.equal(
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Place above earlier note').disabled`,
    ),
    true,
  );
  await pointer('[data-note-id="ownerB"]');
  assert.equal(await raw(), beforeTarget);
  assert.match(
    await ev(`document.querySelector('.editor-announcement').textContent`),
    /not an eligible/,
  );
  await ev(
    `document.querySelector('select[aria-label="Earlier note"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,isComposing:true}))`,
  );
  assert.equal(
    await ev(
      `!!document.querySelector('[aria-label="Choose accidental placement"]')`,
    ),
    true,
  );
  await key('Escape');
  assert.equal(await raw(), beforeTarget);
  assert.match(
    await ev(`document.querySelector('.editor-announcement').textContent`),
    /canceled/,
  );
  assert.equal(
    await ev(
      `document.querySelectorAll('[aria-label="Choose accidental placement"]').length`,
    ),
    0,
  );
  assert.equal(await ev(`document.activeElement.dataset.accidentalId`), id);

  await selectGlyph(id);
  await button('Place above earlier note');
  await pointer('[data-note-id="anchorF"]');
  assert.deepEqual(
    (await score()).accidentals.find((a) => a.id === id).placement,
    { kind: 'above-note', noteId: 'anchorF' },
  );
  const placed = await raw();
  await snapshot('lower-anchored');
  await selectGlyph(id);
  await button('Place above earlier note');
  await button('Use highlighted note');
  assert.equal(
    await raw(),
    placed,
    'same anchor must not write or create history',
  );
  assert.match(
    await ev(`document.querySelector('.editor-announcement').textContent`),
    /unchanged/,
  );
  await button('Undo last edit');
  assert.equal(await raw(), beforeTarget);
  await button('Redo last undone edit');
  assert.equal(await raw(), placed);
  await selectGlyph(id);
  await button('Restore default placement');
  assert.equal(await raw(), beforeTarget);
  await button('Undo last edit');
  assert.equal(await raw(), placed);
  await select('anchorF');
  await key('Delete');
  assert.equal(
    (await score()).accidentals.find((a) => a.id === id).placement,
    undefined,
  );
  assert.ok((await score()).accidentals.some((a) => a.id === id));
  await button('Undo last edit');
  assert.equal(await raw(), placed);
  await selectGlyph(id);
  await key('Delete');
  assert.equal(
    (await score()).accidentals.some((a) => a.id === id),
    false,
  );
  assert.ok(
    (await score()).neumes.some((n) =>
      n.notes.some((note) => note.id === 'ownerB'),
    ),
  );
  assert.equal(await ev(`document.activeElement.dataset.noteId`), 'ownerB');

  await button('Undo last edit');
  assert.equal(await raw(), placed);
  await select('anchorF');
  await ev(`document.querySelector(${JSON.stringify(glyph(id))}).focus()`);
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-pressed')`),
    'false',
  );
  await key('Delete');
  assert.equal(await ev(`document.activeElement.dataset.noteId`), 'ownerB');
  await button('Undo last edit');
  assert.equal(await raw(), placed);
  await navigate();
  assert.equal(await raw(), placed);
  // Both authored kinds are counted; cancellation preserves exact cache bytes.
  const clefFixture = fixture();
  clefFixture.document.clefChanges = [
    {
      id: 'edit-clef',
      clef: { type: 'c', staffLine: 4 },
      beforeNeumeId: 'descending',
      beforeDivisionId: null,
    },
  ];
  clefFixture.document.accidentals = [
    { id: 'flat-owner', kind: 'flat', ownerNoteId: 'ownerB' },
    { id: 'natural-owner', kind: 'natural', ownerNoteId: 'repeatFirst' },
  ];
  await hydrate(clefFixture);
  await ev(
    `document.querySelector('[data-clef-change-id="edit-clef"]').focus()`,
  );
  await key('Enter');
  await ev(
    `document.querySelector('input[name="clef-insertion-policy"][value="noteheads"]').click()`,
  );
  await button('Edit clef change');
  const beforeWarning = await raw();
  await change('Draft clef staff line', '3');
  assert.equal(await raw(), beforeWarning);
  await button('Apply clef change');
  assert.match(
    await ev(`document.querySelector('[role="dialog"]').textContent`),
    /remove 2 written accidentals/,
  );
  assert.equal(await raw(), beforeWarning);
  await snapshot('clef-loss-warning');
  await button('Cancel clef change');
  assert.equal(await raw(), beforeWarning);
  await button('Edit clef change');
  await change('Draft clef staff line', '3');
  await button('Apply clef change');
  await button('Remove written accidentals and apply');
  assert.equal((await score()).accidentals.length, 0);
  await button('Undo last edit');
  assert.deepEqual(JSON.parse(await raw()), JSON.parse(beforeWarning));
  // Keep pitches preserves authored identities, kinds and anchored location.
  await ev(
    `document.querySelector('[data-clef-change-id="edit-clef"]').focus()`,
  );
  await key('Enter');
  await ev(
    `document.querySelector('input[name="clef-insertion-policy"][value="melody"]').click()`,
  );
  await button('Edit clef change');
  await change('Draft clef staff line', '3');
  await button('Apply clef change');
  assert.deepEqual(
    (await score()).accidentals,
    clefFixture.document.accidentals,
  );
  const shifted = await score();
  for (const neume of shifted.neumes)
    for (const note of neume.notes) {
      const old = clefFixture.document.neumes
        .flatMap((n) => n.notes)
        .find((n) => n.id === note.id);
      assert.equal(note.staffPosition + 2, old.staffPosition);
    }
  await snapshot('clef-keep-pitches');
  // Reference excerpt: retain the supported compound contours and the earlier F.
  const reference = fixture();
  reference.document.title = 'Beata gens — supported omnis excerpt';
  reference.document.neumes = reference.document.neumes.slice(0, 4);
  reference.document.neumes[0].notes[1].verticalEpisema = true;
  reference.document.neumes[1].notes[0].verticalEpisema = true;
  reference.document.neumes[3].notes[0].episema = true;
  reference.document.neumes.push({
    id: 'mnis-group',
    kind: 'clivis',
    notes: [p('mnis-a', 4), p('mnis-g', 3)],
  });
  reference.document.syllables[1].startsAtNeumeId = 'mnis-group';
  reference.document.accidentals = [
    {
      id: 'historical-flat',
      kind: 'flat',
      ownerNoteId: 'ownerB',
      placement: { kind: 'above-note', noteId: 'anchorF' },
    },
  ];
  await hydrate(reference);
  await snapshot('beata-reference');
  await writeFile(
    join(output, 'beata-editor.chant.json'),
    JSON.stringify(reference, null, 2),
  );
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await selectGlyph('historical-flat');
    await snapshot('anchored-' + width);
    assert.equal(
      await ev(
        `document.querySelectorAll('[data-accidental-id="historical-flat"]').length`,
      ),
      1,
    );
    const bounds = await ev(
      `(()=>{const g=document.querySelector('[data-accidental-id="historical-flat"]'),r=g.getBoundingClientRect(),f=document.querySelector('[data-note-id="anchorF"]').getBoundingClientRect();return {glyph:r.toJSON(),anchor:f.toJSON()}})()`,
    );
    await writeFile(
      join(output, 'bounds-' + width + '.json'),
      JSON.stringify(bounds, null, 2),
    );
  }
  await hydrate(reference);
  await button('Place division');
  await ev(
    `(()=>{const r=document.querySelector('[data-note-id="ownerB"]').getBoundingClientRect();window.scrollBy({top:r.top+r.height/2-innerHeight/2,behavior:'instant'});})()`,
  );
  await pause();
  const point = await ev(
    `(()=>{const r=document.querySelector('[data-note-id="ownerB"] .score__note-hit-target').getBoundingClientRect();return{x:r.left-10,y:r.top+r.height/2}})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
  assert.equal((await score()).divisions.length, 1);
  assert.equal((await score()).divisions[0].beforeNeumeId, 'b');
  assert.equal((await score()).accidentals[0].placement, undefined);
  await snapshot('division-restoration');
  await button('Undo last edit');
  assert.deepEqual(await score(), reference.document);
  await button('Select');
  const wordFixture = structuredClone(reference);
  wordFixture.document.syllables.splice(1, 0, {
    id: 'owner-text',
    text: 'ni',
    startsAtNeumeId: 'b',
    boundaryBefore: 'continuation',
  });
  await hydrate(wordFixture);
  await button('Syllable 2: ni');
  const beforeWord = await raw();
  await change('Word boundary', 'word');
  assert.equal(await raw(), beforeWord, 'lyric draft does not save');
  await button('Save syllable');
  await button('Done');
  assert.equal((await score()).accidentals[0].placement, undefined);
  assert.match(
    await ev(`document.querySelector('.editor-announcement').textContent`),
    /restored|Lyrics/,
  );
  await button('Undo last edit');
  assert.deepEqual(await score(), wordFixture.document);
  // Same semantic anchor with its B owner on a later system.
  const cross = fixture();
  cross.document.neumes.splice(
    3,
    0,
    ...Array.from({ length: 24 }, (_, i) => ({
      id: 'span' + i,
      kind: 'punctum',
      notes: [p('spann' + i, 3)],
    })),
  );
  cross.document.accidentals = reference.document.accidentals;
  await hydrate(cross);
  await snapshot('cross-system');
  const systems = await ev(
    `(()=>{const a=document.querySelector('[data-note-id="anchorF"]'),b=document.querySelector('[data-note-id="ownerB"]');return [a.closest('[data-system-index]')?.getAttribute('data-system-index'),b.closest('[data-system-index]')?.getAttribute('data-system-index')]})()`,
  );
  assert.notEqual(systems[0], systems[1]);
  // Real export/import paths, capturing the Blob rather than OS download UI.
  await ev(
    `window.confirm=()=>true;window.__download=null;URL.createObjectURL=blob=>{window.__download=blob;return 'blob:captured'};HTMLAnchorElement.prototype.click=function(){}`,
  );
  await button('Export');
  const exported = await ev('window.__download.text()');
  assert.deepEqual(JSON.parse(exported).document, await score());
  await importText(exported);
  assert.deepEqual(await score(), JSON.parse(exported).document);
  const referenceMetrics = [];
  for (const name of [
    'laetatus-torculus',
    'ecce-porrectus',
    'benedicta-mater',
    'beata-natural',
  ]) {
    const source = await readFile(
      new URL(name + '.chant.json', import.meta.url),
      'utf8',
    );
    await hydrate(source);
    assert.equal(
      await ev(`document.querySelector('svg.score title').textContent`),
      JSON.parse(source).document.title,
    );
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await snapshot(name);
    referenceMetrics.push({
      name,
      glyphs: await ev(
        `(()=>{const box=e=>{const b=e.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height}};return [...document.querySelectorAll('[data-accidental-id]')].map(g=>({id:g.dataset.accidentalId,ink:box(g.querySelector('.score__accidental-ink')),hit:box(g.querySelector('.score__accidental-target'))}))})()`,
      ),
    });
  }
  await writeFile(
    join(output, 'reference-metrics.json'),
    JSON.stringify(referenceMetrics, null, 2),
  );
  await hydrate(reference);
  const beforePrint = await ev(
    `document.querySelector('.score__accidental-ink').getAttribute('d')`,
  );
  await selectGlyph('historical-flat');
  const pdf = await send('Page.printToPDF', { printBackground: true });
  await writeFile(join(output, 'print.pdf'), Buffer.from(pdf.data, 'base64'));
  assert.equal(
    await ev(
      `document.querySelector('.score__accidental-ink').getAttribute('d')`,
    ),
    beforePrint,
  );
  // Review regressions: actual SVG/print clipping and later lyric collisions.
  for (const kind of ['flat', 'natural'])
    for (const explicit of [false, true]) {
      const high = fixture();
      high.document.title = `High ${kind} ${explicit}`;
      high.document.clef = { type: 'f', staffLine: 4 };
      high.document.neumes = [
        {
          id: 'a',
          kind: 'punctum',
          notes: [{ id: 'anchor', staffPosition: 8 }],
        },
        {
          id: 'b',
          kind: 'punctum',
          notes: [{ id: 'owner', staffPosition: 9 }],
        },
      ];
      high.document.syllables = [];
      high.document.accidentals = [
        {
          id: 'high',
          kind,
          ownerNoteId: 'owner',
          ...(explicit
            ? { placement: { kind: 'above-note', noteId: 'anchor' } }
            : {}),
        },
      ];
      await hydrate(high);
      const box = await ev(
        `(()=>{const s=document.querySelector('svg.score'),v=s.viewBox.baseVal,b=s.querySelector('.score__accidental-ink').getBBox();return {top:v.y,bottom:v.y+v.height,inkTop:b.y,inkBottom:b.y+b.height}})()`,
      );
      assert.ok(
        box.top < 0 && box.inkTop >= box.top && box.inkBottom <= box.bottom,
        JSON.stringify(box),
      );
      await snapshot(`high-${kind}-${explicit}`);
      if (kind === 'natural' && explicit) {
        const printed = await send('Page.printToPDF', {
          printBackground: true,
        });
        await writeFile(
          join(output, 'high-print.pdf'),
          Buffer.from(printed.data, 'base64'),
        );
      }
    }
  for (const continuation of [false, true]) {
    const low = fixture();
    low.document.title = `Lyric collision ${continuation}`;
    low.document.lyricLanguage = 'und';
    low.document.neumes = [
      ...(continuation
        ? [
            {
              id: 'before',
              kind: 'punctum',
              notes: [{ id: 'before-note', staffPosition: 4 }],
            },
          ]
        : []),
      {
        id: 'low',
        kind: 'punctum',
        notes: [{ id: 'low-note', staffPosition: -2 }],
      },
      {
        id: 'text',
        kind: 'punctum',
        notes: [{ id: 'text-note', staffPosition: 4 }],
      },
    ];
    low.document.syllables = [
      ...(continuation
        ? [
            {
              id: 'first-text',
              text: 'A',
              startsAtNeumeId: 'before',
              boundaryBefore: 'word',
            },
          ]
        : []),
      {
        id: 'last-text',
        text: 'Benedictus',
        startsAtNeumeId: 'text',
        boundaryBefore: continuation ? 'continuation' : 'word',
      },
    ];
    low.document.accidentals = [
      { id: 'low-sign', kind: 'natural', ownerNoteId: 'low-note' },
    ];
    await hydrate(low);
    const collisions = await ev(
      `(()=>{const b=document.querySelector('.score__accidental-ink').getBBox();return [...document.querySelectorAll('.score__lyric,.score__hyphens text')].map(e=>{const r=e.getBBox();return b.x<r.x+r.width && b.x+b.width>r.x && b.y<r.y+r.height && b.y+b.height>r.y}).filter(Boolean).length})()`,
    );
    assert.equal(collisions, 0);
    await snapshot(`lyric-collision-${continuation}`);
  }
  // Current-group low signs must leave a real interval for the incoming hyphen.
  for (const explicit of [true, false]) {
    const edge = fixture();
    edge.document.title = `Current group hyphen ${explicit ? 'anchored' : 'prefix'}`;
    edge.document.clef = { type: 'c', staffLine: 3 };
    edge.document.lyricLanguage = 'und';
    edge.document.neumes = [4, 4, -4].map((staffPosition, i) => ({
      id: `g${i}`,
      kind: 'punctum',
      notes: [{ id: `n${i}`, staffPosition }],
    }));
    edge.document.syllables = [
      { id: 'a', text: 'A', startsAtNeumeId: 'g0', boundaryBefore: 'word' },
      {
        id: 'men',
        text: 'men',
        startsAtNeumeId: explicit ? 'g1' : 'g2',
        boundaryBefore: 'continuation',
      },
    ];
    edge.document.accidentals = [
      {
        id: 'current-natural',
        kind: 'natural',
        ownerNoteId: 'n2',
        ...(explicit
          ? { placement: { kind: 'above-note', noteId: 'n1' } }
          : {}),
      },
    ];
    await hydrate(edge);
    const metrics = await ev(
      `(()=>{const box=e=>{const b=e.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height}};return {signs:[...document.querySelectorAll('.score__accidental-ink')].map(box),hyphens:[...document.querySelectorAll('.score__hyphens text')].map(box),lyrics:[...document.querySelectorAll('.score__lyric')].map(box)}})()`,
    );
    assert.equal(metrics.hyphens.length, 1);
    assert.equal(metrics.signs.length, 1);
    for (const h of metrics.hyphens)
      for (const b of [...metrics.signs, ...metrics.lyrics]) {
        assert.ok(
          h.x + h.width <= b.x ||
            h.x >= b.x + b.width ||
            h.y + h.height <= b.y ||
            h.y >= b.y + b.height,
          JSON.stringify(metrics),
        );
      }
    assert.deepEqual((await score()).accidentals, edge.document.accidentals);
    await writeFile(
      join(output, `current-group-${explicit}-metrics.json`),
      JSON.stringify(metrics, null, 2),
    );
    await snapshot(`current-group-${explicit}`);
    if (explicit) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 320,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await snapshot('current-group-320');
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
    }
  }
  // A sign that ends before the previous lyric's right edge cannot obstruct a
  // hyphen, so it must not force a narrow native-font join apart (Stage 8D
  // final revision). Unsigned and signed layouts keep the same compact gap.
  for (const text of ['i', 'e']) {
    const gaps = [];
    for (const signed of [false, true]) {
      const narrow = fixture();
      narrow.document.title = `Narrow join ${text} ${signed ? 'signed' : 'unsigned'}`;
      narrow.document.clef = { type: 'c', staffLine: 3 };
      narrow.document.lyricLanguage = 'und';
      narrow.document.neumes = [4, 4, 4, -4].map((staffPosition, i) => ({
        id: `g${i}`,
        kind: 'punctum',
        notes: [{ id: `n${i}`, staffPosition }],
      }));
      narrow.document.syllables = [
        { id: 'w', text: 'A', startsAtNeumeId: 'g0', boundaryBefore: 'word' },
        { id: 'x', text, startsAtNeumeId: 'g1', boundaryBefore: 'word' },
        {
          id: 'men',
          text: 'men',
          startsAtNeumeId: 'g2',
          boundaryBefore: 'continuation',
        },
      ];
      narrow.document.accidentals = signed
        ? [
            {
              id: 'anchored-natural',
              kind: 'natural',
              ownerNoteId: 'n3',
              placement: { kind: 'above-note', noteId: 'n1' },
            },
          ]
        : [];
      await hydrate(narrow);
      const metrics = await ev(
        `(()=>{const box=e=>{const b=e.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height}};return {signs:[...document.querySelectorAll('.score__accidental-ink')].map(box),hyphens:[...document.querySelectorAll('.score__hyphens text')].map(box),lyrics:[...document.querySelectorAll('.score__lyric')].map(box)}})()`,
      );
      assert.equal(metrics.hyphens.length, 0, JSON.stringify(metrics));
      assert.equal(metrics.signs.length, signed ? 1 : 0);
      const [, before, after] = metrics.lyrics;
      if (signed)
        assert.ok(
          metrics.signs[0].x + metrics.signs[0].width <=
            before.x + before.width,
          'the sign ends before the previous lyric edge',
        );
      gaps.push(after.x - (before.x + before.width));
      if (signed) {
        await writeFile(
          join(output, `narrow-join-${text}-metrics.json`),
          JSON.stringify(metrics, null, 2),
        );
        await snapshot(`narrow-join-${text}`);
      }
    }
    assert.ok(Math.abs(gaps[0] - gaps[1]) < 0.01, JSON.stringify(gaps));
  }
  // A clef boundary between the written anchor and B must preserve exact placement.
  const crossing = structuredClone(reference);
  crossing.document.clefChanges = [
    {
      id: 'between',
      clef: { type: 'c', staffLine: 4 },
      beforeNeumeId: 'b',
      beforeDivisionId: null,
    },
  ];
  await hydrate(crossing);
  const beforeCross = await score();
  const beforeHeight = await ev(
    `document.querySelector('.score__accidental-ink').getBBox().y`,
  );
  await ev(`document.querySelector('[data-clef-change-id="between"]').focus()`);
  await key('Enter');
  await ev(
    `document.querySelector('input[name="clef-insertion-policy"][value="melody"]').click()`,
  );
  await button('Edit clef change');
  await change('Draft clef staff line', '3');
  await button('Apply clef change');
  assert.deepEqual((await score()).accidentals, beforeCross.accidentals);
  assert.equal(
    await ev(`document.querySelector('.score__accidental-ink').getBBox().y`),
    beforeHeight,
  );
  await snapshot('clef-between-anchor-owner');
  const legacy = await readFile(
    new URL('../note-modifiers/baseline-events-v1.chant.json', import.meta.url),
    'utf8',
  );
  await hydrate(legacy);
  await select(JSON.parse(legacy).document.neumes[0].notes[0].id);
  await change('Vertical episema', 'on');
  assert.equal(JSON.parse(await raw()).version, 5);
  if (process.env.CHANT_LEGACY_URL) {
    const v4 = fixture();
    v4.version = 4;
    delete v4.document.accidentals;
    await hydrate(v4);
    await send('Page.navigate', { url: process.env.CHANT_LEGACY_URL });
    await ready();
    await select('ownerB');
    const oldSaved = await change('Vertical episema', 'on');
    assert.equal(oldSaved.version, 4);
    const oldBytes = await raw();
    await navigate();
    assert.equal(await raw(), oldBytes, 'v4 hydration does not write');
    await select('ownerB');
    const v5 = await change('Written accidental', 'flat');
    assert.equal(v5.version, 5);
    assert.equal(
      v5.document.neumes.find((n) => n.id === 'b').notes[0].verticalEpisema,
      true,
    );
    const v5Bytes = await raw();
    await send('Page.navigate', { url: process.env.CHANT_LEGACY_URL });
    await ready();
    assert.equal(await raw(), v5Bytes);
    assert.match(
      await ev(
        `document.querySelector('.document-header__save-status').textContent`,
      ),
      /Not saved/,
    );
    const fallback = await ev(
      `document.querySelector('[data-note-id]').getAttribute('data-note-id')`,
    );
    await select(fallback);
    await change('Vertical episema', 'on');
    assert.equal(await raw(), v5Bytes, 'older app must not overwrite v5');
    await navigate();
    assert.equal(await raw(), v5Bytes);
  }
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox/BiDi' : 'Chromium/CDP',
      userAgent: await ev('navigator.userAgent'),
      preview: url,
      legacyBuildVerified: !!process.env.CHANT_LEGACY_URL,
      output,
      checks:
        'authoring, repeated-B, glyph keyboard, placement/cancel/restore, anchor loss, history, refresh, narrow, native-font narrow continuation joins, cross-system, export/import, legacy upgrade',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
