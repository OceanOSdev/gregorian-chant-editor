import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-vertical-episemata-'));
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
const url =
  process.env.CHANT_PREVIEW_URL ??
  'http://127.0.0.1:4173/gregorian-chant-editor/';
const storageKey = 'gregorian-chant-editor:active-document:v1';
const raw = () => ev(`localStorage.getItem('${storageKey}')`);
const status = () =>
  ev(
    `document.querySelector('section[aria-label="Document"] .document-header__save-status').textContent`,
  );
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
async function clearNote() {
  const point = await ev(
    `(()=>{const svg=document.querySelector('svg.score');svg.scrollIntoView({block:'center'});const r=svg.getBoundingClientRect();return {x:r.x+8,y:Math.max(8,Math.min(innerHeight-8,r.y+8))}})()`,
  );
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
      `document.querySelectorAll('[data-note-id][aria-pressed="true"]').length`,
    ),
    0,
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
  return bytes;
}
const v1 = await readFile(
  new URL('../note-modifiers/baseline-events-v1.chant.json', import.meta.url),
  'utf8',
);
const v2 = await readFile(
  new URL(
    '../note-modifiers/conventional/editor-cases.chant.json',
    import.meta.url,
  ),
  'utf8',
);
const v3 = await readFile(
  new URL(
    '../../../src/editor/examples/pater-noster.chant.json',
    import.meta.url,
  ),
  'utf8',
);
const cases = [
  ['punctum', [4], null, 'Line'],
  ['punctum', [5], null, 'Space'],
  ['punctum', [4], null, 'Both'],
  ['punctum', [4], null, 'All'],
  ['punctum', [5], null, 'Mora'],
  ['punctum', [4], 'virga', 'Virga'],
  ['punctum', [4], 'inclinatum', 'Incl'],
  ['podatus', [4, 5], null, 'PodLo'],
  ['podatus', [4, 5], null, 'PodHi'],
  ['podatus', [4, 5], null, 'PodAll'],
  ['clivis', [5, 4], null, 'CliHi'],
  ['clivis', [5, 4], null, 'CliLo'],
  ['scandicus', [3, 4, 5], null, 'Scan'],
  ['scandicus', [3, 4, 5], null, 'ScanAll'],
  ['scandicus', [3, 4, 5], 'quilisma', 'Quilt'],
  ['scandicus', [3, 4, 5], 'quilisma', 'QuiltAll'],
  ['torculus', [4, 5, 4], null, 'Tor'],
  ['torculus', [4, 5, 4], null, 'TorAll'],
  ['climacus', [6, 5, 4], null, 'Clim'],
  ['porrectus', [6, 4, 6], null, 'Porr'],
  ['punctum', [4], null, 'Edge'],
  ['punctum', [5], null, 'Next'],
  ['punctum', [4], null, 'Last'],
  ['podatus', [0, 4], 'quilisma', 'Wide'],
  ['scandicus', [0, 2, 4], 'quilisma', 'Connected'],
];
function fixture(signed = true, dense = false) {
  const document = JSON.parse(v1).document;
  document.title = 'Vertical episemata — reference comparisons';
  document.syllables = [];
  document.divisions = [];
  document.clefChanges = [];
  document.neumes = cases.map(([kind, pitches, form, label], i) => ({
    id: 'n' + i,
    kind,
    notes: pitches.map((staffPosition, j) => ({
      id: `note-${i}-${j}`,
      staffPosition,
      ...(form && j === (kind === 'scandicus' ? 1 : 0) ? { form } : {}),
      ...(dense || label === 'Both' || label === 'All'
        ? { episema: true }
        : {}),
      ...((
        dense
          ? j >= Math.max(0, pitches.length - 2)
          : label === 'All' || label === 'Mora'
      )
        ? { mora: 1 }
        : {}),
      ...(signed &&
      (dense ||
        !['PodLo', 'PodHi', 'CliHi', 'CliLo', 'Scan', 'Quilt', 'Tor'].includes(
          label,
        ) ||
        j ===
          { PodLo: 0, PodHi: 1, CliHi: 0, CliLo: 1, Scan: 1, Quilt: 1, Tor: 1 }[
            label
          ])
        ? { verticalEpisema: true }
        : {}),
    })),
  }));
  document.syllables = cases.map((c, i) => ({
    id: 's' + i,
    text: c[3],
    startsAtNeumeId: 'n' + i,
    boundaryBefore: 'word',
  }));
  document.divisions = [
    { id: 'bar', kind: 'minima', beforeNeumeId: 'n7' },
    {
      id: 'edge-bar',
      kind: 'minima',
      beforeNeumeId: 'n' + cases.findIndex((c) => c[3] === 'Next'),
    },
    { id: 'end', kind: 'finalis', beforeNeumeId: null },
  ];
  document.clefChanges = [
    {
      id: 'changed-clef',
      clef: { type: 'c', staffLine: 4 },
      beforeNeumeId: 'n' + cases.findIndex((c) => c[3] === 'Last'),
      beforeDivisionId: null,
    },
  ];
  return { format: 'gregorian-chant-editor', version: 4, document };
}
async function paintedChecks() {
  const measurements = await ev(`(()=>{
 const result=[];
 for(const group of document.querySelectorAll('[data-neume-id]')) {
   const ink=group.querySelector('.score__ink');if(!ink)continue;
   const parts=[...ink.children];
   const ticks=parts.filter(p=>p.tagName==='rect'&&Number(p.getAttribute('width'))===1.5&&Number(p.getAttribute('height'))===7);
   const system=group.closest('[data-system-index]');
   const body=[...system.querySelectorAll('.score__ink > path, .score__ink > rect, .score__clef-ink, .score__custos, .score__division-ink > line')].filter(p=>!ticks.includes(p));
   const intersections=[];
   for(const [index,tick] of ticks.entries()) {
     const b=tick.getBBox();
     for(let x=b.x+.15;x<b.x+b.width;x+=.3)for(let y=b.y+.15;y<b.y+b.height;y+=.3){
       const point=new DOMPoint(x,y);
       for(const other of [...body,...ticks.slice(0,index)])if(other.tagName==='line'?other.isPointInStroke(point):other.isPointInFill(point))intersections.push({x,y,other:other.outerHTML});
     }
     for(const line of group.closest('[data-system-index]').querySelectorAll('.score__staff-line')) {
       const y=Number(line.getAttribute('y1'));
       if(b.y<y+.5&&b.y+b.height>y-.5)intersections.push({staff:y});
     }
   }
   const b=ink.getBBox(),v=document.querySelector('svg.score').viewBox.baseVal;
   const contained=b.x>=v.x-.02&&b.y>=v.y-.02&&b.x+b.width<=v.x+v.width+.02&&b.y+b.height<=v.y+v.height+.02;
   result.push({contained,id:group.dataset.neumeId,ticks:ticks.length,authored:group.querySelectorAll('.score__note[aria-label*="Vertical episema"]').length,intersections});
 }
 return result;
 })()`);
  assert.ok(measurements.length >= cases.length);
  for (const m of measurements) {
    assert.equal(m.intersections.length, 0, JSON.stringify(m));
    assert.equal(m.ticks, m.authored, JSON.stringify(m));
    assert.equal(m.contained, true, JSON.stringify(m));
    assert.ok(m.ticks > 0, JSON.stringify(m));
  }
  return measurements;
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
  for (const source of [v1, v2, v3]) {
    await hydrate(source);
    const original = JSON.parse(source).document,
      id = original.neumes[0].notes[0].id;
    await select(id);
    const saved = await change('Vertical episema', 'on');
    assert.equal(saved.version, 4);
    const expected = structuredClone(original);
    expected.neumes[0].notes[0].verticalEpisema = true;
    assert.deepEqual(saved.document, expected);
    await navigate();
    assert.deepEqual(await score(), expected);
    await ev(
      `window.confirm=()=>true;window.__download=null;URL.createObjectURL=blob=>{window.__download=blob;return 'blob:captured'};HTMLAnchorElement.prototype.click=function(){}`,
    );
    // Export button's visible label is stable; capture its real Blob.
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export').click()`,
    );
    const exported = await ev(`window.__download.text()`);
    assert.deepEqual(JSON.parse(exported), saved);
    await ev('window.confirm=()=>true');
    await importText(exported);
    await navigate();
    assert.deepEqual(await score(), expected);
  }
  await writeFile(
    join(output, 'cases-v4.chant.json'),
    JSON.stringify(fixture(), null, 2),
  );
  await hydrate(v3);
  await snapshot('pater-before');
  const ownerDoc = JSON.parse(v3).document;
  const ster = ownerDoc.neumes
    .flatMap((n) => n.notes)
    .find((n) => n.episema).id;
  await select(ster);
  await change('Vertical episema', 'on');
  const expectedOwner = structuredClone(ownerDoc);
  expectedOwner.neumes
    .flatMap((n) => n.notes)
    .find((n) => n.id === ster).verticalEpisema = true;
  assert.deepEqual(await score(), expectedOwner);
  await snapshot('pater-after');
  await navigate();
  assert.deepEqual(await score(), expectedOwner);
  await hydrate(fixture(false));
  for (const neume of fixture(false).document.neumes)
    for (const note of neume.notes) {
      await select(note.id);
      const before = await score();
      const saved = await change('Vertical episema', 'on');
      const expected = structuredClone(before);
      expected.neumes
        .flatMap((n) => n.notes)
        .find((n) => n.id === note.id).verticalEpisema = true;
      assert.deepEqual(saved.document, expected);
      await change('Vertical episema', 'off');
      assert.deepEqual(await score(), before);
    }
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await hydrate(fixture(false));
    await snapshot('unsigned-' + width);
    await select('note-0-0');
    const y = await ev(
      `document.querySelector('svg.score').getBoundingClientRect().top+scrollY`,
    );
    const before = await score();
    const signed = await change('Vertical episema', 'on');
    assert.equal(signed.document.neumes[0].notes[0].verticalEpisema, true);
    assert.ok(
      Math.abs(
        (await ev(
          `document.querySelector('svg.score').getBoundingClientRect().top+scrollY`,
        )) - y,
      ) < 0.05,
      'selection/toggle must not move the score',
    );
    const noOp = await raw();
    await change('Vertical episema', 'on');
    assert.equal(await raw(), noOp);
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Undo').click()`,
    );
    assert.deepEqual(await score(), before);
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Redo').click()`,
    );
    assert.deepEqual(await score(), signed.document);
    await change('Horizontal episema', 'on');
    await change('Mora scope', 'sole');
    assert.ok((await score()).neumes[0].notes[0].episema);
    await select('note-0-0');
    await key('ArrowUp');
    assert.equal((await score()).neumes[0].notes[0].verticalEpisema, true);
    await change('Vertical episema', 'off');
    assert.equal(
      'verticalEpisema' in (await score()).neumes[0].notes[0],
      false,
    );
    await ev(
      `document.querySelector('select[aria-label="Horizontal episema"]').focus()`,
    );
    await key('Tab');
    assert.equal(
      await ev(`document.activeElement.getAttribute('aria-label')`),
      'Vertical episema',
    );
    await hydrate(fixture(true));
    await snapshot('signed-' + width);
    await paintedChecks();
    await select('note-2-0');
    assert.match(
      await ev(
        `document.querySelector('[data-note-id="note-2-0"]').getAttribute('aria-label')`,
      ),
      /Vertical episema/,
    );
    await snapshot('controls-' + width, '.note-modifiers');
    await clearNote();
    assert.equal(
      await ev(
        `document.querySelector('select[aria-label="Vertical episema"]').disabled||document.querySelector('select[aria-label="Vertical episema"]').closest('fieldset').disabled`,
      ),
      true,
    );
    assert.ok(
      await ev('document.documentElement.scrollWidth<=innerWidth'),
      '320px controls must fit',
    );
    await hydrate(fixture(true, true));
    const metrics = await paintedChecks();
    await writeFile(
      join(output, 'dense-' + width + '.json'),
      JSON.stringify(metrics),
    );
    await snapshot('dense-' + width);
  }
  // Guarded caches, strict rejection, no replacement on malformed import.
  for (const version of [1, 2, 3]) {
    const invalid = JSON.parse(v1);
    invalid.version = version;
    invalid.document.neumes[0].notes[0].verticalEpisema = true;
    const bytes = await hydrate(invalid);
    assert.match(await status(), /Not saved/);
    assert.equal(await raw(), bytes);
  }
  await hydrate(v3);
  const preserved = await raw();
  for (const value of [false, 0, null, 'true', {}, []]) {
    const invalid = fixture();
    invalid.document.neumes[0].notes[0].verticalEpisema = value;
    await importText(JSON.stringify(invalid));
    assert.equal(await raw(), preserved);
    assert.ok(await ev(`!!document.querySelector('[role="alert"]')`));
  }
  const draft = JSON.parse(v1);
  draft.version = 2;
  draft.document.neumes[0].notes[0].mora = 2;
  const draftBytes = await hydrate(draft);
  assert.match(await status(), /Not saved/);
  assert.equal(await raw(), draftBytes);
  await hydrate(fixture());
  await select('note-0-0');
  const external = JSON.stringify({
    ...fixture(),
    document: { ...fixture().document, title: 'Other tab' },
  });
  await ev(
    `localStorage.setItem('${storageKey}',${JSON.stringify(external)});dispatchEvent(new StorageEvent('storage',{key:'${storageKey}',newValue:${JSON.stringify(external)}}))`,
  );
  await change('Vertical episema', 'off');
  assert.equal(await raw(), external);
  console.log(
    JSON.stringify({
      browser: firefox ? 'firefox' : 'chromium',
      output,
      result: 'passed',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
