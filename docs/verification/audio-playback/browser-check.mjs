import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver for Audio 1 playback against the real production
// editor. It proves lifecycle and that a non-silent signal reaches the audio
// destination; it cannot prove what a listener hears.
const output = await mkdtemp(join(tmpdir(), 'chant-audio-playback-'));
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
const browser = firefox ? 'firefox' : 'chromium';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const raw = () => ev(`localStorage.getItem('${storageKey}')`);

async function ready() {
  for (let i = 0; i < 60; i++) {
    await pause();
    if (
      await ev(
        `!!document.querySelector('[role="group"][aria-label="Playback"]')`,
      )
    )
      return;
  }
  throw Error('Editor did not load');
}

// Records what the app schedules and taps the signal reaching the speakers.
// Installed after each navigation; the app creates its context lazily on Play.
const instrument = `(()=>{
  window.pageErrors = [];
  addEventListener('error', (e) => pageErrors.push(String(e.message)));
  addEventListener('unhandledrejection', (e) => pageErrors.push(String(e.reason)));
  const Real = window.AudioContext;
  const audio = (window.audioLog = { contexts: [], oscillators: [] });
  window.AudioContext = class extends Real {
    constructor(...args) {
      super(...args);
      this.tap = this.createAnalyser();
      audio.contexts.push(this);
    }
    createOscillator() {
      const o = super.createOscillator();
      const record = { stops: [], frequencies: [], times: [], ended: false };
      audio.oscillators.push(record);
      const start = o.start.bind(o), stop = o.stop.bind(o),
        set = o.frequency.setValueAtTime.bind(o.frequency);
      o.start = (t) => { record.start = t; return start(t); };
      o.stop = (t) => { record.stops.push(t); return stop(t); };
      o.frequency.setValueAtTime = (v, t) => { record.frequencies.push(v); record.times.push(t); return set(v, t); };
      o.addEventListener('ended', () => { record.ended = true; });
      return o;
    }
  };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    const result = connect.call(this, target, ...rest);
    if (target instanceof AudioDestinationNode && this.context.tap)
      connect.call(this, this.context.tap);
    return result;
  };
  window.outputPeak = () => {
    const tap = audio.contexts.at(-1)?.tap;
    if (!tap) return 0;
    const data = new Float32Array(tap.fftSize);
    tap.getFloatTimeDomainData(data);
    return data.reduce((peak, v) => Math.max(peak, Math.abs(v)), 0);
  };
})()`;

async function navigate() {
  await send('Page.navigate', { url });
  await ready();
  await ev(instrument);
}
const playback = () =>
  ev(
    `(()=>{const g=document.querySelector('[role="group"][aria-label="Playback"]');const t=g.querySelector('.editor-playback__toggle');const s=g.querySelector('[role="status"]');return {status:s.dataset.playbackStatus,text:s.textContent,action:t.dataset.playbackAction,disabled:t.getAttribute('aria-disabled')}})()`,
  );
const log = () =>
  ev(
    `({contexts:audioLog.contexts.map(c=>c.state),oscillators:audioLog.oscillators,errors:pageErrors})`,
  );
