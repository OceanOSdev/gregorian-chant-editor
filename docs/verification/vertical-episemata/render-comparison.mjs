import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Supply rendered-score.json emitted by the real-editor browser driver. This
// composes actual SVG and actual Gregorio output; it invents no notation.
const captured = JSON.parse(await readFile(process.argv[2], 'utf8'));
const baseline = JSON.parse(await readFile(process.argv[3], 'utf8'));
const reference = await readFile(
  new URL('gregorio-reference.png', import.meta.url),
);
const solesmes = await readFile(
  new URL('pater-solesmes-excerpt.png', import.meta.url),
);
const ownerBefore = process.argv[4]
  ? JSON.parse(await readFile(process.argv[4], 'utf8'))
  : null;
const ownerAfter = process.argv[5]
  ? JSON.parse(await readFile(process.argv[5], 'utf8'))
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
  body {margin:0;padding:24px;background:white;color:#111;font-family:serif;max-width:none}
  h1{font-size:26px;margin:0 0 10px}h2{font-size:21px;margin:12px 0}p{font-size:16px;margin:8px 0}
  .comparison{display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px}article{min-width:0;border:1px solid #bbb;padding:12px}
  article img,article svg.score{display:block;width:100%;height:auto;max-width:none}
  </style><h1>Vertical episemata — actual Gregorio, printed Solesmes and editor ink</h1>
  <p>Same named pitches and affected constituents; GABC h/i = editor staff positions 4/5. Test lyrics identify specimens. Different grouping, justification and automatic wraps are expected.</p>
  <div class="comparison"><article><h2>Gregorio 6.0.0 / Greciliae — compiled probes</h2><img src="data:image/png;base64,${reference.toString('base64')}">
  <h2>Printed Solesmes: Gregorian Missal (1990), p. 41</h2><img src="data:image/png;base64,${solesmes.toString('base64')}"><p>First Pater Noster staff: a short tick under “ster”, with a horizontal episema above. Source scan is enlarged 3×; no contour is invented.</p></article>
  <article><h2>Editor — signed, actual captured shared SVG</h2>${captured.svg}</article><article><h2>Editor — unmarked baseline, identical forms and pitches</h2>${baseline.svg}</article></div>`;
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1820,
    height: 1000,
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
  const detail = await send('Runtime.evaluate', {
    expression: `(()=>{
      const roots=[...document.querySelectorAll('svg.score')];
      const labels=['Line','Space','Both','All','Virga','Incl','PodLo','PodHi','ScanAll','QuiltAll','TorAll','Porr'];
      const indexes=[0,1,2,3,5,6,7,8,13,15,17,19];
      const tile=(root,index,peer)=>{
        const peerGroup=peer.querySelector('[data-neume-id="n'+index+'"]');
        const peerBounds=peerGroup.querySelector('.score__ink').getBBox();
        const peerBottom=Math.max(...[...peerGroup.closest('[data-system-index]').querySelectorAll('.score__staff-line')].map(l=>Number(l.getAttribute('y1'))));
        const group=root.querySelector('[data-neume-id="n'+index+'"]');
        const b=group.querySelector('.score__ink').getBBox();
        const svg=root.cloneNode(false);
        svg.innerHTML=[...group.closest('[data-system-index]').querySelectorAll('.score__staff-line')].map(l=>l.outerHTML).join('')+group.outerHTML;
        const bottom=Math.max(...[...group.closest('[data-system-index]').querySelectorAll('.score__staff-line')].map(l=>Number(l.getAttribute('y1'))));
        const top=Math.min(b.y-bottom,peerBounds.y-peerBottom);
        const low=Math.max(b.y+b.height-bottom,peerBounds.y+peerBounds.height-peerBottom);
        const width=Math.max(b.width,peerBounds.width)+20,height=low-top+24;
        svg.setAttribute('viewBox',[b.x-10,bottom+top-12,width,height].join(' '));
        svg.style.cssText='display:block;width:'+(width*2.5)+'px;height:'+(height*2.5)+'px;max-width:none';
        return svg.outerHTML;
      };
      const cards=indexes.map((index,i)=>'<article><h2>'+labels[i]+'</h2><div class="pair"><div><p>Signed</p>'+tile(roots[0],index,roots[1])+'</div><div><p>Baseline</p>'+tile(roots[1],index,roots[0])+'</div></div></article>').join('');
      document.body.innerHTML='<h1>Vertical episemata — captured SVG detail at 2.5×</h1><p>Same head paths and pitches; only authored vertical ticks differ. Compare the independently compiled Gregorio and printed Solesmes on the reference board.</p><div class="detail">'+cards+'</div>';
      const style=document.createElement('style');style.textContent='.detail{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.pair{display:flex;justify-content:space-around;gap:6px}';document.head.append(style);
      return document.documentElement.scrollHeight<=innerHeight;
    })()`,
    returnByValue: true,
  });
  assert.ok(!detail.exceptionDetails, JSON.stringify(detail.exceptionDetails));
  assert.equal(detail.result.value, true, 'detail board must fit');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    new URL('signed-vs-baseline.png', import.meta.url),
    Buffer.from(screenshot.data, 'base64'),
  );
  if (ownerBefore && ownerAfter) {
    const result = await send('Runtime.evaluate', {
      expression: `(()=>{
        const fragment=document.createElement('div');fragment.innerHTML=${JSON.stringify(ownerBefore?.svg ?? '')}+${JSON.stringify(ownerAfter?.svg ?? '')};
        document.body.append(fragment);
        const roots=[...fragment.querySelectorAll('svg.score')];
        const strip=root=>{
          const group=root.querySelector('[data-system-index="0"]');
          const svg=root.cloneNode(false);svg.innerHTML=group.outerHTML;
          svg.setAttribute('viewBox','0 0 720 220');svg.style.cssText='display:block;width:100%;height:auto;max-width:none';return svg.outerHTML;
        };
        const before=strip(roots[0]),after=strip(roots[1]);
        document.body.innerHTML='<h1>Pater Noster — one authored tick on “ster”</h1><p>Owner v3 source is unchanged. The v4 derivative adds only verticalEpisema: true to the first already horizontally marked note. First editor system shown at identical scale before and after.</p><h2>Printed Solesmes: Gregorian Missal (1990), p. 41</h2><img style="width:100%;max-width:1170px" src="data:image/png;base64,${solesmes.toString('base64')}"><div class="comparison" style="grid-template-columns:1fr 1fr"><article><h2>Before — owner v3</h2>'+before+'</article><article><h2>After — v4 derivative</h2>'+after+'</article></div>';
        return document.documentElement.scrollHeight<=innerHeight;
      })()`,
      returnByValue: true,
    });
    assert.ok(
      !result.exceptionDetails,
      JSON.stringify(result.exceptionDetails),
    );
    assert.equal(result.result.value, true, 'Pater comparison must fit');
    const capture = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(
      new URL('pater-comparison.png', import.meta.url),
      Buffer.from(capture.data, 'base64'),
    );
  }
} finally {
  ws.close();
  await fetch(endpoint + '/close/' + page.id);
}
