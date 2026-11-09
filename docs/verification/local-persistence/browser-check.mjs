import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-local-persistence-'));
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
    `document.querySelector('section[aria-label="Document"] [role="status"]').textContent`,
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
const fixture = {
  format: 'gregorian-chant-editor',
  version: 1,
  document: {
    title: 'Salve / Regina',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: 40 }, (_, i) => ({
      id: 'n' + i,
      kind: 'punctum',
      notes: [{ id: 'note' + i, staffPosition: i % 5 }],
    })),
    syllables: [
      {
        id: 's1',
        text: 'Sál',
        startsAtNeumeId: 'n0',
        boundaryBefore: 'word',
        alignment: { start: 1, end: 2 },
      },
      {
        id: 's2',
        text: 've',
        startsAtNeumeId: 'n12',
        boundaryBefore: 'continuation',
      },
    ],
    divisions: [
      { id: 'd1', kind: 'minima', beforeNeumeId: 'n8' },
      { id: 'd2', kind: 'finalis', beforeNeumeId: null },
    ],
    clefChanges: [
      {
        id: 'c1',
        clef: { type: 'f', staffLine: 2 },
        beforeNeumeId: 'n15',
        beforeDivisionId: null,
      },
      {
        id: 'c2',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: null,
        beforeDivisionId: 'd2',
      },
    ],
  },
};
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
  }
  await navigate();
  await ev(`localStorage.clear()`);
  await navigate();
  assert.equal(await raw(), null, 'initial render must not save example');
  assert.equal(
    await ev(`document.querySelectorAll('[data-note-id]').length`),
    4,
  );
  // Change a real native select; read storage in the very same task as dispatch.
  const immediate = await ev(
    `(()=>{const e=document.querySelector('[aria-label="Lyric language"]');e.value='el';e.dispatchEvent(new Event('change',{bubbles:true}));return JSON.parse(localStorage.getItem('${storageKey}')).document.lyricLanguage;})()`,
  );
  assert.equal(immediate, 'el');
  await navigate();
  assert.match(await status(), /Recovered/);
  await ev(`window.confirm=()=>false`);
  const before = await raw();
  await button('New');
  assert.equal(await raw(), before);
  await ev(`window.confirm=()=>true`);
  await importText(JSON.stringify(fixture));
  assert.deepEqual(JSON.parse(await raw()), fixture);
  assert.equal(
    await ev(
      `document.querySelector('[aria-label="Undo last edit"]').disabled`,
    ),
    true,
  );
  assert.ok(
    await ev(`document.querySelectorAll('[data-system-index]').length>1`),
  );
  // Export exercises the actual Blob/filename path; capture bytes before native download.
  await ev(
    `window.exported=null;window.realCreate=URL.createObjectURL;URL.createObjectURL=blob=>{window.exported=blob;return realCreate(blob)};HTMLAnchorElement.prototype.click=function(){window.exportName=this.download;}`,
  );
  await button('Export');
  const exported = await ev(`window.exported.text()`);
  assert.deepEqual(JSON.parse(exported), fixture);
  assert.equal(await ev('window.exportName'), 'Salve-Regina.chant.json');
  await button('New');
  assert.equal(JSON.parse(await raw()).document.neumes.length, 0);
  await importText(exported);
  assert.deepEqual(JSON.parse(await raw()), fixture);
  const original = await raw();
  for (const bad of [
    '{broken',
    JSON.stringify({ ...fixture, version: 5 }),
    JSON.stringify({
      ...fixture,
      document: { ...fixture.document, neumes: null },
    }),
    ' '.repeat(1024 * 1024 + 1),
  ]) {
    await importText(bad);
    assert.equal(await raw(), original);
    assert.match(
      await ev(
        `document.querySelector('section[aria-label="Document"] [role="alert"]').textContent`,
      ),
      /Import failed/,
    );
  }
  await ev(`window.confirm=()=>false`);
  await importText(
    JSON.stringify({
      ...fixture,
      document: { ...fixture.document, title: 'Canceled' },
    }),
  );
  assert.equal(await raw(), original);
  await ev(`window.confirm=()=>true`);
  await ev(
    `(()=>{const e=document.querySelector('[aria-label="Lyric language"]');e.value='en';e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  await button('Undo');
  assert.deepEqual(JSON.parse(await raw()), fixture);
  await navigate();
  assert.deepEqual(JSON.parse(await raw()), fixture);
  await ev(
    `(()=>{const e=document.querySelector('[aria-label="Lyric language"]');e.value='en';e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  await button('Undo');
  await button('Redo');
  assert.equal(JSON.parse(await raw()).document.lyricLanguage, 'en');
  await navigate();
  assert.equal(JSON.parse(await raw()).document.lyricLanguage, 'en');
  // Dirty lyrics keep document operations disabled and announce committed-only saving.
  await ev(
    `document.querySelector('[data-syllable-id="s1"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
  );
  await pause();
  const inputs = await ev(
    `[...document.querySelectorAll('input#lyric-input')].map(e=>({label:e.getAttribute('aria-label'),value:e.value}))`,
  );
  if (!inputs.length) throw Error('Expected lyric draft input');
  await ev(
    `(()=>{const e=document.querySelector('input#lyric-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Draft');e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await pause();
  assert.equal(
    await ev(
      `document.querySelector('section[aria-label="Document"] fieldset').disabled`,
    ),
    true,
  );
  assert.match(await status(), /Pending edits/);
  await navigate();
  // Staged clef edits block document operations without saving the preview.
  const committedBeforeDraft = await raw();
  await ev(
    `document.querySelector('[data-clef-change-id="c1"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
  );
  await pause();
  await button('Edit clef change');
  assert.equal(
    await ev(
      `document.querySelector('section[aria-label="Document"] fieldset').disabled`,
    ),
    true,
  );
  assert.equal(await raw(), committedBeforeDraft);
  await button('Cancel clef change');
  assert.equal(
    await ev(
      `document.querySelector('section[aria-label="Document"] fieldset').disabled`,
    ),
    false,
  );
  assert.equal(await raw(), committedBeforeDraft);
  // Actual independent tab/context write: the original tab must warn and preserve both scores.
  const otherText = JSON.stringify({
    ...fixture,
    document: { ...fixture.document, title: 'Other tab' },
  });
  if (firefox) {
    const other = (await rawSend('browsingContext.create', { type: 'tab' }))
      .context;
    await rawSend('browsingContext.navigate', {
      context: other,
      url,
      wait: 'complete',
    });
    await rawSend('script.evaluate', {
      expression: `localStorage.setItem('${storageKey}',${JSON.stringify(otherText)})`,
      target: { context: other },
      awaitPromise: true,
    });
    await rawSend('browsingContext.close', { context: other });
  } else {
    const other = await (
      await fetch('http://127.0.0.1:9230/json/new?' + encodeURIComponent(url), {
        method: 'PUT',
      })
    ).json();
    const socket = new WebSocket(other.webSocketDebuggerUrl);
    await new Promise((r) => socket.addEventListener('open', r));
    const response = new Promise((r) =>
      socket.addEventListener('message', r, { once: true }),
    );
    socket.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `localStorage.setItem('${storageKey}',${JSON.stringify(otherText)})`,
        },
      }),
    );
    await response;
    socket.close();
    await fetch('http://127.0.0.1:9230/json/close/' + other.id);
  }
  await pause();
  await pause();
  assert.match(await status(), /another tab/);
  await ev(
    `(()=>{const e=document.querySelector('[aria-label="Lyric language"]');e.value='und';e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  assert.equal(await raw(), otherText);
  await ev(`window.confirm=()=>true`);
  await button('Load cached score');
  assert.equal(
    await ev(`document.querySelector('h1').textContent`),
    'Other tab',
  );
  // Corrupt cache survives initial render and subsequent edits until explicit recovery.
  await ev(`localStorage.setItem('${storageKey}','{damaged')`);
  await navigate();
  assert.match(await status(), /invalid or unavailable/);
  await ev(
    `(()=>{const e=document.querySelector('[aria-label="Lyric language"]');e.value='el';e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  assert.equal(await raw(), '{damaged');
  await ev(`window.confirm=()=>true`);
  await button('Replace cache with this score / Retry save');
  assert.equal(JSON.parse(await raw()).document.lyricLanguage, 'el');
  // Throwing browser storage still allows edits and reports failure.
  await ev(
    `window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota test','QuotaExceededError')}`,
  );
  await ev(
    `(()=>{const e=document.querySelector('[aria-label="Lyric language"]');e.value='en';e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  assert.match(await status(), /Not saved/);
  assert.equal(
    await ev(`document.querySelector('[aria-label="Lyric language"]').value`),
    'en',
  );
  await ev(`Storage.prototype.setItem=window.originalSet`);
  await button('Replace cache with this score / Retry save');
  assert.equal(JSON.parse(await raw()).document.lyricLanguage, 'en');
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause();
    assert.equal(
      await ev(`document.documentElement.scrollWidth<=innerWidth`),
      true,
    );
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(
      join(output, `${firefox ? 'firefox' : 'chromium'}-${width}.png`),
      Buffer.from(data, 'base64'),
    );
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
