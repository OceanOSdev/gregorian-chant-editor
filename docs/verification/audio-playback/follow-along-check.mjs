import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver for Audio 2 (start from selection, follow-along
// cue and scrolling, speed) against the real production editor. Timing is
// checked against the oscillator's scheduled audio-clock times; it cannot
// prove what a listener hears or sees in sync.
const output = await mkdtemp(join(tmpdir(), 'chant-audio-follow-'));
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

// Real key presses (CDP key events / BiDi key actions), as in sibling drivers.
async function key(key, code = key, shift = false) {
  if (firefox) {
    const value =
      {
        Enter: '\uE007',
        Delete: '\uE017',
        Tab: '\uE004',
        Escape: '\uE00C',
        ArrowUp: '\uE013',
        ArrowDown: '\uE015',
        ArrowRight: '\uE014',
        Home: '\uE011',
        End: '\uE010',
        ' ': '\uE00D',
      }[key] ?? key;
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            ...(shift ? [{ type: 'keyDown', value: '\uE008' }] : []),
            { type: 'keyDown', value },
            { type: 'keyUp', value },
            ...(shift ? [{ type: 'keyUp', value: '\uE008' }] : []),
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
        modifiers: shift ? 8 : 0,
        ...(type === 'keyDown' && (key === 'Enter' || key === ' ')
          ? { text: key === 'Enter' ? '\r' : ' ' }
          : {}),
        windowsVirtualKeyCode: {
          Tab: 9,
          Escape: 27,
          Enter: 13,
          ArrowUp: 38,
          ArrowDown: 40,
          ArrowRight: 39,
          Home: 36,
          End: 35,
          Delete: 46,
          ' ': 32,
        }[key],
      });
  await pause();
}
const base = 0.4;
/** Audio-clock time and the note the cue shows, sampled together. */
const cueSample = () =>
  ev(
    `({t:audioLog.contexts.at(-1)?.currentTime ?? null,cue:[...document.querySelectorAll('.score__note-sounding')].map(e=>e.closest('[data-note-id]').dataset.noteId)})`,
  );
const latestOscillator = async () => (await log()).oscillators.at(-1);
const noteState = (id) =>
  ev(
    `(()=>{const g=document.querySelector('.score__note[data-note-id="${id}"]');return {pressed:g.getAttribute('aria-pressed'),selectionCue:!!g.querySelector('.score__note-selection'),soundingCue:!!g.querySelector('.score__note-sounding')}})()`,
  );
const activeIsToggle = () =>
  ev(
    `document.activeElement===document.querySelector('.editor-playback__toggle')`,
  );
