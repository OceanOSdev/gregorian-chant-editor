import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-note-modifiers-'));
const firefox = Boolean(process.env.CHANT_FIREFOX_URL);
const pages = firefox
  ? []
  : await (await fetch('http://127.0.0.1:9230/json')).json();
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
        ? reject(Error(JSON.stringify(m.error)))
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
const url = 'http://127.0.0.1:4173/gregorian-chant-editor/';
const storageKey = 'gregorian-chant-editor:active-document:v1';
const raw = () => ev(`localStorage.getItem('${storageKey}')`);
const status = () =>
  ev(
    `document.querySelector('section[aria-label="Document"] .document-header__save-status').textContent`,
  );
const button = async (text) => {
  const point = await ev(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}); if(!b)throw Error('Missing '+${JSON.stringify(text)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
};
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
async function pointer(selector) {
  const point = await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing target');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
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
async function key(key, code = key) {
  if (firefox) {
    const value =
      {
        Enter: '\uE007',
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
    `(()=>{const svg=document.querySelector('svg.score');svg.scrollIntoView({block:'center'});const r=svg.getBoundingClientRect();return {x:r.x+8,y:r.y+8}})()`,
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
async function checkSelectionPosition(width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await clearNote();
  const before = await raw();
  const geometry = () =>
    ev(`(()=>{
    const svg=document.querySelector('svg.score');
    const r=svg.getBoundingClientRect();
    const target=document.querySelector('.score__note-hit-target').getBoundingClientRect();
    return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,noteY:target.y+scrollY};
  })()`);
  const initial = await geometry();
  const check = async (action) => {
    const actual = await geometry();
    for (const property of Object.keys(initial))
      assert.ok(
        Math.abs(actual[property] - initial[property]) < 0.1,
        width +
          'px ' +
          action +
          ' changed ' +
          property +
          ': ' +
          initial[property] +
          ' -> ' +
          actual[property],
      );
  };
  assert.equal(
    await ev(
      `document.querySelector('[aria-label="Mora"]').matches(':disabled')`,
    ),
    true,
  );
  await pointer('[data-note-id="note-0-0"] .score__note-hit-target');
  assert.equal(
    await ev(
      `document.querySelector('[data-note-id="note-0-0"]').getAttribute('aria-pressed')`,
    ),
    'true',
  );
  await check('pointer selection');
  assert.equal(
    await ev(
      `document.querySelector('[aria-label="Mora"]').matches(':disabled')`,
    ),
    false,
  );
  for (const [i, [, pitches]] of kinds.entries())
    for (let j = 0; j < pitches.length; j++) {
      await select('note-' + i + '-' + j);
      await check('switch to note-' + i + '-' + j);
    }
  await clearNote();
  await check('pointer deselection');
  await select('note-1-0');
  await key('Escape');
  assert.equal(
    await ev(
      `document.querySelectorAll('[data-note-id][aria-pressed="true"]').length`,
    ),
    0,
  );
  await check('Escape deselection');
  assert.equal(await raw(), before, 'selection must not save or enter history');
  assert.equal(
    await ev(
      `document.querySelector('[aria-label="Undo last edit"]').disabled`,
    ),
    true,
  );
  assert.equal(
    await ev(`document.documentElement.scrollWidth<=innerWidth`),
    true,
  );
  await snapshot('stable-modifiers-unselected-' + width);
  await select('note-3-2');
  await snapshot('stable-modifiers-selected-' + width);
  await clearNote();
}
async function change(label, value) {
  return ev(
    `(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.focus();e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return JSON.parse(localStorage.getItem('${storageKey}'));})()`,
  );
}
async function snapshot(name) {
  await ev(
    `document.querySelector('.score-workspace').scrollIntoView({block:'start'})`,
  );
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    join(output, `${name}-${firefox ? 'firefox' : 'chromium'}.png`),
    Buffer.from(data, 'base64'),
  );
}
const base = JSON.parse(
  await readFile(new URL('baseline-v1.chant.json', import.meta.url), 'utf8'),
);
const events = JSON.parse(
  await readFile(
    new URL('baseline-events-v1.chant.json', import.meta.url),
    'utf8',
  ),
);
const kinds = [
  ['punctum', [2]],
  ['podatus', [1, 3]],
  ['clivis', [4, 2]],
  ['scandicus', [1, 2, 3]],
  ['torculus', [1, 3, 2]],
  ['climacus', [4, 3, 2]],
  ['porrectus', [4, 1, 3]],
];
const specimen = {
  format: base.format,
  version: 2,
  document: {
    ...base.document,
    title: 'Rhythmic signs — all seven neumes',
    syllables: [],
    divisions: [],
    clefChanges: [],
    neumes: kinds.map(([kind, pitches], i) => ({
      id: 'n' + i,
      kind,
      notes: pitches.map((staffPosition, j) => ({
        id: `note-${i}-${j}`,
        staffPosition,
      })),
    })),
  },
};
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
  // Real baseline v1 files, both file import and preexisting browser cache.
  for (const baseline of [base, events]) {
    const text = JSON.stringify(baseline);
    await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(text)})`);
    await navigate();
    assert.equal(
      await raw(),
      text,
      'hydration must leave original v1 bytes untouched',
    );
    await pointer('[data-note-id="note-punctum-1"] .score__note-hit-target');
    assert.equal(
      await ev(`document.querySelector('[aria-label="Mora"]').value`),
      '0',
    );
    const saved = await change('Mora', '1');
    const expected = structuredClone(baseline.document);
    expected.neumes[0].notes[0].mora = 1;
    assert.deepEqual(saved, {
      format: base.format,
      version: 2,
      document: expected,
    });
    await navigate();
    assert.match(
      await ev(
        `document.querySelector('[data-note-id="note-punctum-1"]').getAttribute('aria-label')`,
      ),
      /Single punctum mora/,
    );
    await ev('window.confirm=()=>true');
    await importText(text);
    assert.deepEqual(
      JSON.parse(await raw()),
      { ...baseline, version: 2 },
      'v1 file import preserves every semantic value',
    );
  }
  await ev('window.confirm=()=>true');
  await importText(JSON.stringify(specimen));
  for (const width of [1440, 320]) await checkSelectionPosition(width);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const [i, [, pitches]] of kinds.entries())
    for (let j = 0; j < pitches.length; j++) {
      const id = `note-${i}-${j}`;
      await select(id);
      await change('Mora', '2');
      const saved = await change('Horizontal episema', 'on');
      const target = saved.document.neumes[i].notes[j];
      assert.equal(target.mora, 2);
      assert.equal(target.episema, true);
      assert.match(
        await ev(
          `document.querySelector(${JSON.stringify(selector(id))}).getAttribute('aria-label')`,
        ),
        /Double punctum mora. Horizontal episema/,
      );
      assert.equal(
        await ev(`document.activeElement.getAttribute('aria-label')`),
        'Horizontal episema',
        'controls retain native focus',
      );
    }
  const marked = JSON.parse(await raw());
  const ordinary = structuredClone(specimen);
  ordinary.document.neumes.forEach((n, i) =>
    Object.assign(n.notes[i % n.notes.length], { mora: 1, episema: true }),
  );
  await importText(JSON.stringify(ordinary));
  await select('note-1-1');
  await snapshot('individual-single-and-episema');
  await importText(JSON.stringify(marked));
  await snapshot('all-seven-double-and-episema');
  await navigate();
  assert.deepEqual(JSON.parse(await raw()), marked);
  await select('note-0-0');
  await change('Mora', '0');
  await change('Mora', '1');
  const single = await raw();
  await button('Undo');
  assert.equal(
    JSON.parse(await raw()).document.neumes[0].notes[0].mora,
    undefined,
  );
  await button('Redo');
  assert.equal(await raw(), single);
  // A native arrow moves the selected note and retains both modifiers.
  await ev(`document.querySelector('[data-note-id="note-0-0"]').focus()`);
  await key('ArrowUp');
  const moved = JSON.parse(await raw()).document.neumes[0].notes[0];
  assert.deepEqual(moved, {
    id: 'note-0-0',
    staffPosition: 3,
    mora: 1,
    episema: true,
  });
  // Native Tab traversal into and within the contextual controls.
  await ev(`document.querySelector('[aria-label="Mora"]').focus()`);
  await key('Tab');
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-label')`),
    'Horizontal episema',
  );
  // Native export Blob, then file import, retains complete modified semantics.
  await ev(
    `window.exported=null;window.realCreate=URL.createObjectURL;URL.createObjectURL=blob=>{window.exported=blob;return realCreate(blob)};HTMLAnchorElement.prototype.click=function(){}`,
  );
  await button('Export');
  const exported = await ev('window.exported.text()');
  assert.deepEqual(JSON.parse(exported), JSON.parse(await raw()));
  await ev('window.confirm=()=>true');
  await importText(exported);
  assert.deepEqual(JSON.parse(await raw()), JSON.parse(exported));
  // Mixed boundaries, same-word lyrics, signed system ends and 320px containment.
  const wide = structuredClone(marked);
  wide.document.neumes = Array.from({ length: 5 }, (_, k) =>
    marked.document.neumes.map((n, i) => ({
      ...n,
      id: `wide-${k}-${i}`,
      notes: n.notes.map((note, j) => ({
        ...note,
        id: `wide-note-${k}-${i}-${j}`,
      })),
    })),
  ).flat();
  wide.document.syllables = wide.document.neumes.map((n, i) => ({
    id: 's' + i,
    text: i % 2 ? 'le' : 'Al',
    startsAtNeumeId: n.id,
    boundaryBefore: i === 0 ? 'word' : 'continuation',
  }));
  wide.document.divisions = [
    { id: 'bar', kind: 'minor', beforeNeumeId: 'wide-1-0' },
  ];
  wide.document.clefChanges = [
    {
      id: 'clef',
      clef: { type: 'f', staffLine: 2 },
      beforeNeumeId: 'wide-2-0',
      beforeDivisionId: null,
    },
  ];
  await importText(JSON.stringify(wide));
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause();
    assert.equal(
      await ev('document.documentElement.scrollWidth<=innerWidth'),
      true,
    );
    assert.ok(
      await ev('document.querySelectorAll("[data-system-index]").length>1'),
    );
    // Real SVG ink boxes, including every sign, remain in the root viewBox.
    assert.equal(
      await ev(
        `(()=>{const svg=document.querySelector('svg.score');const v=svg.viewBox.baseVal;return [...svg.querySelectorAll('.score__ink')].every(e=>{const b=e.getBBox();return b.x>=v.x-0.1&&b.y>=v.y-0.1&&b.x+b.width<=v.x+v.width+0.1&&b.y+b.height<=v.y+v.height+0.1})})()`,
      ),
      true,
    );
    await select('wide-note-0-1-0');
    await snapshot('multisystem-' + width);
  }
  // Porrectus owner-approved trailing placement: inspect actual SVG sign ink.
  const porrectus = JSON.parse(
    await readFile(
      new URL('porrectus-mora/editor-cases.chant.json', import.meta.url),
      'utf8',
    ),
  );
  const inspectPorrectus = async (fixture) => {
    assert.deepEqual(
      JSON.parse(await raw()),
      fixture,
      'engraving must preserve exact v2 note data',
    );
    const result = await ev(`(()=>{
      const input=${JSON.stringify(fixture.document.neumes)};
      const svg=document.querySelector('svg.score');const v=svg.viewBox.baseVal;
      const overlap=(a,b)=>a.x<b.x+b.width-0.01&&a.x+a.width>b.x+0.01&&a.y<b.y+b.height-0.01&&a.y+a.height>b.y+0.01;
      return input.map(n=>{
        const group=document.querySelector('[data-neume-id="'+n.id+'"]');
        const ink=group.querySelector('.score__ink');const body=ink.querySelector('path').getBBox();
        const signs=[...ink.querySelectorAll('rect')];
        const dots=signs.filter(e=>e.getAttribute('rx')==='2');
        const lines=[...group.closest('[data-system-index]').querySelectorAll('.score__staff-line')].map(e=>Number(e.getAttribute('y1')));
        const bottom=Math.max(...lines);
        const singleSecond=n.notes[1].mora===1&&!n.notes[0].mora&&!n.notes[2].mora&&!n.notes.some(note=>note.episema);
        const secondBounds=singleSecond?dots[0].getBBox():null;
        return {
          id:n.id, count:dots.length,
          trailing:dots.every(e=>e.getBBox().x>=body.x+body.width+2.99),
          clear:signs.every((e,i)=>[ink.querySelector('path'),...signs.slice(0,i)].every(other=>!overlap(e.getBBox(),other.getBBox()))),
          staffClear:dots.every(e=>{const b=e.getBBox();return lines.every(y=>b.y+b.height<=y-0.5||b.y>=y+0.5)}),
          contained:signs.every(e=>{const b=e.getBBox();return b.x>=v.x&&b.y>=v.y&&b.x+b.width<=v.x+v.width+0.1&&b.y+b.height<=v.y+v.height+0.1}),
          secondY:secondBounds?secondBounds.y+2:null,
          belowY:bottom-n.notes[1].staffPosition*12+12,
          adjacentLine:singleSecond&&n.notes[1].staffPosition%2===0&&n.notes[2].staffPosition-n.notes[1].staffPosition===1,
        };
      });
    })()`);
    for (const [index, r] of result.entries()) {
      assert.equal(
        r.count,
        fixture.document.neumes[index].notes.reduce(
          (sum, n) => sum + (n.mora ?? 0),
          0,
        ),
        r.id + ' dot count',
      );
      for (const flag of ['trailing', 'clear', 'staffClear', 'contained'])
        assert.equal(r[flag], true, r.id + ' ' + flag);
      if (r.adjacentLine)
        assert.equal(r.secondY, r.belowY, r.id + ' second-note space below');
    }
  };
  await importText(JSON.stringify(porrectus));
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause();
    await inspectPorrectus(porrectus);
    await snapshot('porrectus-trailing-' + width);
  }
  const porrectusSpace = structuredClone(porrectus);
  porrectusSpace.document.neumes.forEach((n) =>
    n.notes.forEach((note) => (note.staffPosition += 1)),
  );
  await importText(JSON.stringify(porrectusSpace));
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause();
    await inspectPorrectus(porrectusSpace);
    await snapshot('porrectus-trailing-transposed-' + width);
  }
  const porrectusDouble = structuredClone(porrectus);
  porrectusDouble.document.neumes.forEach((n) =>
    n.notes.forEach((note) => Object.assign(note, { mora: 2, episema: true })),
  );
  await importText(JSON.stringify(porrectusDouble));
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause();
    await inspectPorrectus(porrectusDouble);
    await snapshot('porrectus-double-episema-' + width);
  }
  // Corrupt/foreign v2 values do not destroy recoverable bytes.
  for (const invalid of [
    { ...marked, version: 99 },
    { ...marked, format: 'foreign' },
    {
      ...marked,
      document: {
        ...marked.document,
        neumes: [
          {
            id: 'bad',
            kind: 'punctum',
            notes: [{ id: 'bad-note', staffPosition: 2, mora: -1 }],
          },
        ],
        syllables: [],
      },
    },
  ]) {
    const text = JSON.stringify(invalid);
    await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(text)})`);
    await navigate();
    await pointer('[data-note-id="note-punctum-1"] .score__note-hit-target');
    await change('Mora', '1');
    assert.equal(await raw(), text);
    assert.match(await status(), /Not saved/);
  }
  assert.equal(
    await ev(
      `[...document.querySelectorAll('script[src],link[rel="stylesheet"]')].every(e=>(e.src||e.href).includes('/gregorian-chant-editor/assets/'))`,
    ),
    true,
  );
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox' : 'Chromium',
      result: 'PASS',
      output,
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