// A real pointer click, so the browser grants user activation.
async function click(label) {
  const point = await ev(
    `(()=>{const b=[...document.querySelectorAll('[aria-label="Playback"] button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
}
async function waitFor(predicate, what, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate(await playback())) return;
    await sleep(25);
  }
  throw Error(
    `Timed out waiting for ${what}: ${JSON.stringify(await playback())}`,
  );
}
/** Highest output sample seen over a window of analyser reads. */
async function peakOver(ms) {
  let peak = 0;
  for (const end = Date.now() + ms; Date.now() < end; await sleep(20))
    peak = Math.max(peak, await ev('outputPeak()'));
  return peak;
}
async function loadExample(pattern) {
  await ev(
    `window.confirm=()=>true;(()=>{const e=document.querySelector('[aria-label="Load example"]');const o=[...e.options].find(o=>${pattern}.test(o.textContent));if(!o)throw Error('Missing example');e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await sleep(300);
  return JSON.parse(await raw()).document;
}
const noteCount = (document) =>
  document.neumes.reduce((n, neume) => n + neume.notes.length, 0);
async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    join(output, `${name}-${browser}.png`),
    Buffer.from(data, 'base64'),
  );
}
const results = {};

try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate();
  await ev(`localStorage.clear()`);
  await navigate();

  // Kyrie: play, refuse an overlapping Play, stop promptly, restart.
  const kyrie = await loadExample('/Kyrie/');
  assert.deepEqual(await playback(), {
    status: 'idle',
    text: '',
    action: 'play',
    disabled: 'false',
  });
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'Kyrie playing');
  let audio = await log();
  assert.deepEqual(audio.contexts, ['running']);
  assert.equal(audio.oscillators.length, 1);
  assert.equal(audio.oscillators[0].frequencies.length, noteCount(kyrie));
  assert.ok(audio.oscillators[0].frequencies.every(Number.isFinite));
  results.kyriePeak = await peakOver(600);
  assert.ok(results.kyriePeak > 0.02, `Kyrie is audible: ${results.kyriePeak}`);
  // While playing the toggle is Stop, and Play from beginning is inert.
  assert.equal((await playback()).action, 'stop');
  await click('Playback options, speed 1×');
  await click('Play from beginning');
  await sleep(100);
  assert.equal((await log()).oscillators.length, 1, 'no overlapping session');
  assert.equal((await playback()).status, 'playing');
  await ev(
    `document.querySelector('.editor-playback__options-button').click()`,
  );
  await screenshot('playing-1440');

  const stopAt = Date.now();
  await click('Stop');
  await waitFor((p) => p.status === 'idle', 'stop');
  results.stopStateMs = Date.now() - stopAt;
  await sleep(150);
  audio = await log();
  assert.equal(audio.oscillators[0].ended, true, 'stopped oscillator ended');
  results.peakAfterStop = await peakOver(200);
  assert.equal(results.peakAfterStop, 0, 'silent after Stop');

  await click('Play');
  await waitFor((p) => p.status === 'playing', 'restart');
  audio = await log();
  assert.equal(audio.contexts.length, 1, 'one reused context');
  assert.equal(audio.oscillators.filter((o) => !o.ended).length, 1);

  // An edit during playback (initial clef) stops it; Undo restores the score.
  await ev(
    `(()=>{const s=document.querySelector('[aria-label="Initial clef type"]');s.value=s.value==='c'?'f':'c';s.dispatchEvent(new Event('change',{bubbles:true}))})()`,
  );
  await waitFor((p) => p.status === 'idle', 'stop on edit');
  await sleep(150);
  assert.equal(
    (await log()).oscillators.every((o) => o.ended),
    true,
  );
  assert.equal(await peakOver(150), 0, 'silent after edit');
  await ev(`document.querySelector('[aria-label="Undo last edit"]').click()`);

  // Replacing the document during playback stops it; Dies Irae then plays.
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'replay');
  const dies = await loadExample('/Dies Ir/');
  await waitFor((p) => p.status === 'idle', 'stop on replacement');
  await sleep(150);
  assert.equal(
    (await log()).oscillators.every((o) => o.ended),
    true,
  );
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'Dies Irae playing');
  audio = await log();
  const diesOscillator = audio.oscillators.at(-1);
  assert.equal(diesOscillator.frequencies.length, noteCount(dies));
  // Each gap is the previous note (1 base note, or 2 with a mora) plus at
  // most one division pause (0.5, 1, 2 or 3); Dies Irae has divisions, so
  // some gaps include pauses.
  const gaps = diesOscillator.times
    .slice(1)
    .map((t, i) => +((t - diesOscillator.times[i]) / 0.4).toFixed(6));
  assert.ok(
    gaps.every((g) => [1, 1.5, 2, 2.5, 3, 4, 5].includes(g)),
    `note gaps ${[...new Set(gaps)]}`,
  );
  results.diesGaps = Object.fromEntries(
    [...new Set(gaps)]
      .sort()
      .map((g) => [g, gaps.filter((x) => x === g).length]),
  );
  results.diesPauseGaps = gaps.filter((g) => g !== 1 && g !== 2).length;
  assert.ok(results.diesPauseGaps > 0, 'Dies Irae pauses at divisions');
  results.diesPeak = await peakOver(600);
  assert.ok(
    results.diesPeak > 0.02,
    `Dies Irae is audible: ${results.diesPeak}`,
  );
  // Play/Stop live in the sticky toolbar's Quilisma figure row. Scrolled to
  // the end of the score during playback, Stop must stay visible, topmost and
  // clickable: inside the toolbar while it sticks, or pinned to the viewport
  // when the toolbar's own safeguards make it static (too tall for the
  // viewport). Playback never changes the toolbar's height.
  const pinState = () =>
    ev(
      `(()=>{const bar=document.querySelector('.editor-sticky-toolbar');const t=bar.getBoundingClientRect();const g=document.querySelector('[role="group"][aria-label="Playback"]');const stop=g.querySelector('.editor-playback__toggle');const r=stop.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {sticky:bar.dataset.tooTall!=='true'&&getComputedStyle(bar).position==='sticky',inToolbar:bar.contains(g),pinned:g.classList.contains('editor-playback--pinned'),stopInsideToolbar:r.top>=t.top&&r.bottom<=t.bottom,stopVisible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,stopTopmost:!!hit&&stop.contains(hit),toolbar:Math.round(t.height),noHorizontalScroll:document.documentElement.scrollWidth<=innerWidth}})()`,
    );
  for (const [width, height] of [
    [1440, 1000],
    [390, 1100],
    [320, 900],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    // Let the toolbar's too-tall safeguard settle before scrolling.
    await sleep(300);
    await ev(
      `document.querySelector('.editor-playback-slot').scrollIntoView({block:'center'})`,
    );
    await sleep(200);
    const top = await pinState();
    assert.equal(top.inToolbar, true, `${width}: controls in the toolbar`);
    assert.equal(top.pinned, false, `${width}: in place while visible`);
    await ev('scrollTo(0,document.documentElement.scrollHeight)');
    await sleep(300);
    const end = await pinState();
    assert.equal(end.stopVisible, true, `${width}: Stop visible`);
    assert.equal(end.stopTopmost, true, `${width}: Stop topmost`);
    assert.equal(end.noHorizontalScroll, true, `${width}: no h-scroll`);
    assert.equal(end.toolbar, top.toolbar, `${width}: toolbar height`);
    if (top.sticky) {
      assert.equal(end.pinned, false, `${width}: sticky, not pinned`);
      assert.equal(end.stopInsideToolbar, true, `${width}: in sticky toolbar`);
    } else assert.equal(end.pinned, true, `${width}: static toolbar, pinned`);
    results[`toolbar${width}`] = { height: top.toolbar, sticky: top.sticky };
    await screenshot(`playing-end-${width}`);
  }
  await click('Stop');
  await waitFor((p) => p.status === 'idle', 'Dies Irae stop');
  await sleep(150);
  assert.equal((await pinState()).pinned, false, 'unpinned after Stop');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // A one-note chant sounds once and ends by itself.
  const envelope = JSON.parse(await raw());
  envelope.document = {
    ...envelope.document,
    title: 'One note',
    neumes: [
      {
        id: 'only',
        kind: 'punctum',
        notes: [{ id: 'only-note', staffPosition: 4 }],
      },
    ],
    syllables: [],
    divisions: [],
    clefChanges: [],
    accidentals: [],
  };
  await ev(
    `localStorage.setItem('${storageKey}', ${JSON.stringify(JSON.stringify(envelope))})`,
  );
  await navigate();
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'one note playing');
  await waitFor((p) => p.status === 'idle', 'one note natural end');
  audio = await log();
  assert.equal(audio.oscillators.length, 1);
  assert.equal(audio.oscillators[0].frequencies.length, 1);
  assert.equal(audio.oscillators[0].ended, true);

  // A mora doubles only its own note: plain, mora, plain is scheduled as
  // 0.4 s, 0.8 s, 0.4 s (Kyrie XI and Pater Noster contain morae; Dies Irae
  // has none, so this seeded score proves it in the browser).
  envelope.document = {
    ...envelope.document,
    title: 'Mora',
    neumes: ['a', 'b', 'c'].map((id, i) => ({
      id,
      kind: 'punctum',
      notes: [
        {
          id: `${id}-note`,
          staffPosition: 4 + i,
          ...(id === 'b' ? { mora: 1 } : {}),
        },
      ],
    })),
  };
  await ev(
    `localStorage.setItem('${storageKey}', ${JSON.stringify(JSON.stringify(envelope))})`,
  );
  await navigate();
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'mora score playing');
  audio = await log();
  const moraOscillator = audio.oscillators[0];
  assert.deepEqual(
    moraOscillator.times
      .slice(1)
      .map((t, i) => +(t - moraOscillator.times[i]).toFixed(6)),
    [0.4, 0.8],
    'mora note lasts two base notes',
  );
  assert.equal(
    +(moraOscillator.stops[0] - moraOscillator.start).toFixed(6),
    1.6,
    'total length includes the doubled note',
  );
  await click('Stop');
  await waitFor((p) => p.status === 'idle', 'mora score stop');

  // An empty score cannot start playback.
  await ev(`window.confirm=()=>true`);
  await ev(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New').click()`,
  );
  await waitFor((p) => p.text === 'No notes to play.', 'empty score');
  assert.equal((await playback()).disabled, 'true');
  await click('Play');
  await sleep(100);
  assert.equal((await log()).oscillators.length, 1, 'empty score is silent');

  // Unavailable Web Audio is reported without an exception.
  // (A fresh page, since a created context is reused.)
  await loadExample('/Kyrie/');
  await navigate();
  await ev(`window.AudioContext = undefined`);
  await click('Play');
  await waitFor((p) => p.status === 'failed', 'unavailable audio');
  assert.match((await playback()).text, /not available/);
  assert.deepEqual((await log()).errors, []);

  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox' : 'Chromium',
      result: 'PASS',
      ...results,
      output,
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