/** Real pointer click at a note's centre, which must be the topmost target. */
async function clickNote(id) {
  const point = await ev(
    `(()=>{const g=document.querySelector('.score__note[data-note-id="${id}"]');const r=g.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);if(!hit||!g.contains(hit))throw Error('note not topmost');return {x,y}})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
}
/** Selection change without a positional click (the note's contextual
 * panel may cover neighbouring notes). */
async function selectNote(id) {
  await ev(
    `document.querySelector('.score__note[data-note-id="${id}"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
  );
  await pause();
  assert.equal((await noteState(id)).pressed, 'true');
}
async function chooseSpeed(label) {
  await click(
    `Playback options, speed ${await ev(`document.querySelector('.editor-playback__speed').textContent`)}`,
  );
  const point = await ev(
    `(()=>{const l=[...document.querySelectorAll('.editor-playback__panel label')].find(l=>l.textContent.trim()===${JSON.stringify(label)});const r=l.getBoundingClientRect();return {x:r.x+8,y:r.y+r.height/2}})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
  // Escape closes the options without touching the editor selection.
  await ev(
    `document.querySelector('.editor-playback__options-button').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
  );
  await pause();
  assert.equal(
    await ev(`document.querySelector('.editor-playback__speed').textContent`),
    label,
  );
}
async function seed(document) {
  const envelope = JSON.parse(await raw());
  envelope.document = { ...envelope.document, ...document };
  await ev(
    `localStorage.setItem('${storageKey}', ${JSON.stringify(JSON.stringify(envelope))})`,
  );
  await navigate();
}
const gapsOf = (o) =>
  o.times.slice(1).map((t, i) => +((t - o.times[i]) / base).toFixed(4));

/**
 * Checks the cue against the scheduled audio clock for `ms`: at every sample
 * it shows the note whose event contains the audio time (allowing one frame
 * of presentation lag), and nothing in a gap. Returns how many samples fell
 * in a gap.
 */
async function checkCue(ids, lengths, ms, scale = 1) {
  const o = await latestOscillator();
  const expected = (t) => {
    for (const [i, start] of o.times.entries())
      if (t >= start && t < start + lengths[i] * base * scale) return ids[i];
    return null;
  };
  let silences = 0;
  let samples = 0;
  for (const end = Date.now() + ms; Date.now() < end; await sleep(30)) {
    const { t, cue } = await cueSample();
    if (t === null) continue;
    assert.ok(cue.length <= 1, 'at most one sounding note');
    const shown = cue[0] ?? null;
    const now = expected(t);
    const lagged = expected(t - 0.05);
    assert.ok(
      shown === now || shown === lagged,
      `cue ${shown} at ${t.toFixed(3)}: expected ${now} (or ${lagged})`,
    );
    if (now === null && lagged === null && shown === null) silences++;
    samples++;
  }
  return { samples, silences };
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
  await loadExample('/Kyrie/');

  // a | pes(p0, p1) ‖minor‖ mora m | b ‖finalis‖ c, in one system.
  const ids = ['a-n', 'p0', 'p1', 'm-n', 'b-n', 'c-n'];
  const lengths = [1, 1, 1, 2, 1, 1];
  const punctum = (id, position, mora) => ({
    id,
    kind: 'punctum',
    notes: [
      { id: `${id}-n`, staffPosition: position, ...(mora ? { mora: 1 } : {}) },
    ],
  });
  await seed({
    title: 'Follow',
    clef: { type: 'c', staffLine: 4 },
    neumes: [
      punctum('a', 2),
      {
        id: 'pes',
        kind: 'podatus',
        notes: [
          { id: 'p0', staffPosition: 2 },
          { id: 'p1', staffPosition: 4 },
        ],
      },
      punctum('m', 3, true),
      punctum('b', 2),
      punctum('c', 1),
    ],
    divisions: [
      { id: 'half', kind: 'minor', beforeNeumeId: 'm' },
      { id: 'end', kind: 'finalis', beforeNeumeId: 'c' },
    ],
    syllables: [],
    clefChanges: [],
    accidentals: [],
  });

  // Whole score, no selection: the reference schedule.
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'reference playing');
  const whole = await latestOscillator();
  assert.deepEqual(gapsOf(whole), [1, 1, 2, 2, 4], 'mora and pauses');
  await click('Stop');
  await waitFor((p) => p.status === 'idle', 'reference stop');
  assert.equal(
    await ev(`document.querySelectorAll('.score__note-sounding').length`),
    0,
  );

  // A selected middle note of the Podatus starts playback on itself.
  await clickNote('p1');
  assert.equal((await noteState('p1')).pressed, 'true');
  assert.equal((await playback()).text, 'Plays from the selection');
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'from selection');
  const fromSelection = await latestOscillator();
  assert.deepEqual(fromSelection.frequencies, whole.frequencies.slice(2));
  assert.deepEqual(gapsOf(fromSelection), [2, 2, 4], 'no inherited pause');
  assert.equal(await activeIsToggle(), true, 'focus stays on the toggle');
  // Selection and cue coexist on the selected, sounding note.
  await sleep(150);
  const both = await noteState('p1');
  assert.deepEqual(both, {
    pressed: 'true',
    selectionCue: true,
    soundingCue: true,
  });
  assert.equal(
    await ev(
      `(()=>{const c=document.querySelector('.score__note-sounding');const r=c.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return getComputedStyle(c.closest('g[aria-hidden]')).pointerEvents==='none'&&!hit.closest('.score__note-sounding')&&!c.closest('g[aria-hidden="true"]').getAttribute('role')})()`,
    ),
    true,
    'cue takes no pointer hits and has no role',
  );
  const sync = await checkCue(ids.slice(2), lengths.slice(2), 3200);
  results.cueSamples = sync.samples;
  results.cueSilences = sync.silences;
  assert.ok(sync.silences > 0, 'no cue during the finalis pause');
  await waitFor((p) => p.status === 'idle', 'natural end', 4000);
  await sleep(100);
  assert.equal(
    await ev(`document.querySelectorAll('.score__note-sounding').length`),
    0,
    'cleared at the end',
  );
  assert.equal((await noteState('p1')).pressed, 'true', 'selection kept');

  // Play from beginning while the selection stays.
  await click('Playback options, speed 1×');
  await click('Play from beginning');
  await waitFor((p) => p.status === 'playing', 'from beginning');
  assert.deepEqual((await latestOscillator()).frequencies, whole.frequencies);
  assert.equal((await noteState('p1')).pressed, 'true');
  // A selection change during playback does not move the audio.
  await selectNote('b-n');
  await sleep(100);
  assert.equal((await log()).oscillators.length, 3, 'no restart on selection');
  await click('Stop');
  await waitFor((p) => p.status === 'idle', 'stop from beginning');
  assert.equal(
    await ev(`document.querySelectorAll('.score__note-sounding').length`),
    0,
    'cleared on Stop',
  );

  // 0.5×: every gap doubles; the speed is locked while playing.
  await selectNote('a-n');
  await chooseSpeed('0.5×');
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'half speed');
  const slow = await latestOscillator();
  assert.deepEqual(gapsOf(slow), [2, 2, 4, 4, 8], 'half speed');
  await click('Playback options, speed 0.5×');
  assert.equal(
    await ev(
      `document.querySelector('.editor-playback__panel fieldset').disabled`,
    ),
    true,
  );
  await ev(
    `document.querySelector('.editor-playback__options-button').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
  );
  const slowSync = await checkCue(ids, lengths, 1500, 2);
  results.slowCueSamples = slowSync.samples;
  // An edit during playback stops it and clears the cue.
  await ev(
    `(()=>{const s=document.querySelector('[aria-label="Initial clef type"]');s.value=s.value==='c'?'f':'c';s.dispatchEvent(new Event('change',{bubbles:true}))})()`,
  );
  await waitFor((p) => p.status === 'idle', 'stop on edit');
  await sleep(100);
  assert.equal(
    await ev(`document.querySelectorAll('.score__note-sounding').length`),
    0,
    'cleared on edit',
  );
  await ev(`document.querySelector('[aria-label="Undo last edit"]').click()`);
  await chooseSpeed('1×');

  // Follow-along across systems: two long examples, desktop and 320px, and
  // 150% CSS zoom; then a score that scrolls sideways.
  async function followAcrossSystems(example, width, height, zoom = '') {
    const label = `${example} ${width}${zoom ? ` zoom ${zoom}` : ''}`;
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await loadExample(`/${example}/`);
    await ev(
      `document.querySelector('main').style.zoom=${JSON.stringify(zoom)}`,
    );
    await sleep(400);
    // Last note of the third system, placed just above the viewport bottom.
    const start = await ev(
      `(()=>{const notes=[...document.querySelectorAll('g[data-system-index="2"] .score__note')];const g=notes.at(-1);const r=g.getBoundingClientRect();scrollBy(0,r.bottom-(innerHeight-40));return g.dataset.noteId})()`,
    );
    await sleep(200);
    await ev(`document.activeElement.blur()`);
    await clickNote(start);
    const toolbarHeight = await ev(
      `document.querySelector('.editor-sticky-toolbar').getBoundingClientRect().height`,
    );
    await click('Play');
    await waitFor((p) => p.status === 'playing', `follow ${label}`);
    assert.equal(
      await ev(
        `document.querySelector('g[data-system-index="3"] .score__note').getBoundingClientRect().top>innerHeight`,
      ),
      true,
      `${label}: next system's notes start below the viewport`,
    );
    let followed = null;
    for (let i = 0; i < 80 && !followed; i++) {
      await sleep(50);
      followed = await ev(
        `(()=>{const c=document.querySelector('.score__note-sounding');if(!c)return null;const g=c.closest('.score__note');if(g.closest('[data-system-index]').dataset.systemIndex!=='3')return null;return g.dataset.noteId})()`,
      );
    }
    assert.ok(followed, `${label}: cue reached the next system`);
    await sleep(120);
    const view = await ev(
      `(()=>{const g=document.querySelector('.score__note[data-note-id="${followed}"]');const r=g.getBoundingClientRect();const bar=document.querySelector('.editor-sticky-toolbar');const b=bar.getBoundingClientRect();const sticky=getComputedStyle(bar).position==='sticky'&&bar.dataset.tooTall!=='true';const top=sticky?Math.max(0,b.bottom):0;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inView:r.top>=top&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,topmost:!!hit&&g.contains(hit),noHScroll:document.documentElement.scrollWidth<=innerWidth,toolbar:b.height}})()`,
    );
    assert.deepEqual(
      { ...view, toolbar: undefined },
      { inView: true, topmost: true, noHScroll: true, toolbar: undefined },
      `${label}: revealed below the toolbar`,
    );
    assert.equal(view.toolbar, toolbarHeight, `${label}: toolbar height`);
    assert.equal(
      (await noteState(start)).pressed,
      'true',
      `${label}: selection kept`,
    );
    assert.equal(await activeIsToggle(), true, `${label}: focus not moved`);
    await screenshot(
      `follow-${example.replace(/\W+/g, '-')}-${width}${zoom ? '-zoom' : ''}`,
    );
    // A manual scroll away is respected: following pauses.
    await ev('scrollTo(0,0)');
    await sleep(1500);
    assert.equal(
      await ev('scrollY'),
      0,
      `${label}: no fight after manual scroll`,
    );
    await click('Stop');
    await waitFor((p) => p.status === 'idle', `follow stop ${label}`);
    await ev(`document.querySelector('main').style.zoom=''`);
    results[`follow ${label}`] = 'revealed';
  }
  await chooseSpeed('1.5×');
  await followAcrossSystems('Dies Ir', 1440, 1000);
  await followAcrossSystems('Dies Ir', 320, 900);
  await followAcrossSystems('Salve Regina', 320, 900);
  await followAcrossSystems('Dies Ir', 1440, 1000, '1.5');

  // An oversized syllable makes the score scroll sideways at 320px: the next
  // sounding note, off to the right, is revealed inside the score viewport.
  await send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await seed({
    title: 'Wide',
    clef: { type: 'c', staffLine: 4 },
    neumes: ['w0', 'w1', 'w2', 'w3'].map((id, i) => punctum(id, 2 + (i % 3))),
    syllables: [
      { id: 'sw0', text: 'A', startsAtNeumeId: 'w0', boundaryBefore: 'word' },
      {
        id: 'sw1',
        text: 'Constantinopolitanorumquesuperextraordinariissimaequeprotoplasmaticorum',
        startsAtNeumeId: 'w1',
        boundaryBefore: 'word',
      },
      { id: 'sw2', text: 'men', startsAtNeumeId: 'w2', boundaryBefore: 'word' },
      { id: 'sw3', text: 'et', startsAtNeumeId: 'w3', boundaryBefore: 'word' },
    ],
    divisions: [],
    clefChanges: [],
    accidentals: [],
  });
  await sleep(300);
  await ev(
    `document.querySelector('.score-viewport').scrollIntoView({block:'center'})`,
  );
  await sleep(150);
  // The oversized syllable widens every system past the 320px viewport, so
  // with the score scrolled to its left edge every note is off to the right.
  const wide = await ev(
    `(()=>{const v=document.querySelector('.score-viewport');v.scrollLeft=0;const vr=v.getBoundingClientRect();const g=document.querySelector('.score__note[data-note-id="w0-n"]').getBoundingClientRect();return {overflow:v.scrollWidth>v.clientWidth,offRight:g.left>=vr.right}})()`,
  );
  assert.deepEqual(
    wide,
    { overflow: true, offRight: true },
    'score scrolls sideways',
  );
  await ev(`document.activeElement.blur()`);
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'wide playing');
  let sideways = null;
  for (let i = 0; i < 40 && !sideways; i++) {
    await sleep(50);
    sideways = await ev(
      `!!document.querySelector('.score__note[data-note-id="w0-n"] .score__note-sounding')`,
    );
  }
  assert.ok(sideways, 'cue on the first note');
  await sleep(100);
  const settled = await ev(
    `(()=>{const g=document.querySelector('.score__note[data-note-id="w0-n"]');const v=document.querySelector('.score-viewport');const r=g.getBoundingClientRect();const vr=v.getBoundingClientRect();return {scrolled:v.scrollLeft>0,inside:r.left>=vr.left&&r.right<=vr.right,noHScroll:document.documentElement.scrollWidth<=innerWidth}})()`,
  );
  assert.deepEqual(
    settled,
    { scrolled: true, inside: true, noHScroll: true },
    'revealed horizontally',
  );
  assert.equal(await activeIsToggle(), true, 'wide: focus not moved');
  await screenshot('follow-wide-320');
  await waitFor((p) => p.status === 'idle', 'wide end', 4000);
  results.followHorizontal = 'revealed';
  // Shared reveal geometry under 150% CSS zoom, in the sideways-scrolling
  // score viewport: keyboard browsing (focusAndReveal) and follow scrolling
  // (revealElement) must both reveal minimally, with the target's right edge
  // 8px inside the viewport's right edge, not past it (overshoot).
  await ev(`document.querySelector('main').style.zoom='1.5'`);
  await sleep(300);
  const minimalRight = (id) =>
    ev(
      `(()=>{const v=document.querySelector('.score-viewport');const r=document.querySelector('.score__note[data-note-id="${id}"]').getBoundingClientRect();const vr=v.getBoundingClientRect();return {scrollLeft:Math.round(v.scrollLeft),inside:r.left>=vr.left&&r.right<=vr.right,gap:+(vr.right-r.right).toFixed(1)}})()`,
    );
  // Keyboard: select w0 (Enter), scroll it out of view, then transpose it
  // (ArrowUp); the app restores focus through focusAndReveal. Undo after.
  await ev(
    `(()=>{document.querySelector('.score-viewport').scrollLeft=0;document.querySelector('.score__note[data-note-id="w0-n"]').focus({preventScroll:true})})()`,
  );
  await key('Enter');
  await ev(`document.querySelector('.score-viewport').scrollLeft=0`);
  await sleep(100);
  await key('ArrowUp');
  await sleep(300);
  const keyboard = await minimalRight('w0-n');
  results.zoomKeyboardReveal = keyboard;
  assert.ok(
    keyboard.inside,
    `zoomed keyboard reveal: ${JSON.stringify(keyboard)}`,
  );
  assert.ok(
    Math.abs(keyboard.gap - 8) <= 2,
    `zoomed keyboard reveal is minimal: ${JSON.stringify(keyboard)}`,
  );
  await ev(`document.querySelector('[aria-label="Undo last edit"]').click()`);
  await sleep(200);
  // Follow scrolling: from the left edge, Play reveals the first note.
  await ev(
    `document.activeElement.blur();document.querySelector('.score-viewport').scrollLeft=0`,
  );
  await sleep(100);
  await click('Play');
  await waitFor((p) => p.status === 'playing', 'zoomed wide playing');
  await sleep(300);
  const follow = await minimalRight('w0-n');
  results.zoomFollowReveal = follow;
  assert.ok(follow.inside, `zoomed follow reveal: ${JSON.stringify(follow)}`);
  assert.ok(
    Math.abs(follow.gap - 8) <= 2,
    `zoomed follow reveal is minimal: ${JSON.stringify(follow)}`,
  );
  await click('Stop');
  await waitFor((p) => p.status === 'idle', 'zoomed wide stop');
  await ev(`document.querySelector('main').style.zoom=''`);

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
