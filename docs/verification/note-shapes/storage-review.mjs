import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-storage-review-'));
const firefox = Boolean(process.env.CHANT_FIREFOX_URL);
const pages = firefox
  ? []
  : await (
      await fetch(
        process.env.CHANT_CHROMIUM_URL ?? 'http://127.0.0.1:9250/json',
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
  'http://127.0.0.1:4255/gregorian-chant-editor/';
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
const currentVersion = Number(process.env.CHANT_CURRENT_VERSION ?? 3);
const newUrl = url + '?build=v' + currentVersion;
const oldUrl = url + '?build=v2';
const fixture = {
  format: 'gregorian-chant-editor',
  version: 2,
  document: {
    title: 'Disposable storage investigation',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: [
      { id: 'n', kind: 'punctum', notes: [{ id: 'note', staffPosition: 2 }] },
    ],
    syllables: [],
    divisions: [],
    clefChanges: [],
  },
};
const report = {
  browser: firefox ? 'Firefox' : 'Chromium',
  checks: [],
  extreme: [],
};
async function go(target) {
  await send('Page.navigate', { url: target });
  await ready();
}
async function eventually(expression) {
  for (let i = 0; i < 50; i++) {
    if (await ev(expression)) return;
    await pause();
  }
  throw Error('Timed out: ' + expression);
}
async function otherTab() {
  if (firefox) {
    const other = (await rawSend('browsingContext.create', { type: 'tab' }))
      .context;
    await rawSend('browsingContext.navigate', {
      context: other,
      url: newUrl,
      wait: 'complete',
    });
    return {
      evaluate: async (expression) => {
        const r = await rawSend('script.evaluate', {
          expression: `JSON.stringify((0,eval)(${JSON.stringify(expression)}))`,
          target: { context: other },
          awaitPromise: true,
        });
        if (r.type === 'exception') throw Error(JSON.stringify(r));
        return JSON.parse(r.result.value);
      },
      close: () => rawSend('browsingContext.close', { context: other }),
    };
  }
  const endpoint =
    process.env.CHANT_CHROMIUM_URL ?? 'http://127.0.0.1:9250/json';
  const page = await (
    await fetch(endpoint + '/new?' + encodeURIComponent(newUrl), {
      method: 'PUT',
    })
  ).json();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => socket.addEventListener('open', r));
  let nextId = 0;
  const waiting = new Map();
  socket.addEventListener('message', (e) => {
    const r = JSON.parse(e.data);
    if (r.id) {
      waiting.get(r.id)?.(r);
      waiting.delete(r.id);
    }
  });
  return {
    evaluate: (expression) =>
      new Promise((resolve, reject) => {
        const id = ++nextId;
        waiting.set(id, (r) =>
          r.error || r.result.exceptionDetails
            ? reject(Error(JSON.stringify(r)))
            : resolve(r.result.result.value),
        );
        socket.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true, awaitPromise: true },
          }),
        );
      }),
    close: async () => {
      socket.close();
      await fetch(endpoint + '/close/' + page.id);
    },
  };
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
  await go(oldUrl);
  assert.equal(
    await raw(),
    null,
    'Use a newly created disposable profile/origin only; refuse to overwrite an existing cache',
  );
  const original = JSON.stringify(fixture);
  await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(original)})`);
  await go(oldUrl);
  assert.equal(await raw(), original);
  assert.equal(
    await ev(`!!document.querySelector('[aria-label="Form"]')`),
    false,
    'actual baseline v2 app',
  );
  await select('note');
  const v2 = await change('Mora scope', 'sole');
  assert.equal(v2.version, 2);
  assert.match(await status(), /Saved locally/);
  const oldBytes = await raw();
  await go(oldUrl);
  assert.equal(await raw(), oldBytes);
  await go(newUrl);
  assert.equal(await raw(), oldBytes, 'current hydration does not rewrite v2');
  await select('note');
  const v3 = await change('Form', 'virga');
  assert.equal(v3.version, currentVersion);
  assert.equal(v3.document.neumes[0].notes[0].mora, 1);
  const newBytes = await raw();
  await go(newUrl);
  assert.equal(await raw(), newBytes);
  assert.match(await status(), /Saved locally/);
  report.checks.push(
    'Actual v2 save -> unchanged current hydration -> committed current form -> immediate refresh, preserving mora/IDs',
  );
  await go(oldUrl);
  assert.equal(await raw(), newBytes);
  assert.match(await status(), /Not saved.*invalid/);
  await select('note-punctum-1');
  await change('Mora scope', 'sole');
  assert.equal(await raw(), newBytes);
  report.checks.push(
    'Actual v2 app rejects current schema with explicit recovery/unsaved feedback and blocks overwriting original bytes',
  );
  await go(newUrl);
  const other = await otherTab();
  try {
    for (let i = 0; i < 40; i++) {
      if (
        await other.evaluate(`!!document.querySelector('[aria-label="Form"]')`)
      )
        break;
      await pause();
    }
    await other.evaluate(
      `document.querySelector('[data-note-id="note"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
    );
    await pause();
    assert.equal(
      await other.evaluate(
        `document.querySelector('[data-note-id="note"]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    await other.evaluate(
      `(()=>{const s=document.querySelector('[aria-label="Form"]');s.value='inclinatum';s.dispatchEvent(new Event('change',{bubbles:true}));return localStorage.getItem('${storageKey}');})()`,
    );
    await eventually(
      `document.querySelector('.document-header__save-status').textContent.includes('another tab')`,
    );
    const remoteBytes = await raw();
    assert.equal(
      JSON.parse(remoteBytes).document.neumes[0].notes[0].form,
      'inclinatum',
    );
    await select('note');
    await change('Form', 'default');
    assert.equal(await raw(), remoteBytes);
    assert.match(await status(), /Not saved.*another tab/);
    await go(newUrl);
    assert.equal(await raw(), remoteBytes);
    assert.match(await status(), /Saved locally/);
    await select('note');
    await change('Form', 'default');
    for (let i = 0; i < 40; i++) {
      if (
        (
          await other.evaluate(
            `document.querySelector('.document-header__save-status').textContent`,
          )
        ).includes('another tab')
      )
        break;
      await pause();
    }
    assert.match(
      await other.evaluate(
        `document.querySelector('.document-header__save-status').textContent`,
      ),
      /Not saved.*another tab/,
    );
    report.checks.push(
      'Two actual app tabs: independent form commit triggers unsaved/conflict UI; blocked edits preserve remote bytes; reload recovers; reverse write conflicts too',
    );
  } finally {
    await other.close();
  }
  // Repeat committed edit + immediate navigation; read cache in the same JS task as dispatch.
  for (let i = 0; i < 12; i++) {
    await select('note');
    const form = ['virga', 'inclinatum', 'default'][i % 3];
    const saved = await change('Form', form);
    assert.equal(
      saved.document.neumes[0].notes[0].form,
      form === 'default' ? undefined : form,
    );
    const bytes = await raw();
    await go(newUrl);
    assert.equal(await raw(), bytes);
    assert.match(await status(), /Saved locally/);
  }
  report.checks.push(
    '12 successive same-task form saves followed immediately by navigation/refresh retain exact bytes and report Saved locally',
  );
  // Controlled failure in this disposable page only, without changing existing cache.
  const quotaBefore = await raw();
  await ev(
    `Storage.prototype.setItem=function(){throw new DOMException('Review quota probe','QuotaExceededError')}`,
  );
  await select('note');
  await change('Form', 'virga');
  assert.equal(await raw(), quotaBefore);
  assert.match(await status(), /Not saved.*Review quota probe/);
  await go(newUrl);
  assert.equal(await raw(), quotaBefore);
  assert.match(await status(), /Saved locally/);
  report.checks.push(
    'Injected storage failure leaves prior cache untouched, shows Not saved, and refresh restores only the last successful commit',
  );
  // Separate pre-existing extreme-pitch rendering probe. Do not change semantics or clamp the score.
  for (const [build, version, appearance] of [
    ['v2', 2, { mora: 1 }],
    ['v' + currentVersion, currentVersion, { form: 'virga' }],
  ]) {
    const extreme = structuredClone(fixture);
    extreme.version = version;
    extreme.document.neumes[0].notes[0] = {
      id: 'note',
      staffPosition: Number.MAX_SAFE_INTEGER,
      ...appearance,
    };
    const bytes = JSON.stringify(extreme);
    await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(bytes)})`);
    await go(url + '?build=' + build);
    const view = await ev(
      `(()=>{const svg=document.querySelector('svg.score');return {viewBox:svg.getAttribute('viewBox'),height:svg.viewBox.baseVal.height,cssHeight:svg.getBoundingClientRect().height,newEnabled:[...document.querySelectorAll('.document-header__actions button')].find(b=>b.textContent==='New').disabled===false}})()`,
    );
    assert.ok(view.height > 1e16);
    assert.equal(view.newEnabled, true);
    assert.equal(
      JSON.parse(await raw()).document.neumes[0].notes[0].staffPosition,
      Number.MAX_SAFE_INTEGER,
    );
    await go(url + '?build=' + build);
    assert.equal(await raw(), bytes);
    report.extreme.push({ build, ...view, cachePreserved: true });
  }
  await writeFile(
    join(output, 'storage-review.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ output, ...report }));
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
