import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-local-persistence-'));
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
const url = process.env.CHANT_PREVIEW_URL ?? 'http://127.0.0.1:4173/';
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
const captureExports = () =>
  ev(
    `window.exported=null;window.realCreate=URL.createObjectURL;URL.createObjectURL=blob=>{window.exported=blob;return realCreate(blob)};HTMLAnchorElement.prototype.click=function(){window.exportName=this.download;}`,
  );
async function checkResponsiveHeader(name) {
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause();
    await ev(
      `document.querySelector('.document-header').scrollIntoView({block:'center'})`,
    );
    await pause();
    assert.equal(
      await ev(`document.documentElement.scrollWidth<=innerWidth`),
      true,
      `${name} at ${width}px`,
    );
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(
      join(output, `${name}-${firefox ? 'firefox' : 'chromium'}-${width}.png`),
      Buffer.from(data, 'base64'),
    );
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
}
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  await navigate();
  await ev(`localStorage.clear()`);
  await navigate();
  assert.equal(await raw(), null);
  await checkResponsiveHeader('before-example');
  const choose = async (accept) => {
    await ev(`window.confirm=message=>{window.lastConfirmation=message;return ${accept}};
      (()=>{const e=document.querySelector('[aria-label="Load example"]');e.focus();e.value='./pater-noster.chant.json';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await pause();
  };
  await ev(
    `window.confirm=message=>{window.lastConfirmation=message;return false};document.querySelector('[aria-label="Load example"]').focus()`,
  );
  const keyboardExampleName = await ev(
    `document.querySelector('[aria-label="Load example"]').options[1].textContent`,
  );
  assert.ok(keyboardExampleName);
  if (firefox) {
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'example-key',
          actions: [
            { type: 'keyDown', value: '\uE015' },
            { type: 'keyUp', value: '\uE015' },
            { type: 'keyDown', value: '\uE007' },
            { type: 'keyUp', value: '\uE007' },
          ],
        },
      ],
    });
  } else {
    for (const key of ['ArrowDown', 'Enter'])
      for (const type of ['keyDown', 'keyUp'])
        await rawSend('Input.dispatchKeyEvent', {
          type,
          key,
          code: key,
          windowsVirtualKeyCode: key === 'Enter' ? 13 : 40,
        });
  }
  await pause();
  assert.ok(
    (await ev('window.lastConfirmation')).includes(keyboardExampleName),
  );
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-label')`),
    'Load example',
  );
  await choose(false);
  assert.equal(await raw(), null);
  assert.match(await ev('window.lastConfirmation'), /Pater Noster/);
  assert.equal(
    await ev(`document.querySelector('[aria-label="Load example"]').value`),
    '',
  );
  await choose(true);
  const loaded = await raw();
  const doc = JSON.parse(loaded).document;
  assert.equal(doc.title, 'Pater Noster');
  assert.equal(doc.neumes.length, 103);
  assert.equal(doc.neumes.flatMap((n) => n.notes).length, 111);
  assert.equal(
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Undo').disabled`,
    ),
    true,
  );
  await navigate();
  assert.equal(await raw(), loaded);
  await captureExports();
  await button('Export');
  assert.deepEqual(
    JSON.parse(await ev('window.exported.text()')).document,
    doc,
  );
  await checkResponsiveHeader('after-example');
  await ev(
    `localStorage.setItem('${storageKey}', 'foreign protected bytes');window.dispatchEvent(new StorageEvent('storage',{key:'${storageKey}'}))`,
  );
  await choose(true);
  assert.equal(await raw(), 'foreign protected bytes');
  assert.match(await status(), /Not saved|another tab/i);
  await button('Replace cache with this score / Retry save');
  assert.deepEqual(JSON.parse(await raw()).document, doc);
  const incompatible = JSON.parse(loaded);
  incompatible.version = 2;
  incompatible.document.neumes[0].notes[0].mora = 2;
  await ev(
    `localStorage.setItem('${storageKey}', ${JSON.stringify(JSON.stringify(incompatible))})`,
  );
  await navigate();
  const protectedSource = await raw();
  await choose(true);
  assert.equal(await raw(), protectedSource);
  assert.match(await status(), /Not saved/i);
  await button('Replace cache with this score / Retry save');
  assert.deepEqual(JSON.parse(await raw()).document, doc);
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
