import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Composes real captured editor SVG and printed excerpts. No notation is drawn here.
const capturedDirectory = process.argv[2];
if (!capturedDirectory) throw Error('Supply a browser-check output directory');
const outputPrefix = process.argv[3] ?? '';
const root = fileURLToPath(new URL('.', import.meta.url));
function spacing(path) {
  const [width, height] = execFileSync('identify', ['-format', '%w %h', path], {
    encoding: 'utf8',
  })
    .trim()
    .split(' ')
    .map(Number);
  const pixels = execFileSync(
    'convert',
    [
      path,
      '-background',
      'white',
      '-alpha',
      'remove',
      '-colorspace',
      'Gray',
      '-depth',
      '8',
      'gray:-',
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  const rows = [];
  for (let y = 0; y < height; y++) {
    let dark = 0;
    for (let x = 0; x < width; x++) if (pixels[y * width + x] < 130) dark++;
    if (dark > width * 0.5 && (rows.length === 0 || y - rows.at(-1) > 4))
      rows.push(y);
  }
  const gaps = rows
    .slice(1)
    .map((y, i) => y - rows[i])
    .filter((n) => n > 12 && n < 100)
    .sort((a, b) => a - b);
  if (gaps.length < 3) throw Error('Cannot establish staff spacing in ' + path);
  return {
    width,
    height,
    firstStaffLine: rows[0],
    staffSpacing: gaps[Math.floor(gaps.length / 2)],
  };
}
const rows = [
  [
    'Laetatus sum — one flat, B–C–B Torculus',
    'laetatus-printed.png',
    'laetatus-torculus',
    130,
    130,
    400,
  ],
  [
    'Ecce virgo — one flat, B–A–B Porrectus',
    'ecce-printed.png',
    'ecce-porrectus',
    130,
    150,
    250,
  ],
  [
    'Benedicta — early sign between groups on ma-, B owner in ter',
    'benedicta-printed.png',
    'benedicta-mater',
    130,
    370,
    250,
  ],
  [
    'Beata gens — natural within Domini, before the later affected B',
    'beata-natural-printed.png',
    'beata-natural',
    130,
    570,
    350,
  ],
  [
    'Beata gens — flat over earlier F; G–A intervenes before B virga',
    'beata-gens-printed-omnis.png',
    'beata-reference',
    130,
    350,
    360,
  ],
];
const panels = [];
let css = '';
const normalization = [];
for (const [title, file, name, x, width, cropLeft] of rows) {
  const image = await readFile(join(root, file)),
    info = spacing(join(root, file));
  const captured = JSON.parse(
    await readFile(join(capturedDirectory, name + '.json'), 'utf8'),
  );
  css = captured.css.replaceAll('\\n', '\n');
  const svg = captured.svg
    .replace(/viewBox="[^"]+"/, `viewBox="${x} 20 ${width} 175"`)
    .replace(
      '<svg ',
      `<svg style="width:${width * 2}px;height:350px;max-width:none" `,
    );
  panels.push(
    `<h2>${title}</h2><div class="pair"><article><h3>Printed edition — staff lines normalized to 48 px</h3><div class="crop"><img style="width:${(info.width * 48) / info.staffSpacing}px;max-width:none;margin-left:${(-cropLeft * 48) / info.staffSpacing}px;margin-top:${64 - (info.firstStaffLine * 48) / info.staffSpacing}px" src="data:image/png;base64,${image.toString('base64')}"></div></article><article><h3>Actual editor SVG — 2× canonical units (48 px staff interval)</h3>${svg}</article></div>`,
  );
  normalization.push({
    file,
    ...info,
    printCropLeft: cropLeft,
    scale: 48 / info.staffSpacing,
    editorUnitsToPixels: 2,
    editorViewBox: [x, 20, width, 175],
  });
}
const compiledPath = join(root, 'beata-gens-gregorio-omnis.png');
const compiledInfo = spacing(compiledPath);
const compiledImage = await readFile(compiledPath);
normalization.push({
  file: 'beata-gens-gregorio-omnis.png',
  ...compiledInfo,
  scale: 48 / compiledInfo.staffSpacing,
});
panels.push(
  `<h2>Beata gens — actual Gregorio compilation of the retained omnis fragment</h2><p>Same 48 px staff interval as both columns above; flat over terminal F, rising G–A, then B virga. Gregorio's full source fragment includes introductory notes omitted by the supported editor excerpt.</p><div class="crop"><img style="width:${(compiledInfo.width * 48) / compiledInfo.staffSpacing}px;max-width:none" src="data:image/png;base64,${compiledImage.toString('base64')}"></div>`,
);
const html = `<!doctype html><meta charset="utf-8"><style>${css}
body{margin:0;padding:24px;background:white;color:#111;max-width:none;font:18px Georgia,serif}h1{font-size:28px}h2{font-size:22px;margin:20px 0 4px}h3{font-size:17px;margin:0 0 12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}article{border:1px solid #bbb;padding:12px;overflow:hidden}.crop{height:350px;overflow:hidden}img,svg.score{display:block;max-width:none}svg.score{pointer-events:none}.note-context-toolbar{display:none}</style><h1>Stage 8D — printed evidence and actual editor geometry</h1><p>Uniform staff-scale normalization; different editions and original project contours are not exact facsimiles. The editor specimens isolate supported groups; the Domini context and omitted source details are documented in implementation.md. Above-note clearances retain the authored anchor.</p>${panels.join('')}`;
await writeFile(
  join(root, outputPrefix + 'comparison-normalization.json'),
  JSON.stringify(normalization, null, 2) + '\n',
);
const pages = await (
  await fetch(process.env.CHANT_CHROMIUM_URL ?? 'http://127.0.0.1:9230/json')
).json();
const endpoint = new URL(
  pages.find((p) => p.type === 'page').webSocketDebuggerUrl,
);
const page = await (
  await fetch(`http://${endpoint.host}/json/new?about:blank`, { method: 'PUT' })
).json();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve));
let serial = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, (m) =>
      m.error ? reject(Error(JSON.stringify(m.error))) : resolve(m.result),
    );
    ws.send(JSON.stringify({ id, method, params }));
  });
try {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 2200,
    height: 2300,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', {
    url: 'data:text/html;base64,' + Buffer.from(html).toString('base64'),
  });
  await send('Runtime.evaluate', {
    expression:
      'Promise.all([...document.images].map(i=>i.decode())).then(()=>document.fonts.ready)',
    awaitPromise: true,
  });
  const height = (
    await send('Runtime.evaluate', {
      expression: 'document.documentElement.scrollHeight',
      returnByValue: true,
    })
  ).result.value;
  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 2200, height, scale: 1 },
  });
  await writeFile(
    join(root, outputPrefix + 'editor-vs-printed.png'),
    Buffer.from(screenshot.data, 'base64'),
  );
  console.log(JSON.stringify({ height, normalization }));
} finally {
  await send('Page.close');
  ws.close();
}
