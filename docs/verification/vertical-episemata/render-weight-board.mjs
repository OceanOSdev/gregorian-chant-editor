import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const [cb, ca, fb, fa] = await Promise.all(
  process.argv
    .slice(2, 6)
    .map(async (p) => JSON.parse(await readFile(p, 'utf8'))),
);
const gregorio = await readFile(
  new URL('weight-reference.png', import.meta.url),
);
const solesmes = await readFile(
  new URL('pater-solesmes-excerpt.png', import.meta.url),
);
const cards = [];
for (const [before, after] of [
  [cb, ca],
  [fb, fa],
])
  for (const kind of ['line', 'space'])
    for (const extreme of ['light', 'dark']) {
      const b = before.results.find((r) => r.config.name === 'narrow'),
        a = after.results.find((r) => r.config.name === 'narrow');
      const candidates = b.samples
        .filter((s) => s.kind === kind)
        .sort((a, b) => a.peakCoverage - b.peakCoverage);
      const previous = extreme === 'light' ? candidates[0] : candidates.at(-1),
        next = a.samples.find((s) => s.id === previous.id);
      const image = async (sample) => {
        const png = await readFile(sample.crop);
        const width = Number(
          execFileSync('identify', ['-format', '%w', sample.crop], {
            encoding: 'utf8',
          }),
        );
        return (
          '<img width="' +
          width * 10 +
          '" style="image-rendering:pixelated" src="data:image/png;base64,' +
          png.toString('base64') +
          '">'
        );
      };
      cards.push(
        '<article><h2>' +
          before.browser +
          ' ' +
          kind +
          ' / ' +
          extreme +
          '</h2><p>' +
          previous.id +
          ' · center-row peak ' +
          previous.peakCoverage.toFixed(3) +
          ' → ' +
          next.peakCoverage.toFixed(3) +
          '</p><div class="pair"><figure><figcaption>Before</figcaption>' +
          (await image(previous)) +
          '</figure><figure><figcaption>After</figcaption>' +
          (await image(next)) +
          '</figure></div><p>Staff gap ' +
          previous.staffGap.toFixed(3) +
          ' → ' +
          next.staffGap.toFixed(3) +
          ' CSS px</p></article>',
      );
    }
const html =
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:white;color:#201d19;font-family:Georgia,serif}h1{font-size:25px;margin:0 0 8px}h2{font-size:18px;margin:0 0 6px}p,figcaption{font-size:14px;margin:6px 0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{padding:10px;border:1px solid #bbb}.pair{display:flex;align-items:flex-start;justify-content:space-around}figure{margin:0}.references{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.references img{width:100%;height:auto}</style><h1>Actual raster crops at 320px — unchanged tick width, improved staff clearance</h1><p>Native Chromium/Firefox screenshot pixels enlarged 10× with nearest-neighbor sampling. Light/dark means smallest/largest peak coverage within the same pitch family; width stays 1.5 × 7 layout units. No crispEdges or extra paint.</p><div class="grid">' +
  cards.join('') +
  '</div><div class="references"><article><h2>Actual Gregorio 6.0.0 / Greciliae — repeated f/g (positions 2/3)</h2><img src="data:image/png;base64,' +
  gregorio.toString('base64') +
  '"><p>Compiled reference, original font typography; qualitative comparison, not a pixel-identical stencil.</p></article><article><h2>Printed Solesmes — Gregorian Missal (1990), p. 41</h2><img src="data:image/png;base64,' +
  solesmes.toString('base64') +
  '"><p>The short under-note tick remains separate from neighboring ink. The source scan has its own print/raster characteristics.</p></article></div>';
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1820,
    height: 1500,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', {
    url: 'data:text/html;base64,' + Buffer.from(html).toString('base64'),
  });
  for (let i = 0; i < 50; i++) {
    const r = await send('Runtime.evaluate', {
      expression:
        'document.readyState==="complete"&&[...document.images].every(i=>i.complete)',
      returnByValue: true,
    });
    if (r.result.value) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const fits = await send('Runtime.evaluate', {
    expression:
      'document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth',
    returnByValue: true,
  });
  assert.equal(fits.result.value, true, 'complete board must fit');
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    new URL('weight-before-after.png', import.meta.url),
    Buffer.from(data, 'base64'),
  );
} finally {
  ws.close();
  await fetch(endpoint + '/close/' + page.id);
}
