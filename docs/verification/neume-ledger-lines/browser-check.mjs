import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Stage 11A derived neume ledger lines: standalone CDP/BiDi driver against
// the real production StrictMode editor (see README.md in this directory).
const output = await mkdtemp(join(tmpdir(), 'chant-neume-ledgers-'));
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
async function snapshot(name, target = '.score-workspace') {
  await ev(
    `document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'start'})`,
  );
  const rendered = await ev(`document.querySelector('svg.score').outerHTML`);
  await writeFile(join(output, name + '.svg'), rendered);
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
/** Every rendered ledger run, in SVG user units. */
const ledgers = () =>
  ev(
    `[...document.querySelectorAll('.score__ledger-run')].map(r=>({neume:r.closest('[data-neume-id]')?.dataset.neumeId??null,ghost:!!r.closest('.score__placement-ghost'),palette:!r.closest('svg.score'),count:+r.dataset.ledgerCount,x:+r.getAttribute('x'),y:+r.getAttribute('y'),width:+r.getAttribute('width'),height:+r.getAttribute('height'),behind:r.closest('.score__ledgers').nextElementSibling?.classList.contains('score__ink')??false,inert:getComputedStyle(r).pointerEvents==='none'&&r.closest('[aria-hidden="true"]')!==null&&!r.closest('[tabindex]')}))`,
  );
const committed = async (id) =>
  (await ledgers()).filter((l) => l.neume === id && !l.ghost);
const bottomLine = (system = 0) =>
  ev(
    `Math.max(...[...document.querySelectorAll('svg.score .score__staff-line')].slice(${system * 4},${system * 4 + 4}).map(l=>+l.getAttribute('y1')))`,
  );
/** Score-unit point to viewport point (after scrolling the score into view). */
async function screenPoint(x, y) {
  await ev(
    `document.querySelector('svg.score').scrollIntoView({block:'center'})`,
  );
  await pause();
  return ev(
    `(()=>{const svg=document.querySelector('svg.score');const p=new DOMPoint(${x},${y}).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y}})()`,
  );
}
const base = {
  format: 'gregorian-chant-editor',
  version: 10,
  document: {
    title: 'Stage 11A ledger lines',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: [],
    syllables: [],
    divisions: [],
    clefChanges: [],
    accidentals: [],
  },
};
const neume = (id, kind, pitches, marks = []) => ({
  id,
  kind,
  notes: pitches.map((staffPosition, i) => ({
    id: `${id}-${i}`,
    staffPosition,
    ...(marks[i] ?? {}),
  })),
});
const etJesum = await readFile(
  new URL('./et-jesum.chant.json', import.meta.url),
  'utf8',
);
const ribbonContinuation = await readFile(
  new URL('./extreme-ribbon-continuation.chant.json', import.meta.url),
  'utf8',
);
const checks = [];
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

    // 1. Repertoire: C4 Et(d) Je(a)sum(cd). One ledger at -2 on Je only.
    await hydrate(JSON.parse(etJesum));
    const bottom = await bottomLine();
    let runs = await ledgers();
    assert.equal(runs.length, 1, 'Et Jesum has exactly one ledger run');
    assert.equal(runs[0].neume, 'je');
    assert.equal(runs[0].count, 1);
    assert.equal(runs[0].y, bottom + 24 - 0.75, 'ledger at position -2');
    assert.equal(runs[0].width, 18);
    assert.ok(runs[0].behind, 'ledger painted before the notehead ink');
    assert.ok(runs[0].inert, 'ledger is decorative and not a target');
    assert.equal(
      await ev(`document.querySelectorAll('[data-note-id]').length`),
      4,
      'no new targets for derived ink',
    );
    await snapshot('et-jesum-' + width);
    checks.push('et-jesum');

    // 2. Export/import and clef translation (melody preserved) via the UI.
    await ev(
      `window.__download=null;URL.createObjectURL=blob=>{window.__download=blob;return 'blob:captured'};HTMLAnchorElement.prototype.click=function(){}`,
    );
    await clickText('Export');
    const exported = await ev('window.__download.text()');
    assert.ok(
      !/"ledger\w*"\s*:/i.test(exported),
      'derived ink is never persisted',
    );
    assert.deepEqual(
      JSON.parse(exported).document,
      JSON.parse(etJesum).document,
    );
    await importText(exported);
    assert.deepEqual(
      await committed('je'),
      runs,
      'import renders the same ledger',
    );
    await ev(`document.querySelector('[data-initial-clef]').focus()`);
    await key('Enter');
    await key('ArrowDown');
    await pause();
    const translated = await score();
    assert.equal(translated.clef.staffLine, 3);
    assert.deepEqual(
      translated.neumes.map((n) => n.notes.map((x) => x.staffPosition)),
      [[-2], [-5], [-3, -2]],
      'melody-preserving clef translation moves every note down a third',
    );
    // Derived ledgers follow the translated pitches; nothing is stored.
    assert.deepEqual(
      (await ledgers()).map((r) => [r.neume, r.count]),
      [
        ['et', 1],
        ['je', 2],
        ['sum', 1],
      ],
    );
    await clickLabel('Undo last edit');
    assert.deepEqual(await ledgers(), runs, 'Undo restores the single ledger');
    checks.push('export-import-clef');

    // 3. Keyboard transposition -1 -> -2/-3/-4 and back; same ID; Undo/Redo.
    await hydrate({
      ...base,
      document: { ...base.document, neumes: [neume('p', 'punctum', [-1])] },
    });
    await select('p-0');
    const expected = { [-1]: 0, [-2]: 1, [-3]: 1, [-4]: 2 };
    for (const pitch of [-2, -3, -4, -3, -2, -1]) {
      const previous = (await score()).neumes[0].notes[0].staffPosition;
      await key(pitch < previous ? 'ArrowDown' : 'ArrowUp');
      const doc = await score();
      assert.equal(doc.neumes[0].notes[0].id, 'p-0', 'same note identity');
      assert.equal(doc.neumes[0].notes[0].staffPosition, pitch);
      const run = await committed('p');
      assert.equal(
        run.reduce((sum, r) => sum + r.count, 0),
        expected[pitch],
      );
      if (expected[pitch])
        assert.equal(run[0].y, (await bottomLine()) + 24 - 0.75);
    }
    for (let i = 0; i < 3; i++) await clickLabel('Undo last edit');
    assert.equal((await score()).neumes[0].notes[0].staffPosition, -4);
    assert.equal((await committed('p'))[0].count, 2);
    await clickLabel('Redo last undone edit');
    assert.equal((await score()).neumes[0].notes[0].staffPosition, -3);
    assert.equal((await committed('p'))[0].count, 1);
    checks.push('transpose-undo-redo');

    // 4. High/low, compound, ribbon, liquescent, marks and accidentals.
    const specimen = {
      ...base,
      document: {
        ...base.document,
        neumes: [
          neume('high', 'punctum', [9], [{ verticalEpisema: true }]),
          neume('pes', 'podatus', [-4, -2]),
          neume('clivis', 'clivis', [-2, -5], [{ episema: true }, { mora: 1 }]),
          neume('porrectus', 'porrectus', [-2, -5, -2]),
          neume('tri', 'tristropha', [-3, -3, -3]),
          { ...neume('ceph', 'clivis', [9, 8]), liquescence: 'diminutive' },
          neume('climacus', 'climacus', [10, 9, 8, 7]),
          neume('flat', 'punctum', [-4]),
          neume('plain', 'punctum', [3]),
        ],
        accidentals: [
          {
            id: 'b',
            kind: 'flat',
            ownerNoteId: 'flat-0',
          },
        ],
      },
    };
    await hydrate(specimen);
    runs = await ledgers();
    const byNeume = (id) => runs.filter((r) => r.neume === id);
    assert.equal(byNeume('plain').length, 0, 'in-staff neume has none');
    assert.deepEqual(
      byNeume('pes').map((r) => r.count),
      [2],
      'stacked heads share one run',
    );
    assert.equal(byNeume('porrectus').length >= 2, true, 'no ribbon bridge');
    assert.deepEqual(
      byNeume('tri').map((r) => [r.count, r.width]),
      [[1, 54]],
      'touching repeated-note ledgers merge',
    );
    assert.ok(byNeume('ceph').length >= 1, 'liquescent ledgers');
    assert.ok(byNeume('climacus').length >= 1, 'diamond ledgers');
    assert.ok(runs.every((r) => r.behind && r.inert && !r.ghost));
    // Signs stay distinct from every ledger stroke (analytic, per level).
    const overlaps = await ev(
      `(()=>{const out=[];for(const g of document.querySelectorAll('svg.score [data-neume-id]')){const strokes=[...g.querySelectorAll('.score__ledger-run')].flatMap(r=>Array.from({length:+r.dataset.ledgerCount},(_,i)=>({x:+r.getAttribute('x'),w:+r.getAttribute('width'),y:+r.getAttribute('y')+i*24})));for(const s of g.querySelectorAll('.score__ink rect')){const b=s.getBBox();for(const t of strokes)if(b.x<t.x+t.w&&b.x+b.width>t.x&&b.y<t.y+1.5&&b.y+b.height>t.y)out.push(g.dataset.neumeId)}}return out})()`,
    );
    assert.deepEqual(overlaps, [], 'marks never overlap ledger strokes');
    const accidental = await ev(
      `(()=>{const a=document.querySelector('[data-accidental-id="b"]');const ink=document.querySelector('[data-neume-id="flat"] .score__ledger-run');return a&&ink?{a:a.getBBox().x+a.getBBox().width,l:+ink.getAttribute('x'),focusable:a.tabIndex>=0||a.hasAttribute('tabindex')}:null})()`,
    );
    assert.ok(accidental, 'accidental and ledger rendered');
    assert.ok(
      accidental.focusable,
      'accidental remains independently selectable',
    );
    await snapshot('specimen-' + width);
    // Whole-neume selection outlines include the ledger ink.
    await select('pes-0');
    await key('Escape');
    await ev(`document.querySelector('[data-note-id="pes-0"]').focus()`);
    await key('Enter', 'Enter', true);
    const outline = await ev(
      `(()=>{const o=document.querySelector('.score__neume-selection, .score__range-selection');const r=document.querySelector('[data-neume-id="pes"] .score__ledger-run');if(!o||!r)return null;const a=o.getBBox(),b=r.getBBox();return a.x<=b.x&&a.x+a.width>=b.x+b.width&&a.y<=b.y&&a.y+a.height>=b.y+b.height})()`,
    );
    assert.equal(outline, true, 'selection outline encloses ledger ink');
    checks.push('specimen-marks-selection');

    // 5. Clipboard: copy and paste a ledger neume as a whole.
    await key('Escape');
    await ev(`document.querySelector('[data-note-id="pes-0"]').focus()`);
    await key('Enter', 'Enter', true);
    await clickText('Copy');
    await clickText('Paste');
    const pasted = (await score()).neumes;
    assert.equal(pasted.length, specimen.document.neumes.length + 1);
    const copy = pasted.find((n) => n.id !== 'pes' && n.kind === 'podatus');
    assert.ok(copy, 'pasted podatus');
    assert.deepEqual(
      (await committed(copy.id)).map((r) => r.count),
      [2],
    );
    checks.push('clipboard');

    // 6. Outer canvas: deep ledgers are inside the SVG viewBox, not clipped.
    await hydrate({
      ...base,
      document: {
        ...base.document,
        neumes: [
          neume('deep', 'punctum', [-12]),
          neume('top', 'punctum', [15]),
        ],
      },
    });
    const canvas = await ev(
      `(()=>{const v=document.querySelector('svg.score').viewBox.baseVal;return {top:v.y,bottom:v.y+v.height}})()`,
    );
    runs = await ledgers();
    const deep = runs.find((r) => r.neume === 'deep');
    const top = runs.find((r) => r.neume === 'top');
    assert.equal(deep.count, 6);
    assert.equal(top.count, 4);
    assert.ok(canvas.bottom >= deep.y + deep.height);
    assert.ok(canvas.top <= top.y);
    if (!firefox) {
      const { data } = await send('Page.printToPDF', { printBackground: true });
      assert.ok(data.length > 1000, 'print output');
    }
    await snapshot('canvas-' + width);
    checks.push('canvas-print');

    // 7. Real mouse ghost beyond the staff, commit, and staff-edge clamp.
    await hydrate({
      ...base,
      document: { ...base.document, neumes: [neume('a', 'punctum', [3])] },
    });
    await pointer('button[data-tool="climacus"]');
    const ghostAt = async (x, pitch) => {
      const b = await bottomLine();
      const exact = await screenPoint(x, b - pitch * 12);
      // BiDi pointer input is integral; use whole pixels in both browsers
      // and map the actual pointer back to score units.
      const point = { x: Math.round(exact.x), y: Math.round(exact.y) };
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await pause();
      const scoreX = await ev(
        `new DOMPoint(${point.x},${point.y}).matrixTransform(document.querySelector('svg.score').getScreenCTM().inverse()).x`,
      );
      return { point, scoreX, runs: (await ledgers()).filter((r) => r.ghost) };
    };
    const ghost = await ghostAt(400, 0);
    assert.deepEqual(
      ghost.runs.map((r) => r.count),
      [1],
      'ghost Climacus [0,-1,-2] shows its -2 ledger',
    );
    const ghostHead = await ev(
      `(()=>{const p=document.querySelector('.score__placement-ghost .score__ink path').getBBox();return p.x+6})()`,
    );
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', {
        type,
        ...ghost.point,
        button: 'left',
        clickCount: 1,
      });
    await pause();
    const placed = (await score()).neumes.find((n) => n.kind === 'climacus');
    assert.deepEqual(
      placed.notes.map((n) => n.staffPosition),
      [0, -1, -2],
    );
    const placedRuns = await committed(placed.id);
    assert.deepEqual(
      placedRuns.map((r) => [r.count, r.y, r.width]),
      ghost.runs.map((r) => [r.count, r.y, r.width]),
      'ghost and commit share ledger construction',
    );
    assert.ok(
      Math.abs(ghostHead - ghost.scoreX) < 0.01,
      'ghost head follows pointer',
    );
    // Near the staff end the measured ghost (ledger included) is clamped.
    const edge = await ghostAt(652, 0);
    const staffRight = await ev(
      `+document.querySelector('svg.score .score__staff-line').getAttribute('x2')`,
    );
    assert.ok(edge.runs.length === 1);
    assert.ok(
      edge.runs[0].x + edge.runs[0].width <= staffRight - 3 + 0.01,
      'clamped ghost (with ledger) stays inside the staff',
    );
    checks.push('ghost-commit-clamp');

    // 8. Palette icons stay staffless; no horizontal overflow.
    assert.equal(
      (await ledgers()).filter((r) => r.palette).length,
      0,
      'no ledger artifacts on palette icons',
    );
    assert.equal(
      await ev(`document.documentElement.scrollWidth<=innerWidth`),
      true,
    );
    await key('Escape');
    checks.push('palette-overflow');

    // 9. Extreme but valid imported pitches (owner follow-up): every kind of
    // musical ink at ±MAX_SAFE_INTEGER, alternating so system breaks end in
    // distant custodes. The editor must stay usable and pitches semantic.
    const max = Number.MAX_SAFE_INTEGER;
    const extremeNeumes = [
      neume('near', 'punctum', [3]),
      // Authored bodies spanning from the staff to a distant pitch.
      neume('span-pes', 'podatus', [3, max]),
      neume('span-porrectus', 'porrectus', [max, 3, 4]),
    ];
    for (let i = 0; i < 24; i++) {
      // MAX_SAFE_INTEGER is a B under C3 (the flat's owner); the low side
      // stays a few steps inside so every effective degree remains safe.
      const at = i % 2 ? max : -max + 8;
      extremeNeumes.push(
        i % 4 === 0
          ? neume(
              `far${i}`,
              'punctum',
              [at],
              [{ mora: 1, episema: true, verticalEpisema: true }],
            )
          : i % 4 === 1
            ? neume(
                `far${i}`,
                'punctum',
                [at],
                [{ form: 'virga', episema: true }],
              )
            : i % 4 === 2
              ? {
                  ...neume(
                    `far${i}`,
                    'podatus',
                    [at, at + 1],
                    [{ episema: true }],
                  ),
                  liquescence: 'diminutive',
                }
              : neume(
                  `far${i}`,
                  'podatus',
                  [at - 2, at],
                  [{ form: 'quilisma' }, { verticalEpisema: true }],
                ),
      );
    }
    const extreme = {
      ...base,
      document: {
        ...base.document,
        neumes: extremeNeumes,
        accidentals: [{ id: 'far-flat', kind: 'flat', ownerNoteId: 'far1-0' }],
      },
    };
    const started = Date.now();
    const extremeBytes = await hydrate(extreme);
    const loadMs = Date.now() - started;
    // Stage 11B: each system's measured extent reserves its musical ink,
    // clamped to the canonical band 1,200 units beyond the canonical
    // 220-unit system; the canvas is exactly the stacked systems. Each
    // system's resolved band is that canonical band intersected with its own
    // box and clips musical ink and pointer regions. Nothing painted (ledger
    // runs, custos ledgers, outlines) exceeds its own system's band by more
    // than one ledger space, and no browser tiles or strokes a 10^17-unit
    // shape. (Stage 11A asserted a -1200 canvas origin and fixed 244-unit
    // advances instead.)
    const painted = () =>
      ev(`(()=>{
        const svg=document.querySelector('svg.score');
        const v=svg.viewBox.baseVal;
        const frame=(e)=>{const g=e.closest('[data-system-index]');return g?{top:+g.dataset.musicTop,bottom:+g.dataset.musicBottom}:null};
        const rects=[...svg.querySelectorAll('.score__ledger-run,.score__custos-ledgers,.score__neume-selection,.score__range-selection')]
          .filter(r=>!r.closest('.score__placement-ghost'))
          .map(r=>({cls:r.getAttribute('class'),y:+r.getAttribute('y'),h:+r.getAttribute('height'),count:+(r.dataset.ledgerCount??0),painted:+(r.dataset.paintedLedgerCount??r.dataset.ledgerCount??0),band:frame(r)}));
        const lines=[...svg.querySelectorAll('.score__staff-line')].map(l=>+l.getAttribute('y1'));
        const bottoms=[];for(let i=0;i<lines.length;i+=4)bottoms.push(Math.max(...lines.slice(i,i+4)));
        const systems=[...svg.querySelectorAll('g[data-system-index]')].map(g=>{
          const clip=g.querySelector(':scope > defs > clipPath > rect');
          const music=g.querySelector(':scope > .score__system-music');
          return {top:+g.dataset.systemTop,height:+g.dataset.systemHeight,musicTop:+g.dataset.musicTop,musicBottom:+g.dataset.musicBottom,
            clipTop:+clip.getAttribute('y'),clipHeight:+clip.getAttribute('height'),
            clipped:!!music&&music.getAttribute('clip-path')==='url(#'+clip.parentElement.id+')'};
        });
        return {view:{top:v.y,bottom:v.y+v.height,height:v.height},rects,bottoms,systems,scrollHeight:document.documentElement.scrollHeight};
      })()`);
    let state = await painted();
    const lastSystem = state.systems.at(-1);
    assert.equal(state.view.top, 0, 'canvas starts at the first system');
    assert.equal(
      state.view.bottom,
      lastSystem.top + lastSystem.height,
      'canvas ends at the last measured system',
    );
    state.systems.forEach((system, i) => {
      assert.ok(system.clipped, `system ${i} clips its musical ink`);
      assert.equal(system.clipTop, system.musicTop);
      assert.equal(system.clipHeight, system.musicBottom - system.musicTop);
      assert.ok(system.musicTop >= system.top, 'band within system box');
      assert.ok(
        system.musicBottom <= system.top + system.height,
        'band within system box',
      );
      assert.ok(
        system.musicBottom - system.musicTop <= 220 + 2 * 1200,
        'band no larger than the canonical maximum band',
      );
      assert.ok(system.height <= 2700, `system ${i} height bounded`);
      if (i)
        assert.equal(
          system.top,
          state.systems[i - 1].top + state.systems[i - 1].height + 24,
          'systems stack by measured height and the 24-unit gap',
        );
    });
    const ledgerRects = state.rects.filter((r) => /ledger/.test(r.cls));
    assert.ok(
      ledgerRects.some((r) => r.cls === 'score__custos-ledgers'),
      'distant custodes are present',
    );
    for (const r of state.rects) {
      assert.ok(r.band, `${r.cls} belongs to a system`);
      assert.ok(r.y >= r.band.top - 24 - 0.75, `${r.cls} top in band`);
      assert.ok(
        r.y + r.h <= r.band.bottom + 24 + 0.75,
        `${r.cls} bottom in band`,
      );
    }
    for (const r of ledgerRects) {
      // Full derived count is reported; only the painted element is limited.
      assert.ok(r.count > 1000, 'derived distant ledger count');
      assert.ok(r.painted < r.count && r.painted > 10);
      assert.equal(r.h, (r.painted - 1) * 24 + 1.5);
      // Painted strokes sit exactly on some system's staff grid.
      assert.ok(
        state.bottoms.some((b) => Math.abs((r.y + 0.75 - b) % 24) === 0),
        'ledger strokes stay on the staff grid',
      );
    }
    assert.ok(state.scrollHeight < 20000, 'page height stays usable');

    // Usable: real pointer selection, transposition, Undo, and the distant
    // pitches survive exactly.
    await pointer(selector('near-0'));
    assert.equal(
      await ev(
        `document.querySelector(${JSON.stringify(selector('near-0'))}).getAttribute('aria-pressed')`,
      ),
      'true',
      'real pointer selection beside distant ink',
    );
    await key('ArrowUp');
    assert.equal((await score()).neumes[0].notes[0].staffPosition, 4);
    await clickLabel('Undo last edit');
    const extremeDocument = JSON.parse(extremeBytes).document;
    assert.deepEqual(await score(), extremeDocument, 'Undo restores the score');
    // A distant note: keyboard selection, transposition toward the staff.
    await select('far0-0');
    await key('ArrowUp');
    let moved = (await score()).neumes.find((n) => n.id === 'far0');
    assert.equal(moved.notes[0].staffPosition, -max + 9);
    await clickLabel('Undo last edit');
    assert.deepEqual(await score(), extremeDocument);
    // Whole-neume selection of a distant neume: its outline (from complete
    // bounds reaching the pitch) is painted, but only inside the band.
    await key('Escape');
    await ev(`document.querySelector('[data-note-id="far0-0"]').focus()`);
    await key('Enter', 'Enter', true);
    state = await painted();
    const farOutline = state.rects.find((r) =>
      /neume-selection|range-selection/.test(r.cls),
    );
    assert.ok(farOutline, 'distant neume selection outline is painted');
    assert.ok(farOutline.y >= farOutline.band.top - 24 - 0.75);
    assert.ok(
      farOutline.y + farOutline.h <= farOutline.band.bottom + 24 + 0.75,
    );
    moved = (await score()).neumes.find((n) => n.id === 'far1');
    assert.equal(moved.notes[0].staffPosition, max, 'pitch stays semantic');
    console.error(
      'extreme',
      width,
      JSON.stringify({
        loadMs,
        view: state.view,
        systems: state.systems.length,
      }),
    );
    await key('Escape');
    await snapshot('extreme-' + width);
    checks.push('extreme-pitches');

    // 10. An extreme-width Porrectus carrying "Do-" with "-mi" on a later
    // system (native fixture, real measured lyrics): the outgoing hyphen's
    // derived position follows the ~10^17-unit ribbon, but cannot defeat the
    // horizontal canvas safeguard; the score stays usable.
    await hydrate(JSON.parse(ribbonContinuation));
    const ribbon = await ev(`(()=>{
      const svg=document.querySelector('svg.score');
      const v=svg.viewBox.baseVal;
      const out=[...svg.querySelectorAll('.score__hyphens [data-outgoing="true"]')].map(h=>+h.getAttribute('x'));
      return {left:v.x,right:v.x+v.width,out,svgWidth:svg.getBoundingClientRect().width,
        lyrics:[...svg.querySelectorAll('text')].map(t=>t.textContent).filter(t=>t==='Do'||t==='mi').length,
        scroll:document.documentElement.scrollWidth<=innerWidth};
    })()`);
    assert.ok(ribbon.out.length >= 1, 'outgoing hyphen rendered');
    assert.ok(
      ribbon.out.some((x) => x > 1e16),
      'hyphen keeps its derived position after the ribbon',
    );
    assert.ok(ribbon.left >= -1200 && ribbon.right <= 720 + 1200);
    assert.ok(ribbon.svgWidth < 5000, 'SVG element stays a usable size');
    assert.equal(ribbon.lyrics, 2, 'both syllables rendered');
    await pointer(selector('p31'));
    assert.equal(
      await ev(
        `document.querySelector(${JSON.stringify(selector('p31'))}).getAttribute('aria-pressed')`,
      ),
      'true',
      'pointer selection after the extreme ribbon',
    );
    await key('ArrowUp');
    assert.equal(
      (await score()).neumes[31].notes[0].staffPosition,
      4,
      'transposition after the extreme ribbon',
    );
    await clickLabel('Undo last edit');
    assert.deepEqual(
      (await score()).neumes,
      JSON.parse(ribbonContinuation).document.neumes,
    );
    console.error('ribbon', width, JSON.stringify(ribbon));
    await key('Escape');
    checks.push('extreme-ribbon-continuation');
  }
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox/BiDi' : 'Chromium/CDP',
      userAgent: await ev('navigator.userAgent'),
      output,
      checks: [...new Set(checks)].join(', ') + ' at 1440px and 320px',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
