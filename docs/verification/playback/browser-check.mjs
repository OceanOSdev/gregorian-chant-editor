import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const editorUrl = process.env.CHANT_EDITOR_URL ?? 'http://127.0.0.1:5174';
const artifacts = await mkdtemp(join(tmpdir(), 'chant-audio-'));
const pages = await (await fetch('http://127.0.0.1:9230/json')).json();
const ws = new WebSocket(
  pages.find((p) => p.type === 'page').webSocketDebuggerUrl,
);
await new Promise((r) => ws.addEventListener('open', r));
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
    pending.set(id, (m) => (m.error ? reject(m.error) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const pause = (ms = 100) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const click = async (selector) => {
  const point = await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  );
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      button: 'left',
      clickCount: 1,
      ...point,
    });
  await pause();
};
const button = async (text) => {
  await ev(
    `(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing button '+${JSON.stringify(text)});e.id='audio-test-button';})()`,
  );
  await click('#audio-test-button');
  await ev(
    `document.querySelector('#audio-test-button')?.removeAttribute('id')`,
  );
};
const key = async (key) => {
  const vk = { Home: 36, End: 35, ArrowUp: 38, Enter: 13 }[key] ?? 0;
  for (const type of ['keyDown', 'keyUp'])
    await send('Input.dispatchKeyEvent', {
      type,
      key,
      windowsVirtualKeyCode: vk,
    });
  await pause();
};
const rms = () =>
  ev(
    `(async()=>{let peak=0;const analyser=window.__audioContexts.at(-1)?.analyser;if(!analyser)return 0;for(let i=0;i<8;i++){const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);peak=Math.max(peak,Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length));await new Promise(r=>setTimeout(r,20));}return peak;})()`,
  );
const highlighted = () =>
  ev(
    `document.querySelector('.score__playback-highlight')?.closest('[data-note-id]')?.dataset.noteId ?? null`,
  );
try {
  await send('Page.enable');
  const injection = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(()=>{const Native=window.AudioContext;window.__audioContexts=[];window.AudioContext=class extends Native{constructor(...args){super(...args);const analyser=this.createAnalyser();analyser.fftSize=2048;analyser.connect(this.destination);const create=this.createGain.bind(this);this.createGain=()=>{const gain=create();const connect=gain.connect.bind(gain);gain.connect=(target,...rest)=>connect(target===this.destination?analyser:target,...rest);return gain;};window.__audioContexts.push({context:this,analyser});}}})()`,
  });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: editorUrl });
  await pause(500);
  await ev('localStorage.clear()');
  await send('Page.reload');
  await pause(800);
  assert.equal(await ev('window.__audioContexts.length'), 0);
  await click('.score .score__note');
  const selection = await ev(
    `document.querySelector('.score__note[aria-pressed=true]').dataset.noteId`,
  );
  const before = await ev(
    `localStorage.getItem('gregorian-chant-editor.document.v1')`,
  );
  await click('[aria-label="Play chant"]');
  await pause(170);
  assert.equal(await ev('window.__audioContexts.length'), 1);
  assert.equal(await ev('window.__audioContexts[0].context.state'), 'running');
  const signal = await rms();
  assert(signal > 0.001, `Expected real nonzero audio samples; RMS=${signal}`);
  const first = await highlighted();
  assert(first);
  assert.equal(
    await ev(`document.activeElement.getAttribute('aria-label')`),
    'Pause playback',
  );
  await pause(750);
  assert.notEqual(await highlighted(), first);
  assert.equal(
    await ev(
      `document.querySelector('.score__note[aria-pressed=true]').dataset.noteId`,
    ),
    selection,
  );
  assert.equal(
    await ev(`localStorage.getItem('gregorian-chant-editor.document.v1')`),
    before,
  );
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    join(artifacts, 'playing.png'),
    Buffer.from(shot.data, 'base64'),
  );
  await click('[aria-label="Pause playback"]');
  await pause(150);
  const frozen = await ev(
    `document.querySelector('.playback-time').textContent`,
  );
  assert.equal(await highlighted(), null);
  assert((await rms()) < 0.00001);
  await pause(350);
  assert.equal(
    await ev(`document.querySelector('.playback-time').textContent`),
    frozen,
  );
  await click('[aria-label="Resume playback"]');
  await pause(100);
  assert.equal(await ev('window.__audioContexts.length'), 1);
  assert((await rms()) > 0.001);
  await click('[aria-label="Playback volume"]');
  await key('Home');
  await pause(200);
  assert((await rms()) < 0.00001);
  await key('End');
  await pause(120);
  assert((await rms()) > 0.001);
  await button('Stop');
  await pause(150);
  assert.equal(await highlighted(), null);
  assert((await rms()) < 0.00001);
  await click('[aria-label="Play chant"]');
  await click('[aria-label="Playback tempo"]');
  await key('Home');
  assert.equal(await highlighted(), null);
  assert(
    await ev(`Boolean(document.querySelector('[aria-label="Play chant"]'))`),
  );
  await key('End');
  await click('[aria-label="Play chant"]');
  await click('.score .score__note');
  await key('ArrowUp');
  await pause(150);
  assert.equal(await highlighted(), null);
  assert((await rms()) < 0.00001);
  await click('[aria-label="Play chant"]');
  await click('[aria-label="Playback register"]');
  await key('End');
  await key('Enter');
  assert.equal(await highlighted(), null);
  await button('New chant');
  await button('Replace chant');
  await button('Insert Punctum I');
  await pause(500);
  await click('[aria-label="Play chant"]');
  await pause(60);
  assert((await rms()) > 0.001);
  await pause(550);
  assert.equal(await highlighted(), null);
  assert(
    await ev(`Boolean(document.querySelector('[aria-label="Play chant"]'))`),
  );
  await click('[aria-label="Play chant"]');
  await pause(60);
  assert((await rms()) > 0.001);
  await button('Stop');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await pause();
  assert((await ev('document.documentElement.scrollWidth')) <= 320);
  const unsupported = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.AudioContext=undefined',
  });
  await send('Page.reload');
  await pause(700);
  await click('[aria-label="Play chant"]');
  assert(
    (
      await ev(
        `document.querySelector('.playback-controls [role=alert]').textContent`,
      )
    ).includes('Web Audio'),
  );
  assert.equal(await highlighted(), null);
  await send('Page.removeScriptToEvaluateOnNewDocument', {
    identifier: unsupported.identifier,
  });
  await send('Page.removeScriptToEvaluateOnNewDocument', {
    identifier: injection.identifier,
  });
  console.log(
    JSON.stringify(
      {
        passed: true,
        artifacts,
        signalRms: signal,
        checks: [
          'gesture-gated startup',
          'real nonzero audio output',
          'moving highlight without selection/focus changes',
          'pause and exact resume',
          'volume mute/unmute',
          'stop and silence',
          'tempo/register/edit cancellation',
          'completion and replay',
          '320px containment',
          'unsupported-audio error',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  ws.close();
}
