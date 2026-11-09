import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-note-shapes-'));
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
async function pointer(selector) {
  await ev(
    `document.querySelector('.note-context-toolbar button[aria-label="Close note properties"]')?.click()`,
  );
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
  await ev(
    `document.querySelector('svg.score').scrollIntoView({block:'center'})`,
  );
  await pause();
  const point = await ev(`(()=>{
    const svg=document.querySelector('svg.score'),r=svg.getBoundingClientRect();
    for(let y=Math.max(8,r.top+8);y<Math.min(innerHeight-8,r.bottom-8);y+=20){
      const x=r.left+8;
      if(document.elementFromPoint(x,y)===svg)return {x,y};
    }
    throw Error('No unobscured blank score point');
  })()`);
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
async function snapshot(name) {
  await ev(
    `document.querySelector('.score-workspace').scrollIntoView({block:'start'})`,
  );
  if (name === 'forms-1440' || name === 'defaults-1440') {
    const rendered = await ev(
      `({svg:document.querySelector('svg.score').outerHTML,css:[...document.styleSheets].flatMap(s=>[...s.cssRules].map(r=>r.cssText)).join('\\n')})`,
    );
    await writeFile(
      join(
        output,
        name === 'forms-1440'
          ? 'rendered-score.json'
          : 'rendered-defaults.json',
      ),
      JSON.stringify(rendered),
    );
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    join(output, `${name}-${firefox ? 'firefox' : 'chromium'}.png`),
    Buffer.from(data, 'base64'),
  );
}
const baselineV1 = await readFile(
  new URL('../note-modifiers/baseline-v1.chant.json', import.meta.url),
  'utf8',
);
const baselineV2 = await readFile(
  new URL(
    '../note-modifiers/conventional/editor-cases.chant.json',
    import.meta.url,
  ),
  'utf8',
);
const blank = {
  format: 'gregorian-chant-editor',
  version: 3,
  document: {
    title: 'Stage 8B',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: [],
    syllables: [],
    divisions: [],
    clefChanges: [],
  },
};
async function hydrate(score) {
  const text = typeof score === 'string' ? score : JSON.stringify(score);
  await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(text)})`);
  await navigate();
  return text;
}
async function clickAt(point) {
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
}
async function staffPoint(x, y) {
  await ev(
    `document.querySelector('svg.score').scrollIntoView({block:'center'})`,
  );
  return ev(
    `(()=>{const s=document.querySelector('svg.score');const p=new DOMPoint(${x},${y}).matrixTransform(s.getScreenCTM());return {x:p.x,y:p.y}})()`,
  );
}
const score = async () => JSON.parse(await raw()).document;
function specimen() {
  const doc = structuredClone(blank);
  doc.document.title = 'Authored forms — adjacent and wider intervals';
  const cases = [
    ['punctum', [3], null, 'Square'],
    ['punctum', [3], 'virga', 'Virga'],
    ['punctum', [3], 'inclinatum', 'Upright'],
    ['podatus', [3, 4], 'quilisma', 'PesClose'],
    ['podatus', [0, 4], 'quilisma', 'PesWide'],
    ['scandicus', [2, 3, 4], 'quilisma', 'ScandClose'],
    ['scandicus', [0, 2, 4], 'quilisma', 'ScandWide'],
    ['scandicus', [0, 3, 5], 'quilisma', 'ScandBoth'],
    ['climacus', [5, 3, 1], null, 'Climacus'],
  ];
  doc.document.neumes = cases.map(([kind, pitches, form], i) => ({
    id: 'n' + i,
    kind,
    notes: pitches.map((staffPosition, j) => ({
      id: `note-${i}-${j}`,
      staffPosition,
      ...(form && j === (kind === 'scandicus' ? 1 : 0) ? { form } : {}),
    })),
  }));
  doc.document.syllables = cases.map((c, i) => ({
    id: 's' + i,
    text: c[3],
    startsAtNeumeId: 'n' + i,
    boundaryBefore: 'word',
  }));
  return doc;
}
// Compare actual SVG path commands in ink-local coordinates. A translation
// between a pointer ghost and canonical score placement must not change contour.
async function inkGeometry(selector) {
  return ev(`(()=>{
    const root=document.querySelector(${JSON.stringify(selector)});
    const ink=root?.querySelector('.score__ink');
    if(!ink)throw Error('Missing ink: '+${JSON.stringify(selector)});
    const b=ink.getBBox();
    const paths=[...ink.querySelectorAll('path')].map(p=>{
      const tokens=p.getAttribute('d').match(/[MLCQHVZ]|[-+]?(?:\\d*\\.\\d+|\\d+)(?:e[-+]?\\d+)?/gi);
      const result=[];let index=0,command;
      while(index<tokens.length){
        if(/^[MLCQHVZ]$/i.test(tokens[index]))command=tokens[index++];
        if(command==='Z'){result.push(['Z']);continue;}
        const count={M:2,L:2,C:6,Q:4,H:1,V:1}[command];
        if(!count)throw Error('Unexpected path command '+command);
        const values=tokens.slice(index,index+count).map(Number);index+=count;
        result.push([command,...values.map((n,j)=>Number((n-(command==='H'?b.x:command==='V'?b.y:j%2?b.y:b.x)).toFixed(4)))]);
      }
      return result;
    });
    return {width:Number(b.width.toFixed(4)),height:Number(b.height.toFixed(4)),paths};
  })()`);
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
  // Actual historical files: hydration never rewrites, first commit writes v4.
  for (const source of [baselineV1, baselineV2]) {
    await hydrate(source);
    assert.equal(await raw(), source);
    const original = JSON.parse(source).document;
    const id = original.neumes[0].notes[0].id;
    await select(id);
    const form = original.neumes[0].kind === 'punctum' ? 'virga' : 'quilisma';
    const saved = await change('Form', form);
    assert.equal(saved.version, 4);
    const expected = structuredClone(original);
    expected.neumes[0].notes[0].form = form;
    assert.deepEqual(saved.document, expected);
    await navigate();
    assert.deepEqual(await score(), expected);
    await ev('window.confirm=()=>true');
    await importText(source);
    assert.deepEqual(await score(), original);
  }
  // Native one-click insertion, figure selection before the click, shaped ghost.
  for (const [tool, figure, kind, form] of [
    ['virga', null, 'punctum', 'virga'],
    ['inclinatum', null, 'punctum', 'inclinatum'],
    ['quilisma', 'podatus', 'podatus', 'quilisma'],
    ['quilisma', 'scandicus', 'scandicus', 'quilisma'],
  ]) {
    await hydrate(blank);
    if (figure) await change('Quilisma figure', figure);
    await pointer(`[data-tool="${tool}"]`);
    assert.equal(
      await ev(
        `document.querySelector('[data-tool="${tool}"]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    const point = await staffPoint(210, 100);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await pause();
    const ghost = await inkGeometry('.score__placement-ghost');
    await snapshot('ghost-' + tool + (figure ?? ''));
    assert.ok(ghost.paths.length, 'ghost has actual path geometry');
    await clickAt(point);
    const doc = await score();
    assert.equal(doc.neumes.length, 1);
    assert.equal(doc.neumes[0].kind, kind);
    assert.equal(doc.neumes[0].notes[kind === 'scandicus' ? 1 : 0].form, form);
    assert.equal(doc.syllables.length, 0);
    assert.deepEqual(
      await inkGeometry('[data-neume-id="' + doc.neumes[0].id + '"]'),
      ghost,
      'actual ghost and committed paths must match up to translation',
    );
    assert.equal(
      await ev(
        `document.querySelector('[data-neume-id="${doc.neumes[0].id}"] .score__ink').getBBox().x`,
      ),
      144,
      'first figure ink begins at the known layout input, including inclinatum',
    );
    const label =
      form === 'virga'
        ? 'Virga'
        : form === 'inclinatum'
          ? 'Punctum inclinatum'
          : 'Quilisma ' + (kind === 'podatus' ? 'Podatus' : 'Scandicus');
    assert.equal(
      await ev(
        `document.querySelector('.editor-announcement').textContent.trim()`,
      ),
      label + ' added.',
    );
    const shapedId = doc.neumes[0].notes[kind === 'scandicus' ? 1 : 0].id;
    assert.match(
      await ev(
        `document.querySelector('[data-note-id="${shapedId}"]').getAttribute('aria-label')`,
      ),
      new RegExp(
        form === 'inclinatum'
          ? 'Punctum inclinatum'
          : form === 'virga'
            ? 'Virga'
            : 'Quilisma',
      ),
    );
    await pointer('[data-tool="select"]');
    await pointer('[aria-label="Undo last edit"]');
    assert.equal((await score()).neumes.length, 0);
    await pointer('[aria-label="Redo last undone edit"]');
    assert.deepEqual(await score(), doc);
    await navigate();
    assert.deepEqual(await score(), doc);
    // Figure selection uses DOM APIs and palette activation uses a native
    // pointer. Native I must insert the remembered kind AND authored form;
    // this does not claim keyboard-only tool selection.
    if (figure) await change('Quilisma figure', figure);
    await pointer('[data-tool="select"]');
    await pointer(`[data-tool="${tool}"]`);
    assert.equal(
      await ev(
        `document.querySelector('.editor-announcement').textContent.trim()`,
      ),
      'Placing ' + label + '.',
    );
    await key('i', 'KeyI');
    const keyboardScore = await score();
    assert.equal(keyboardScore.neumes.length, 2);
    assert.equal(keyboardScore.neumes[1].kind, kind);
    assert.equal(
      keyboardScore.neumes[1].notes[kind === 'scandicus' ? 1 : 0].form,
      form,
    );
  }
  const fixture = specimen();
  const defaults = structuredClone(fixture);
  defaults.document.neumes.forEach((n) =>
    n.notes.forEach((n) => delete n.form),
  );
  await hydrate(defaults);
  await snapshot('defaults-1440');
  await ev('window.confirm=()=>true');
  await importText(JSON.stringify(fixture));
  assert.deepEqual(await score(), fixture.document);
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await clearNote();
    const geometry = () =>
      ev(
        `(()=>{const s=document.querySelector('svg.score');const r=s.getBoundingClientRect();return {y:r.y+scrollY,height:r.height,width:r.width}})()`,
      );
    const before = await geometry();
    for (const id of [
      'note-0-0',
      'note-1-0',
      'note-2-0',
      'note-3-0',
      'note-5-1',
      'note-5-2',
      'note-8-1',
    ]) {
      await select(id);
      assert.deepEqual(
        await geometry(),
        before,
        'selection does not move score',
      );
    }
    await clearNote();
    assert.deepEqual(await geometry(), before);
    assert.equal(
      await ev('document.documentElement.scrollWidth<=innerWidth'),
      true,
    );
    await snapshot('forms-' + width);
    await select('note-5-1');
    assert.deepEqual(
      await ev(
        `[...document.querySelector('[aria-label="Form"]').options].map(o=>o.value)`,
      ),
      ['default', 'quilisma'],
    );
    let saved = await change('Horizontal episema', 'on');
    saved = await change('Mora scope', 'final-two');
    saved = await change('Form', 'default');
    const middle = saved.document.neumes[5].notes[1];
    assert.equal(middle.form, undefined);
    assert.equal(middle.episema, true);
    assert.equal(middle.mora, 1);
    saved = await change('Form', 'quilisma');
    assert.equal(saved.document.neumes[5].notes[1].form, 'quilisma');
    if (width === 1440) {
      await ev(
        `window.exported=null;window.realCreate=URL.createObjectURL;URL.createObjectURL=blob=>{window.exported=blob;return realCreate(blob)};HTMLAnchorElement.prototype.click=function(){}`,
      );
      await ev(
        `document.querySelector('.note-context-toolbar button[aria-label="Close note properties"]')?.click()`,
      );
      const exportPoint = await ev(
        `(()=>{const b=[...document.querySelectorAll('section[aria-label="Document"] button')].find(b=>b.textContent.trim()==='Export');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      );
      await clickAt(exportPoint);
      const exported = await ev('window.exported.text()');
      assert.deepEqual(JSON.parse(exported), saved);
      await ev('window.confirm=()=>true');
      await importText(exported);
      assert.deepEqual(await score(), saved.document);
      await select('note-5-1');
    }
    await snapshot('forms-modifiers-' + width);
    // Lower Scandicus and ineligible contexts never suggest authored overrides.
    await select('note-5-0');
    assert.equal(
      await ev(`document.querySelector('[aria-label="Form"]').disabled`),
      true,
    );
    await select('note-8-1');
    assert.equal(
      await ev(`document.querySelector('[aria-label="Form"]').disabled`),
      true,
    );
    // Reject deletion of the terminal, preserving the middle authored form.
    await select('note-5-2');
    await key('ArrowDown');
    assert.deepEqual(await score(), saved.document);
    assert.equal(
      await ev(`!!document.querySelector('.note-form-error')`),
      false,
      'invalid contour move must not suggest removing the form',
    );
    await key('Delete');
    assert.deepEqual(await score(), saved.document);
    assert.ok(
      await ev(
        `document.querySelector('.note-form-error')?.textContent.includes('Edit rejected')`,
      ),
    );
    await snapshot('rejected-delete-' + width);
    await key('i', 'KeyI');
    assert.equal(
      (await score()).neumes.length,
      saved.document.neumes.length + 1,
    );
    assert.equal(
      await ev(`!!document.querySelector('.note-form-error')`),
      false,
      'successful insertion clears stale feedback',
    );
    await pointer('[aria-label="Undo last edit"]');
    assert.deepEqual(await score(), saved.document);
    await select('note-1-0');
    await key('ArrowUp');
    assert.equal((await score()).neumes[1].notes[0].staffPosition, 4);
    await hydrate(fixture);
  }
  // Failed imports, withdrawn drafts, original bytes and byte conflict protection.
  await ev('window.confirm=()=>true');
  const before = await raw();
  for (const invalid of [
    { ...fixture, version: 5 },
    {
      ...fixture,
      document: {
        ...fixture.document,
        neumes: [
          {
            id: 'bad',
            kind: 'punctum',
            notes: [{ id: 'bad-note', staffPosition: 2, form: 'quilisma' }],
          },
        ],
        syllables: [],
      },
    },
  ]) {
    await importText(JSON.stringify(invalid));
    assert.equal(await raw(), before);
  }
  const draft = JSON.parse(baselineV2);
  draft.document.neumes[0].notes[0].mora = 2;
  const draftText = '\n' + JSON.stringify(draft, null, 3) + '\n';
  await hydrate(draftText);
  assert.equal(await raw(), draftText);
  assert.ok((await status()).includes('requires resolution'));
  await pointer('[data-tool="virga"]');
  await clickAt(await staffPoint(210, 100));
  assert.equal(await raw(), draftText);
  assert.ok(
    await ev(
      `[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Download original cached source'))`,
    ),
  );
  await hydrate(fixture);
  await ev(
    `localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(blank))})`,
  );
  await select('note-1-0');
  await change('Form', 'default');
  assert.equal(await raw(), JSON.stringify(blank));
  assert.ok((await status()).includes('another tab'));
  await hydrate(fixture);
  // Compare declared metrics to independent SVG extrema and sample every
  // painted contour against the actual constituent pointer targets.
  const ink = await ev(`(()=>{
    const spec=${JSON.stringify(specimen())};
    return spec.document.neumes.slice(0,8).map((n,i)=>{
      const group=document.querySelector('[data-neume-id="'+n.id+'"]');
      const path=group.querySelector('.score__ink path');
      const b=path.getBBox();
      const bottom=Math.max(...[...group.closest('[data-system-index]').querySelectorAll('.score__staff-line')].map(l=>+l.getAttribute('y1')));
      const expectedX=group.querySelector('.score__note-hit-target').getBBox().x+6;
      const pitches=n.notes.map(n=>n.staffPosition);
      const firstY=bottom-pitches[0]*12;
      let expected;
      if(n.kind==='punctum') expected={x:expectedX,width:i===2?14:12,y:firstY-(i===2?10:6),height:i===1?33:i===2?20:12};
      else {
        const top=bottom-pitches.at(-1)*12-(pitches.at(-1)-pitches.at(-2)===1?10:6);
        expected={x:expectedX,width:n.kind==='scandicus'?22.5:12,y:top,height:firstY+(n.kind==='scandicus'?6:7)-top};
      }
      const connections=[];
      if(n.kind==='scandicus'){
        const lowerShaftY=(firstY-6 + bottom-pitches[1]*12+7)/2;
        connections.push(path.isPointInFill(new DOMPoint(b.x+11.25,lowerShaftY)));
      }
      if(n.kind==='podatus'||n.kind==='scandicus'){
        const h=n.kind==='scandicus'?10.5:0;
        const upperBottom=bottom-pitches.at(-1)*12+(pitches.at(-1)-pitches.at(-2)===1?4:6);
        const waveTop=bottom-pitches.at(-2)*12-3;
        connections.push(path.isPointInFill(new DOMPoint(b.x+h+11.25,(upperBottom+waveTop)/2)));
      }
      const targets=[...group.querySelectorAll('.score__note-hit-target')];
      let unowned=0,ambiguous=0,samples=0;
      for(let x=b.x+.25;x<b.x+b.width;x+=.5)for(let y=b.y+.25;y<b.y+b.height;y+=.5){
        const point=new DOMPoint(x,y);
        if(!path.isPointInFill(point))continue;
        samples++;
        const owners=targets.filter(t=>t.isPointInFill(point)).length;
        if(!owners)unowned++;
        if(owners>1)ambiguous++;
      }
      return {id:n.id,box:{x:b.x,y:b.y,width:b.width,height:b.height},expected,samples,unowned,ambiguous,connections};
    });
  })()`);
  for (const measurement of ink) {
    for (const property of ['x', 'y', 'width', 'height'])
      assert.ok(
        Math.abs(measurement.box[property] - measurement.expected[property]) <
          0.02,
        JSON.stringify(measurement),
      );
    assert.equal(measurement.unowned, 0, JSON.stringify(measurement));
    assert.equal(measurement.ambiguous, 0, JSON.stringify(measurement));
    assert.ok(measurement.samples > 0);
    assert.ok(
      measurement.connections.every(Boolean),
      'Both rising shafts must contain actual ink: ' +
        JSON.stringify(measurement),
    );
  }
  await writeFile(
    join(output, 'ink-measurements.json'),
    JSON.stringify(ink, null, 2),
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await snapshot('forms-1440');
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
