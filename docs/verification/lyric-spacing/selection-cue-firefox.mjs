import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const directory = await mkdtemp(join(tmpdir(), 'chant-firefox-selection-'));
console.log('Screenshots:', directory);
const ws = new WebSocket(
  process.env.CHANT_FIREFOX_URL ?? 'ws://127.0.0.1:9233/session',
);
await new Promise((r, j) => {
  ws.addEventListener('open', r);
  ws.addEventListener('error', j);
});
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.type === 'error') p?.reject(m);
    else p?.resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
await send('session.new', { capabilities: {} });
try {
  const { contexts } = await send('browsingContext.getTree');
  const context = contexts[0].context;
  const ev = async (expression) => {
    const r = await send('script.evaluate', {
      expression: `(async()=>JSON.stringify(await (${expression})))()`,
      target: { context },
      awaitPromise: true,
    });
    if (r.type === 'exception') throw Error(JSON.stringify(r));
    return JSON.parse(r.result.value);
  };
  await send('browsingContext.activate', { context });
  await send('browsingContext.setViewport', {
    context,
    viewport: { width: 1440, height: 1100 },
  });
  await send('browsingContext.navigate', {
    context,
    url:
      (process.env.CHANT_EDITOR_URL ?? 'http://127.0.0.1:5173') +
      '/docs/verification/placement/browser-fixture.html',
    wait: 'complete',
  });
  const pause = () => new Promise((r) => setTimeout(r, 200));
  for (let i = 0; i < 40; i++) {
    if (await ev("typeof mountChantFixture==='function'")) break;
    await pause();
  }
  const fixture = {
    title: 'Selected syllable clearance',
    divisions: [],
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    syllables: ['Al', 'lealsdkfjaasdfhasdf', 'lu', 'ia', 'bla'].map(
      (text, i) => ({
        id: `s${i}`,
        text,
        startsAtNeumeId: `n${i}`,
        boundaryBefore: i ? 'continuation' : 'word',
      }),
    ),
    neumes: Array.from({ length: 8 }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: 2 }],
    })),
  };
  await ev(`(mountChantFixture(${JSON.stringify(fixture)}),true)`);
  await pause();
  await pause();
  const pointer = async (actions) =>
    send('input.performActions', {
      context,
      actions: [
        {
          type: 'pointer',
          id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions,
        },
      ],
    });
  const click = async (selector) => {
    const p = await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`,
    );
    await pointer([
      { type: 'pointerMove', ...p, origin: 'viewport' },
      { type: 'pointerDown', button: 0 },
      { type: 'pointerUp', button: 0 },
    ]);
    await pause();
  };
  for (const [width, zoom] of [
    [1440, 1],
    [320, 1],
    [480, 1.5],
  ]) {
    await send('browsingContext.setViewport', {
      context,
      viewport: { width, height: 1100 },
    });
    await ev(`(document.documentElement.style.zoom='${zoom}',true)`);
    await pause();
    const before = await ev(
      `Array.from(document.querySelectorAll('.score__lyric')).map(t=>[t.getAttribute('x'),t.getAttribute('y')])`,
    );
    await click('.score__lyric[data-syllable-id="s1"]');
    await pointer([{ type: 'pointerMove', x: 10, y: 10, origin: 'viewport' }]);
    const observation = await ev(
      `(()=>{const t=document.querySelector('.score__lyric[data-syllable-id="s1"]'),g=t.parentElement,r=g.querySelector('.score__lyric-selection'),next=document.querySelector('.score__lyric[data-syllable-id="s2"]'),a=r?.getBoundingClientRect(),b=next.getBoundingClientRect();return {selected:t.getAttribute('aria-pressed'),focus:document.hasFocus(),outline:getComputedStyle(g).outlineStyle,highlight:!!r,svgHighlightGap:r?next.getBBox().x-r.getBBox().x-r.getBBox().width:null,inkGap:b.left-t.getBoundingClientRect().right,svgInkGap:next.getBBox().x-t.getBBox().x-t.getBBox().width,clearance:a?b.left-a.right:null,stroke:r?getComputedStyle(r).stroke:null,pointer:r?getComputedStyle(r).pointerEvents:null,order:r?g.firstElementChild===r:false,position:Array.from(document.querySelectorAll('.score__lyric')).map(t=>[t.getAttribute('x'),t.getAttribute('y')])}})()`,
    );
    console.log({ width, zoom, ...observation });
    assert.equal(observation.selected, 'true');
    assert.deepEqual(observation.position, before);
    if (!process.env.CHANT_BASELINE) {
      assert.equal(observation.outline, 'none');
      assert.equal(observation.highlight, true);
      assert(observation.svgHighlightGap >= -0.05);
      assert(observation.svgInkGap >= -0.05);
      assert.equal(observation.stroke, 'none');
      assert.equal(observation.pointer, 'none');
      assert.equal(observation.order, true);
    }
    await ev('(window.scrollTo(0,0),true)');
    await pause();
    const shot = await send('browsingContext.captureScreenshot', {
      context,
      origin: 'viewport',
      format: { type: 'image/png' },
    });
    await writeFile(
      join(
        directory,
        `selected-${process.env.CHANT_BASELINE ? 'before' : 'after'}-${width}-${zoom}.png`,
      ),
      Buffer.from(shot.data, 'base64'),
    );
    await click('[data-note-id="note0"]');
    assert.equal(
      await ev(`document.querySelectorAll('.score__lyric-selection').length`),
      0,
    );
    assert.deepEqual(
      await ev(
        `Array.from(document.querySelectorAll('.score__lyric')).map(t=>[t.getAttribute('x'),t.getAttribute('y')])`,
      ),
      before,
    );
    await pointer([{ type: 'pointerMove', x: 10, y: 10, origin: 'viewport' }]);
    await ev('(window.scrollTo(0,0),true)');
    await pause();
    const unselected = await send('browsingContext.captureScreenshot', {
      context,
      origin: 'viewport',
      format: { type: 'image/png' },
    });
    await writeFile(
      join(directory, `unselected-${width}-${zoom}.png`),
      Buffer.from(unselected.data, 'base64'),
    );
  }
  console.log(
    'PASS: Firefox native pointer selection, contained background cue, unchanged geometry, desktop/320px/150% CSS zoom; foreground focus is not claimed.',
  );
} finally {
  await send('session.end');
  ws.close();
}
