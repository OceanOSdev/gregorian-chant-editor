import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-tick-weight-'));
const firefox = Boolean(process.env.CHANT_FIREFOX_URL);
const pages = firefox
  ? []
  : await (
      await fetch(
        process.env.CHANT_CHROMIUM_URL ?? 'http://127.0.0.1:9246/json',
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
  'http://127.0.0.1:4180/gregorian-chant-editor/';
const label = process.argv[2] ?? 'probe';
const storageKey = 'gregorian-chant-editor:active-document:v1';
async function navigate() {
  await send('Page.navigate', { url });
  for (let i = 0; i < 60; i++) {
    await pause();
    if (await ev(`!!document.querySelector('svg.score')`)) return;
  }
  throw Error('Editor failed to load');
}
const fixture = {
  format: 'gregorian-chant-editor',
  version: 4,
  document: {
    title: 'Vertical episema raster study',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    syllables: [],
    divisions: [],
    clefChanges: [],
    neumes: Array.from({ length: 24 }, (_, i) => ({
      id: 'weight-' + i,
      kind: 'punctum',
      notes: [
        {
          id: 'weight-note-' + i,
          staffPosition: i < 12 ? 2 : 3,
          verticalEpisema: true,
        },
      ],
    })),
  },
};
const results = [];
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  await navigate();
  await ev(
    `localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(fixture))})`,
  );
  await navigate();
  for (const config of [
    { name: 'desktop', width: 1440 },
    { name: 'medium', width: 1024 },
    { name: 'narrow', width: 320 },
    { name: 'svg-1x', width: 1440, svgWidth: 720 },
    { name: 'svg-2x', width: 1440, svgWidth: 1440 },
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: config.width,
      height: 1400,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await ev(
      `(()=>{const svg=document.querySelector('svg.score');svg.style.width=${JSON.stringify(config.svgWidth ? config.svgWidth + 'px' : '100%')};svg.style.maxWidth='none';document.querySelector('.score-viewport').scrollLeft=0;document.querySelector('.score-workspace').scrollIntoView({block:'start'})})()`,
    );
    await pause();
    await pause();
    const samples = await ev(`(()=>{
   const svg=document.querySelector('svg.score'),scroller=document.querySelector('.score-viewport').getBoundingClientRect();
   return [...svg.querySelectorAll('.score__ink > rect')].filter(r=>r.getAttribute('width')==='1.5'&&r.getAttribute('height')==='7').map(tick=>{
    const b=tick.getBoundingClientRect(),g=tick.closest('[data-neume-id]'),ink=g.querySelector('.score__ink'),head=ink.querySelector('path').getBoundingClientRect(),s=getComputedStyle(tick),m=tick.getScreenCTM(),v=visualViewport;
    let overlaps=0;
    const bb=tick.getBBox();for(let x=bb.x+.2;x<bb.x+bb.width;x+=.4)for(let y=bb.y+.2;y<bb.y+bb.height;y+=.4){const p=new DOMPoint(x,y);if(ink.querySelector('path').isPointInFill(p))overlaps++;}
    const lines=[...g.closest('[data-system-index]').querySelectorAll('.score__staff-line')];
    const staffGap=Math.min(...lines.map(l=>{const y=new DOMPoint(Number(l.getAttribute('x1')),Number(l.getAttribute('y1'))).matrixTransform(l.getScreenCTM()).y;const half=Number.parseFloat(getComputedStyle(l).strokeWidth)/2;return b.top>=y?b.top-y-half:y-b.bottom-half}));
    const staffOverlap=lines.some(l=>{const y=Number(l.getAttribute('y1'));return bb.y<y+.75&&bb.y+bb.height>y-.75});
    return {id:g.dataset.neumeId,kind:Number(g.dataset.neumeId.split('-')[1])<12?'line':'space',x:b.x,y:b.y,width:b.width,height:b.height,geometryWidth:Number(tick.getAttribute('width')),geometryHeight:Number(tick.getAttribute('height')),scale:m.a,fill:s.fill,stroke:s.stroke,opacity:s.opacity,shapeRendering:s.shapeRendering,overlaps,staffOverlap,staffGap,head:{x:head.x,y:head.y,width:head.width,height:head.height},visible:b.x>=scroller.left+2&&b.x+b.width<=Math.min(scroller.right,innerWidth)-2&&b.y>=2&&b.bottom<innerHeight-2};
   }).filter(s=>s.visible);
  })()`);
    assert.ok(samples.length >= 8);
    for (const s of samples) {
      assert.equal(s.geometryWidth, 1.5);
      assert.equal(s.geometryHeight, 7);
      assert.equal(s.stroke, 'none');
      assert.equal(s.opacity, '1');
      assert.equal(s.overlaps, 0);
      assert.equal(s.staffOverlap, false);
      assert.ok(Math.abs(s.width - 1.5 * s.scale) < 0.04, JSON.stringify(s));
    }
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const screenshot = join(output, label + '-' + config.name + '.png');
    await writeFile(screenshot, Buffer.from(data, 'base64'));
    const pixels = execFileSync('identify', ['-format', '%w %h', screenshot], {
      encoding: 'utf8',
    })
      .trim()
      .split(' ')
      .map(Number);
    const ratio = pixels[0] / config.width;
    for (const sample of samples) {
      const x = Math.floor(sample.x * ratio) - 2,
        y = Math.floor((sample.y + sample.height / 2) * ratio),
        width = Math.ceil(sample.width * ratio) + 5;
      const row = execFileSync('convert', [
        screenshot,
        '-crop',
        `${width}x1+${x}+${y}`,
        '+repage',
        '-depth',
        '8',
        'rgba:-',
      ]);
      const coverage = Array.from({ length: width }, (_, i) =>
        Math.max(0, Math.min(1, (255 - row[i * 4]) / (255 - 32))),
      );
      sample.pixelPhase = (sample.x * ratio) % 1;
      sample.peakCoverage = Math.max(...coverage);
      sample.integratedWidth = coverage.reduce((a, b) => a + b, 0);
      sample.expectedWidth = sample.width * ratio;
      sample.coverage = coverage;
      const cx = Math.max(0, Math.floor((sample.head.x - 3) * ratio)),
        cy = Math.max(0, Math.floor((sample.head.y - 3) * ratio));
      const cw = Math.ceil((sample.head.width + 6) * ratio),
        ch = Math.ceil((sample.y + sample.height + 4) * ratio) - cy;
      const crop = join(output, `${label}-${config.name}-${sample.id}.png`);
      execFileSync('convert', [
        screenshot,
        '-crop',
        `${cw}x${ch}+${cx}+${cy}`,
        '+repage',
        crop,
      ]);
      sample.crop = crop;
    }
    const stats = (field) => ({
      min: Math.min(...samples.map((s) => s[field])),
      max: Math.max(...samples.map((s) => s[field])),
    });
    results.push({
      config,
      screenshot,
      pixels,
      ratio,
      samples,
      peak: stats('peakCoverage'),
      integrated: stats('integratedWidth'),
      staffGap: stats('staffGap'),
      expected: stats('expectedWidth'),
    });
  }
  const report = { label, browser: firefox ? 'Firefox' : 'Chromium', results };
  await writeFile(
    join(output, 'weight-results.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      output,
      browser: report.browser,
      summary: results.map((r) => ({
        name: r.config.name,
        scale: r.samples[0].scale,
        peak: r.peak,
        integrated: r.integrated,
        expected: r.expected,
        staffGap: r.staffGap,
      })),
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
