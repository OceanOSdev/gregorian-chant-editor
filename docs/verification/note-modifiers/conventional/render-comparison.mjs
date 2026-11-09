import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Supply rendered-score.json emitted by the real-editor browser driver. This
// composes actual SVG and actual Gregorio output; it invents no notation.
const captured = JSON.parse(await readFile(process.argv[2], 'utf8'));
const reference = await readFile(
  new URL('gregorio-comparison.png', import.meta.url),
);
const endpoint = process.env.CHANT_CHROMIUM_URL ?? 'http://127.0.0.1:9230/json';
const page = await (
  await fetch(endpoint + '/new?about:blank', { method: 'PUT' })
).json();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve));
let serial = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const value = JSON.parse(event.data);
  if (value.id) {
    pending.get(value.id)?.(value);
    pending.delete(value.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, (value) =>
      value.error
        ? reject(Error(JSON.stringify(value.error)))
        : resolve(value.result),
    );
    ws.send(JSON.stringify({ id, method, params }));
  });
try {
  const html = `<!doctype html><meta charset="utf-8"><style>${captured.css}
  body {margin:0;padding:24px;background:#fff;color:#111;font-family:serif;max-width:none}
  h1 {font-size:26px;margin:0 0 12px} h2 {font-size:22px;margin:0 0 12px}
  .comparison {display:grid;grid-template-columns:1fr 1fr;gap:24px}
  article {min-width:0;border:1px solid #ccc;padding:12px}
  article img, article svg.score {display:block;width:100%;height:auto;max-width:none}
  p {font-size:17px;margin:0 0 14px}
  </style><h1>Conventional mora — matching authored pitches and affected notes</h1>
  <p>Reference labels are test lyrics. Compare named singles and final pairs across sheets; automatic line breaks and font proportions differ.</p>
  <div class="comparison"><article><h2>Gregorio 6.0.0 / Greciliae</h2><img src="data:image/png;base64,${reference.toString('base64')}" alt="Actual Gregorio rendering"><p>Justified TeX sign spacing may differ from the editor's fixed advances. This is a qualitative placement comparison, not a contour replacement.</p></article><article><h2>Editor — actual shared SVG geometry</h2>${captured.svg}</article></div>`;
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1820,
    height: 1400,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', {
    url: 'data:text/html;base64,' + Buffer.from(html).toString('base64'),
  });
  for (let i = 0; i < 30; i++) {
    const result = await send('Runtime.evaluate', {
      expression:
        'document.readyState === "complete" && !!document.querySelector("svg.score") && [...document.images].every(i=>i.complete)',
      returnByValue: true,
    });
    if (result.result.value) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const result = await send('Runtime.evaluate', {
    expression:
      '!!document.querySelector("svg.score") && document.documentElement.scrollHeight <= innerHeight',
    returnByValue: true,
  });
  assert.equal(
    result.result.value,
    true,
    'comparison must be complete and fit the screenshot',
  );
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    new URL('editor-vs-gregorio.png', import.meta.url),
    Buffer.from(data, 'base64'),
  );
} finally {
  ws.close();
  await fetch(endpoint + '/close/' + page.id);
}
