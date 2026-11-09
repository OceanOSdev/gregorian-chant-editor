import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Supply rendered-score.json emitted by the real-editor browser driver. This
// composes actual SVG and actual Gregorio output; it invents no notation.
const captured = JSON.parse(await readFile(process.argv[2], 'utf8'));
const reference = await readFile(
  new URL('gregorio-reference-detail.png', import.meta.url),
);
const traditional = await readFile(
  new URL('traditional-quilisma-table.png', import.meta.url),
);
const before = process.argv[3]
  ? JSON.parse(await readFile(process.argv[3], 'utf8'))
  : null;
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
  </style><h1>Authored note forms — original SVG and actual references</h1>
  <p>Compare Virga, neutral Inclinatum, close/wide quilisma-pes and connected three-note Scandicus. The owner chose the traditional connected silhouette; Gregorio separates the initial punctum. Labels are test lyrics.</p>
  <div class="comparison"><article><h2>Primary: Liber Usualis, p. xxij</h2><img src="data:image/png;base64,${traditional.toString('base64')}" alt="Traditional connected quilisma examples"><p>The first example is the primary connected three-note silhouette. Wider interval SVGs extend its joins procedurally; the scan does not supply a matching specimen for every interval.</p><h2>Gregorio 6.0.0 / Greciliae</h2><img src="data:image/png;base64,${reference.toString('base64')}" alt="Actual Gregorio rendering"><p>Actual Gregorio output is a secondary comparison; its disconnected Scandicus is deliberately not copied. The independent two-note figure is an editor authoring allowance, not a historical usage claim.</p></article><article><h2>Editor — actual shared SVG geometry</h2>${captured.svg}</article></div>`;
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1820,
    height: 1100,
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
    new URL('editor-vs-references.png', import.meta.url),
    Buffer.from(data, 'base64'),
  );
  if (before) {
    const board = await send('Runtime.evaluate', {
      expression: `(()=>{
        const afterRoot=document.querySelector('svg.score');
        const wrapper=document.createElement('div');wrapper.innerHTML=${JSON.stringify(before.svg)};const beforeRoot=wrapper.firstElementChild;
        beforeRoot.style.cssText='position:absolute;left:-10000px;width:720px';
        document.body.append(beforeRoot);
        const tile=(root,id)=>{
          const group=root.querySelector('[data-neume-id="'+id+'"]');
          const b=group.querySelector('.score__ink').getBBox();
          const svg=root.cloneNode(false);
          svg.innerHTML=[...group.closest('[data-system-index]').querySelectorAll('.score__staff-line')].map(l=>l.outerHTML).join('')+group.outerHTML;
          svg.setAttribute('viewBox',[b.x-14,b.y-18,b.width+28,b.height+36].join(' '));
          svg.style.cssText='display:block;width:'+((b.width+28)*3)+'px;height:'+((b.height+36)*3)+'px;max-width:none';
          return svg.outerHTML;
        };
        const labels=['Virga','Neutral Inclinatum','Quilisma-pes adjacent','Quilisma-pes wide','Connected Scandicus (1,1)','Connected Scandicus (2,2)','Connected Scandicus (3,2)'];
        const cards=labels.map((label,j)=>'<article><h2>'+label+'</h2><div class="specimen"><div><p>Default</p>'+tile(beforeRoot,'n'+(j+1))+'</div><div><p>Authored</p>'+tile(afterRoot,'n'+(j+1))+'</div></div></article>').join('');
        document.body.innerHTML='<h1>Default and authored forms — actual captured editor SVG at 3× scale</h1><p>Original default contours are preserved. Compare connected adjacent/wider constructions with the separate reference board; wider intervals extend the traditional silhouette procedurally.</p><div class="comparative-grid">'+cards+'</div>';
        const style=document.createElement('style');style.textContent='.comparative-grid {display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.specimen {display:flex;justify-content:space-around;gap:4px}.comparative-grid h2{font-size:19px}';document.head.append(style);
        return document.documentElement.scrollHeight<=innerHeight;
      })()`,
      returnByValue: true,
    });
    assert.ok(!board.exceptionDetails, JSON.stringify(board.exceptionDetails));
    assert.equal(board.result.value, true, 'detail board must fit');
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(
      new URL('default-vs-authored.png', import.meta.url),
      Buffer.from(data, 'base64'),
    );
  }
} finally {
  ws.close();
  await fetch(endpoint + '/close/' + page.id);
}
