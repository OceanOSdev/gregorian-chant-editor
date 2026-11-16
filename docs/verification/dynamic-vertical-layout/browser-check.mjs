import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Stage 11B dynamic vertical system layout: standalone CDP/BiDi driver against
// the real production StrictMode editor (see README.md in this directory).
const output = await mkdtemp(join(tmpdir(), 'chant-dynamic-systems-'));
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
const score = async () => JSON.parse(await raw()).document;
async function pointer(selector) {
  // Firefox's scrollIntoView does not always centre an SVG element inside the
  // wide (horizontally scrolling) score viewport; finish with a page scroll.
  await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)scrollBy(0,r.top+r.height/2-innerHeight/2)})()`,
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
const clickLabel = async (label) => {
  await ev(
    `document.querySelector('button[aria-label=${JSON.stringify(label)}]').click()`,
  );
  await pause();
};
const clickText = async (text) => {
  await ev(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)})).click()`,
  );
  await pause();
};

const salveSource = await readFile(
  new URL(
    '../../../src/editor/examples/Salve-Regina-Dominican.chant.json',
    import.meta.url,
  ),
  'utf8',
);
const salve = JSON.parse(salveSource).document;
const je = '925dd4f8-95c3-4fb2-85d6-b09838c2b6ad';
const nobisFlat = 'babb4067-5114-4591-9068-d295b3a41151';

async function loadSalve() {
  await ev(
    `window.confirm=()=>true;(()=>{const e=document.querySelector('[aria-label="Load example"]');const o=[...e.options].find(o=>/Salve Regina Dominican/.test(o.textContent));e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  for (let i = 0; i < 40; i++) {
    await pause();
    if (
      (await ev(`document.querySelector('svg.score title')?.textContent`)) ===
      salve.title
    )
      break;
  }
  // Measured layout follows font readiness; wait for it to settle.
  await ev(`document.fonts.ready.then(()=>true)`);
  await pause();
  await pause();
}

/**
 * Resolved system frames and the browser's actual painted geometry: musical
 * ink (neume ink, ledgers, accidentals, custodes, clefs, divisions, staff)
 * and real text boxes from the lyric font, all in SVG user units.
 */
const frames = () =>
  ev(`(()=>{
    const svg=document.querySelector('svg.score');
    const v=svg.viewBox.baseVal;
    const box=(e)=>{const b=e.getBBox();return {top:b.y,bottom:b.y+b.height,left:b.x,right:b.x+b.width}};
    const inkSel='.score__ink,.score__ledger-run,.score__accidental-ink,.score__custos,.score__custos-ledgers,.score__clef-ink,.score__division-ink,.score__staff-line';
    return {view:{x:v.x,y:v.y,width:v.width,height:v.height},systems:[...svg.querySelectorAll('g[data-system-index]')].map(g=>{
      const music=g.querySelector(':scope > .score__system-music');
      const ink=[...music.querySelectorAll(inkSel)].filter(e=>!e.closest('.score__placement-ghost')).map(box).filter(b=>b.bottom>b.top||b.right>b.left);
      const lines=[...g.querySelectorAll('.score__staff-line')].map(l=>+l.getAttribute('y1'));
      return {
        index:+g.dataset.systemIndex,top:+g.dataset.systemTop,height:+g.dataset.systemHeight,
        baseline:+g.dataset.lyricBaseline,bottomStaff:Math.max(...lines),
        clip:music.getAttribute('clip-path'),
        inkTop:Math.min(...ink.map(b=>b.top)),inkBottom:Math.max(...ink.map(b=>b.bottom)),
        lyrics:[...g.querySelectorAll('text.score__lyric')].map(t=>({id:t.dataset.syllableId,text:t.textContent,y:+t.getAttribute('y'),...box(t)})),
        hyphens:[...g.querySelectorAll('.score__hyphens text')].map(t=>({y:+t.getAttribute('y'),...box(t)})),
        neumes:[...g.querySelectorAll('[data-neume-id]')].map(n=>n.dataset.neumeId),
      };
    })};
  })()`);

/** Score-unit point to an on-screen viewport point (scrolling it to centre). */
async function viewportPoint(x, y) {
  await ev(
    `(()=>{const svg=document.querySelector('svg.score');const p=new DOMPoint(${x},${y}).matrixTransform(svg.getScreenCTM());scrollBy(p.x-innerWidth/2,p.y-innerHeight/2)})()`,
  );
  await pause();
  const exact = await ev(
    `(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('svg.score').getScreenCTM());return {x:p.x,y:p.y}})()`,
  );
  return { x: Math.round(exact.x), y: Math.round(exact.y) };
}

/** Stage 11B invariants over the real painted score. */
function assertLayout(state, label) {
  const { view, systems } = state;
  assert.equal(view.y, 0, `${label}: canvas starts at the first system`);
  const last = systems.at(-1);
  assert.equal(view.y + view.height, last.top + last.height, `${label}: end`);
  systems.forEach((s, i) => {
    assert.ok(s.clip?.startsWith('url(#'), `${label} ${i}: music clipped`);
    if (i)
      assert.equal(
        s.top,
        systems[i - 1].top + systems[i - 1].height + 24,
        `${label} ${i}: stacked by measured height`,
      );
    assert.ok(s.height >= 220, `${label} ${i}: minimum height`);
    assert.ok(s.inkTop >= s.top, `${label} ${i}: ink below system top`);
    assert.ok(
      s.inkBottom <= s.top + s.height,
      `${label} ${i}: ink above system bottom`,
    );
    for (const t of [...s.lyrics, ...s.hyphens]) {
      assert.equal(t.y, s.baseline, `${label} ${i}: shared baseline`);
      // Real browser text boxes (accents, descenders) sit inside the row
      // and below all of the system's painted musical ink.
      assert.ok(
        t.top >= s.inkBottom + 3 - 0.01,
        `${label} ${i}: ${t.text ?? '-'} top ${t.top} clears ink ${s.inkBottom}`,
      );
      assert.ok(t.top >= s.baseline - 20 - 0.01, `${label}: ascent in band`);
      assert.ok(t.bottom <= s.baseline + 5 + 0.01, `${label}: descent in band`);
      assert.ok(t.bottom <= s.top + s.height, `${label}: text inside system`);
      assert.ok(t.left >= view.x && t.right <= view.x + view.width);
    }
  });
}

const checks = [];
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  // Conservative 20/5 lyric band versus the actual lyric font, including
  // accented Latin capitals, descenders and the hyphen.
  await navigate();
  const font = await ev(`(()=>{
    const c=document.createElement('canvas').getContext('2d');
    c.font="20px Georgia, 'Times New Roman', serif";
    const m=(s)=>{const r=c.measureText(s);return {ascent:r.actualBoundingBoxAscent,descent:r.actualBoundingBoxDescent}};
    return {accents:m('ÁÉÍÓÚÝǼǢŒÆÄËÏÖÜÅ'),descenders:m('gjpqyçţ;,Qſ'),hyphen:m('-'),mixed:m('Ǽjé')};
  })()`);
  for (const [name, metric] of Object.entries(font)) {
    assert.ok(metric.ascent <= 20, `${name} ascent ${metric.ascent} <= 20`);
    assert.ok(metric.descent <= 5, `${name} descent ${metric.descent} <= 5`);
  }
  checks.push('lyric-font-band');

  const baselineByWidth = {};
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate();
    await loadSalve();
    let state = await frames();
    assertLayout(state, `salve ${width}`);

    // 1. Et Jesum: Je's low A (ledger at -2) clears the shared baseline; only
    // its system grows, and every later system moves by that amount.
    const jeIndex = state.systems.findIndex((s) => s.neumes.includes(je));
    const jeSystem = state.systems[jeIndex];
    assert.ok(jeSystem.baseline - jeSystem.top > 180, 'Je baseline lowered');
    assert.equal(jeSystem.bottomStaff - jeSystem.top, 124, 'staff unchanged');
    const grow = jeSystem.height - 220;
    assert.ok(grow > 0);
    state.systems.forEach((s, i) => {
      if (i !== jeIndex) assert.equal(s.height, 220, `system ${i} ordinary`);
      assert.equal(s.top, i * 244 + (i > jeIndex ? grow : 0));
    });
    const jeInk = await ev(`(()=>{
      const g=document.querySelector('[data-neume-id="${je}"]');
      const b=[...g.querySelectorAll('.score__ink,.score__ledger-run')].map(e=>e.getBBox());
      const runs=[...g.querySelectorAll('.score__ledger-run')].map(r=>+r.dataset.ledgerCount);
      return {bottom:Math.max(...b.map(r=>r.y+r.height)),runs};
    })()`);
    assert.deepEqual(jeInk.runs, [1], 'one ledger under Je');
    const jeText = jeSystem.lyrics.find((l) => l.text === 'Je');
    assert.ok(jeText.top >= jeInk.bottom + 3, 'Je text clears the low A');
    baselineByWidth[width] = jeSystem.baseline;
    await viewportPoint(360, jeSystem.top + jeSystem.height / 2);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(
      join(output, `et-jesum-${width}.png`),
      Buffer.from(shot.data, 'base64'),
    );
    checks.push('et-jesum');

    // 2. The whole score: every lyric and neume is rendered, the anchored
    // Nobis flat and concluding melismas are present and clear the row.
    assert.equal(
      state.systems.flatMap((s) => s.lyrics).length,
      salve.syllables.length,
    );
    assert.deepEqual(
      state.systems.flatMap((s) => s.neumes),
      salve.neumes.map((n) => n.id),
    );
    assert.equal(state.systems.at(-1).lyrics.at(-1).text, 'ia.');
    assert.equal(
      state.systems.flatMap((s) => s.lyrics).filter((l) => l.text === 'O')
        .length,
      3,
    );
    const nobis = await ev(`(()=>{
      const a=document.querySelector('[data-accidental-id="${nobisFlat}"] .score__accidental-ink');
      const b=a.getBBox();return {bottom:b.y+b.height,system:+a.closest('[data-system-index]').dataset.systemIndex};
    })()`);
    const nobisSystem = state.systems[nobis.system];
    assert.ok(
      nobis.bottom + 3 <= Math.min(...nobisSystem.lyrics.map((l) => l.top)),
    );
    checks.push('whole-score');

    // 3. Later-system pointer selection, transposition that expands that
    // system and moves the following ones, keyboard Undo, focus by ID.
    const later = state.systems[jeIndex + 1];
    const laterNeume = salve.neumes.find(
      (n) => later.neumes.slice(1).includes(n.id) && n.kind === 'punctum',
    );
    const laterNote = laterNeume.notes[0].id;
    await pointer(selector(laterNote));
    assert.equal(
      await ev(
        `document.querySelector(${JSON.stringify(selector(laterNote))}).getAttribute('aria-pressed')`,
      ),
      'true',
      'pointer selection on the system after the expanded one',
    );
    const before = await raw();
    await select(laterNote);
    for (let i = 0; i < 9; i++) await key('ArrowDown');
    assert.equal(
      (await score()).neumes.find((n) => n.id === laterNeume.id).notes[0]
        .staffPosition,
      laterNeume.notes[0].staffPosition - 9,
      'keyboard transposition on the later system',
    );
    const lowered = await frames();
    assertLayout(lowered, `lowered ${width}`);
    assert.ok(
      lowered.systems[jeIndex + 1].height > 220,
      'committed low note expands its system',
    );
    assert.ok(
      lowered.systems[jeIndex + 2].top > state.systems[jeIndex + 2].top,
      'later systems move',
    );
    // Earlier systems are untouched; the added ledger may legitimately widen
    // the edited neume, so later membership is not asserted here (the pure
    // layout tests prove vertical position never feeds back into x).
    assert.deepEqual(
      lowered.systems.slice(0, jeIndex + 1),
      state.systems.slice(0, jeIndex + 1),
      'earlier systems unchanged',
    );
    assert.equal(
      await ev(
        `document.activeElement?.closest('[data-note-id]')?.dataset.noteId`,
      ),
      laterNote,
      'focus keeps the note ID through reflow',
    );
    // Resize while selected: selection and focus survive by ID.
    await send('Emulation.setDeviceMetricsOverride', {
      width: width === 1440 ? 320 : 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause();
    await pause();
    assert.equal(
      await ev(
        `document.querySelector(${JSON.stringify(selector(laterNote))}).getAttribute('aria-pressed')`,
      ),
      'true',
    );
    assertLayout(await frames(), `resized ${width}`);
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause();
    for (let i = 0; i < 9; i++) await clickLabel('Undo last edit');
    assert.equal(await raw(), before, 'Undo restores the stored score');
    assert.deepEqual(await frames(), state, 'Undo restores every frame');
    await key('Escape');
    checks.push('later-system-edit-undo-resize');

    // 4. Graphical placement on the system after the expanded one: the ghost
    // and the committed note use that system's resolved staff origin.
    await pointer('button[data-tool="punctum"]');
    const target = state.systems[jeIndex + 1];
    const anchor = await ev(
      `(()=>{const b=document.querySelector('[data-neume-id="${target.neumes[2]}"]').getBBox();return b.x+b.width+1})()`,
    );
    const point = await viewportPoint(anchor, target.bottomStaff - 4 * 12);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await pause();
    const ghost = await ev(
      `(()=>{const p=document.querySelector('.score__placement-ghost .score__ink path, .score__placement-ghost .score__ink rect');if(!p)return null;const b=p.getBBox();return b.y+b.height/2})()`,
    );
    assert.ok(ghost !== null, 'ghost rendered on the later system');
    assert.ok(
      Math.abs(ghost - (target.bottomStaff - 48)) <= 6,
      `ghost on pitch 4 of the later system (${ghost})`,
    );
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', {
        type,
        ...point,
        button: 'left',
        clickCount: 1,
      });
    await pause();
    const placedDoc = await score();
    assert.equal(placedDoc.neumes.length, salve.neumes.length + 1);
    const inserted = placedDoc.neumes.find(
      (n) => !salve.neumes.some((m) => m.id === n.id),
    );
    assert.deepEqual(
      inserted.notes.map((n) => n.staffPosition),
      [4],
    );
    const placedState = await frames();
    assertLayout(placedState, `placed ${width}`);
    assert.ok(placedState.systems.some((s) => s.neumes.includes(inserted.id)));
    await pointer('button[data-tool="select"]');
    await clickLabel('Undo last edit');
    assert.equal(await raw(), before, 'Undo removes the placed note');
    checks.push('later-system-placement');

    // 5. Export/import preserves the bundled score and its frames.
    await ev(
      `window.__download=null;URL.createObjectURL=blob=>{window.__download=blob;return 'blob:captured'};HTMLAnchorElement.prototype.click=function(){}`,
    );
    await clickText('Export');
    const exported = await ev('window.__download.text()');
    assert.deepEqual(JSON.parse(exported).document, salve);
    await importText(exported);
    await pause();
    assert.deepEqual(await frames(), state, 'import restores identical frames');
    checks.push('export-import');

    // 6. Print media (Chromium emulation) leaves the derived frames intact;
    // both browsers produce a PDF of the expanded score.
    if (!firefox) {
      await send('Emulation.setEmulatedMedia', { media: 'print' });
      assert.deepEqual(await frames(), state, 'print media frames');
      await send('Emulation.setEmulatedMedia', { media: '' });
    }
    const pdf = await send('Page.printToPDF', { printBackground: true });
    await writeFile(
      join(output, `salve-${width}.pdf`),
      Buffer.from(pdf.data, 'base64'),
    );
    checks.push('print');
  }
  // 7. 150% CSS zoom, a clef change inside a vertically expanded system:
  // production focus reveal, real pointer selection at the rendered location,
  // keyboard draft/transposition and focus restoration by ID. Native
  // scrollIntoView is only recorded (driver diagnostic, not app behaviour).
  const zoomFixture = (name, farPitch) => ({
    format: 'gregorian-chant-editor',
    version: 10,
    document: {
      title: `Zoom ${name}`,
      lyricLanguage: 'la',
      clef: { type: 'c', staffLine: 3 },
      neumes: [
        ...Array.from({ length: 60 }, (_, i) => ({
          id: `f${i}`,
          kind: 'punctum',
          notes: [{ id: `f${i}-0`, staffPosition: 3 }],
        })),
        {
          id: 'far',
          kind: 'punctum',
          notes: [{ id: 'far-0', staffPosition: farPitch }],
        },
        {
          id: 'z1',
          kind: 'punctum',
          notes: [{ id: 'z1-0', staffPosition: 2 }],
        },
        {
          id: 'z2',
          kind: 'punctum',
          notes: [{ id: 'z2-0', staffPosition: 4 }],
        },
      ],
      syllables: [],
      divisions: [],
      clefChanges: [
        {
          id: 'zoom-clef',
          clef: { type: 'c', staffLine: 4 },
          beforeNeumeId: 'z1',
          beforeDivisionId: null,
        },
      ],
      accidentals: [],
    },
  });
  const zoomEvidence = [];
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const [name, farPitch] of [
      ['ordinary', 3],
      ['high', 16],
      ['safe-integer', Number.MAX_SAFE_INTEGER],
    ]) {
      const fixture = zoomFixture(name, farPitch);
      await navigate();
      await importText(JSON.stringify(fixture));
      await ev(`(()=>{document.querySelector('main').style.zoom='1.5';})()`);
      await pause();
      await pause();
      const clefSel = '[data-clef-change-id="zoom-clef"]';
      const frame = await ev(
        `(()=>{const g=document.querySelector(${JSON.stringify(clefSel)}).closest('[data-system-index]');return {index:+g.dataset.systemIndex,height:+g.dataset.systemHeight}})()`,
      );
      assert.ok(frame.index > 0, `${name}: clef on a later system`);
      assert.equal(
        frame.height > 220,
        name !== 'ordinary',
        `${name}: expansion as intended`,
      );
      const visible = `(()=>{const e=document.querySelector(${JSON.stringify(clefSel)});const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);return {top:r.top,bottom:r.bottom,inView:r.top>=0&&r.bottom<=innerHeight,hitsClef:!!hit&&e.contains(hit),x,y}})()`;
      // Diagnostic only: the browser's native scrollIntoView on the clef <g>
      // (Firefox at 1440 px does not reveal it, identically on 3d5a93f).
      await ev(`scrollTo(0,0)`);
      await ev(
        `document.querySelector(${JSON.stringify(clefSel)}).scrollIntoView({block:'center'})`,
      );
      await pause();
      const native = await ev(visible);
      // Production: real Tab from the preceding note; the app's focusin
      // reveal (client rects + scrollBy) brings the clef into view.
      await ev(
        `document.querySelector('[data-note-id="far-0"]').focus({preventScroll:true})`,
      );
      await ev(`scrollTo(0,0)`);
      await pause();
      assert.equal(
        (await ev(visible)).inView,
        false,
        `${name}: starts off-screen`,
      );
      await key('Tab');
      await pause();
      await pause();
      const revealed = await ev(visible);
      assert.equal(
        await ev(
          `document.activeElement===document.querySelector(${JSON.stringify(clefSel)})`,
        ),
        true,
        `${name} ${width}: Tab focuses the clef`,
      );
      // The app reveal runs from focusin. Headless Firefox never has document
      // focus, dispatches no focusin and so cannot exercise it (identically
      // on 3d5a93f); there the result is recorded, not asserted.
      const documentFocused = await ev('document.hasFocus()');
      if (documentFocused) {
        assert.ok(revealed.inView, `${name} ${width}: app reveal shows clef`);
        assert.ok(revealed.hitsClef, `${name} ${width}: clef is topmost`);
      }
      // The client rect is the rendered location: bring it into view by a
      // page scroll from that rect and confirm it is the topmost target.
      await ev(
        `(()=>{const r=document.querySelector(${JSON.stringify(clefSel)}).getBoundingClientRect();scrollBy(0,r.top+r.height/2-innerHeight/2)})()`,
      );
      await pause();
      const shown = await ev(visible);
      assert.ok(shown.inView && shown.hitsClef, `${name} ${width}: rect hit`);
      // Real pointer press at the clef's actual rendered location.
      await ev(`document.activeElement.blur()`);
      const point = { x: Math.round(shown.x), y: Math.round(shown.y) };
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
        await send('Input.dispatchMouseEvent', {
          type,
          ...point,
          button: 'left',
          clickCount: 1,
        });
      await pause();
      assert.equal(
        await ev(
          `document.querySelector(${JSON.stringify(clefSel)}).getAttribute('aria-pressed')`,
        ),
        'true',
        `${name} ${width}: pointer selects the clef`,
      );
      // Keyboard: an Arrow draft keeps score focus on the same clef; Escape.
      await ev(
        `document.querySelector(${JSON.stringify(clefSel)}).focus({preventScroll:true})`,
      );
      await key('ArrowUp');
      const draft = await ev(
        `(()=>{const e=document.querySelector(${JSON.stringify(clefSel)});return {focused:document.activeElement===e,label:e.getAttribute('aria-label')}})()`,
      );
      assert.ok(draft.focused, `${name} ${width}: draft keeps clef focus`);
      assert.match(draft.label, /draft/);
      await key('Escape');
      await key('Escape');
      // Transposition on that system reflows it; focus follows the note ID.
      const before = await raw();
      await select('z2-0');
      await key('ArrowUp');
      const doc = await score();
      assert.equal(
        doc.neumes.find((n) => n.id === 'z2').notes[0].staffPosition,
        5,
      );
      assert.equal(
        await ev(
          `document.activeElement?.closest('[data-note-id]')?.dataset.noteId`,
        ),
        'z2-0',
        `${name} ${width}: focus restored by ID`,
      );
      const after = await ev(visible);
      await clickLabel('Undo last edit');
      assert.equal(
        await raw(),
        before,
        `${name} ${width}: Undo restores bytes`,
      );
      await ev(`(()=>{document.querySelector('main').style.zoom='';})()`);
      zoomEvidence.push({
        width,
        name,
        systemHeight: frame.height,
        nativeScrollIntoViewInView: native.inView,
        documentFocused,
        tabRevealInView: revealed.inView && revealed.hitsClef,
        clefTopAfterEdit: after.top,
      });
    }
  }
  console.error('zoom', JSON.stringify(zoomEvidence));
  checks.push('zoom-150-reveal-pointer-keyboard');

  // Layout is width-independent (score units); only scaling changes.
  assert.equal(baselineByWidth[1440], baselineByWidth[320]);
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox/BiDi' : 'Chromium/CDP',
      userAgent: await ev('navigator.userAgent'),
      output,
      font,
      jeBaseline: baselineByWidth,
      zoom: zoomEvidence,
      checks: [...new Set(checks)].join(', ') + ' at 1440px and 320px',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
