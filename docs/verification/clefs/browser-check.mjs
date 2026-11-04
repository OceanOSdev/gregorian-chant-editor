import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP driver; mounts the existing real StrictMode editor fixture.
const output = await mkdtemp(join(tmpdir(), 'chant-clefs-'));
const pages = await (await fetch('http://127.0.0.1:9230/json')).json();
const ws = new WebSocket(
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
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, (m) =>
      m.error ? reject(Error(JSON.stringify(m.error))) : resolve(m.result),
    );
    ws.send(JSON.stringify({ id, method, params }));
  });
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
const viewport = (width) =>
  send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
const mount = async (document) => {
  await ev(`mountChantFixture(${JSON.stringify(document)})`);
  await pause();
  await pause();
};
const select = async (name, value) => {
  await ev(
    `(()=>{const e=document.querySelector('[aria-label="${name}"]');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
};
const key = async (key, code = key, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    modifiers,
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
  await pause();
};
const click = async (selector) => {
  const p = await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...p,
      button: 'left',
      clickCount: 1,
    });
  await pause();
};
const shot = async (name) => {
  await ev(`document.querySelector('.score').scrollIntoView({block:'center'})`);
  await pause();
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
};
const pitches = () =>
  ev(
    `Array.from(document.querySelectorAll('[data-note-id]')).map(e=>Number(e.querySelector('.score__note-hit-target').getAttribute('y')))`,
  );
const fixture = (count) => ({
  title: 'Stage 6A clef review',
  clef: { type: 'c', staffLine: 3 },
  lyricLanguage: 'la',
  divisions: count ? [{ id: 'D', kind: 'minor', beforeNeumeId: 'n1' }] : [],
  neumes: Array.from({ length: count }, (_, i) => ({
    id: 'n' + i,
    kind: 'punctum',
    notes: [{ id: 'note' + i, staffPosition: 2 + (i % 3) }],
  })),
  syllables: count
    ? [{ id: 's', text: 'Al', startsAtNeumeId: 'n0', boundaryBefore: 'word' }]
    : [],
});
try {
  await viewport(1440);
  await send('Page.navigate', {
    url:
      (process.env.CHANT_EDITOR_URL ?? 'http://127.0.0.1:5173') +
      '/docs/verification/placement/browser-fixture.html',
  });
  for (let i = 0; i < 50; i++) {
    await pause();
    if (await ev(`typeof mountChantFixture === 'function'`)) break;
  }
  await ev(
    `(async()=>{const l=await import('/src/editor/layout/layout-chant.ts');window.clefLayout=l.layoutChant;})()`,
  );
  for (const width of [1440, 320]) {
    await viewport(width);
    for (const type of ['c', 'f'])
      for (const line of [1, 2, 3, 4]) {
        // Midrange melody for each independently authored specimen. All semantic
        // transforms are separately exercised below and in the exhaustive tests.
        const document = fixture(20);
        document.clef = { type, staffLine: line };
        await mount(document);
        const results = await ev(`(()=>{
        const expected=clefLayout(${JSON.stringify(document)});
        const ink=Array.from(document.querySelectorAll('.score__clef-ink'));
        return { count:ink.length, systems:expected.systems.length,
          controls:document.querySelectorAll('[data-initial-clef]').length,
          tab:document.querySelector('[data-initial-clef]').getAttribute('tabindex'),
          boxes:ink.map((e,i)=>{const a=e.getBBox(),b=expected.systems[i].clef.bounds;return ['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.001)}),
          pageFits:document.documentElement.scrollWidth<=innerWidth,
          summary:document.querySelector('.score desc').textContent };
      })()`);
        assert.equal(results.count, results.systems);
        assert.equal(results.controls, 1);
        assert.equal(results.tab, '0');
        assert.ok(results.boxes.every(Boolean));
        assert.ok(results.pageFits);
        assert.match(
          results.summary,
          new RegExp(`Initial ${type.toUpperCase()} .*staff line ${line}`),
        );
        if (line === 3 || line === 4) await shot(`${width}-${type}${line}`);
      }
    await mount(fixture(20));
    const initial = await pitches();
    await click('[data-initial-clef]');
    assert.equal(
      await ev(
        `document.querySelector('[data-initial-clef]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    await key('ArrowUp');
    assert.equal(
      await ev(
        `document.querySelector('[aria-label="Initial clef staff line"]').value`,
      ),
      '4',
    );
    const moved = await pitches();
    assert.deepEqual(
      moved,
      initial.map((y) => y - 24),
    );
    await shot(`${width}-selected-c4`);
    assert.equal(
      await ev(`document.activeElement.hasAttribute('data-initial-clef')`),
      true,
    );
    await key('z', 'KeyZ', 2);
    assert.deepEqual(await pitches(), initial);
    await key('z', 'KeyZ', 10);
    assert.deepEqual(await pitches(), moved);
    assert.equal(
      await ev(`document.activeElement.hasAttribute('data-initial-clef')`),
      true,
    );
    await key('ArrowUp'); // legal edge: no history edit
    await click('[aria-label="Undo last edit"]');
    assert.deepEqual(await pitches(), initial);
    await click('[aria-label="Redo last undone edit"]');
    assert.deepEqual(await pitches(), moved);
    await select('Initial clef type', 'f');
    await select('Initial clef staff line', 3);
    assert.deepEqual(
      await pitches(),
      initial.map((y) => y + 36),
    );
    assert.equal(
      await ev(
        `document.querySelector('[data-initial-clef]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    await click('[data-initial-clef]');
    await key('Escape');
    assert.equal(
      await ev(
        `document.querySelector('[data-initial-clef]').getAttribute('aria-pressed')`,
      ),
      'false',
    );
    // Native tab visits first singleton, then independent notation; focus alone
    // does not select a clef. Shift/modified arrows must not transform it.
    await key('ArrowUp', 'ArrowUp', 8);
    assert.equal(
      await ev(
        `document.querySelector('[aria-label="Initial clef staff line"]').value`,
      ),
      '3',
    );
    await ev(`document.querySelector('.editor-help summary').focus()`);
    await key('Tab');
    assert.equal(
      await ev(`document.activeElement.hasAttribute('data-initial-clef')`),
      true,
    );
    await key('Tab');
    assert.equal(
      await ev(`document.activeElement.hasAttribute('data-note-id')`),
      true,
    );
    await ev(`document.querySelector('[data-initial-clef]').focus()`);
    await key(' ', 'Space');
    assert.equal(
      await ev(
        `document.querySelector('[data-initial-clef]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    const beforeDelete = await pitches();
    await key('Delete');
    assert.deepEqual(await pitches(), beforeDelete);
    assert.equal(
      await ev(`document.querySelectorAll('[data-initial-clef]').length`),
      1,
    );
    // A clef edit must leave a native dirty lyric draft intact.
    await mount(fixture(2));
    await click('[data-note-id="note1"]');
    await key('l', 'KeyL');
    await send('Input.insertText', { text: 'Ky' });
    await select('Initial clef type', 'f');
    assert.equal(
      await ev(`document.querySelector('#lyric-input').value`),
      'Ky',
    );
    assert.equal(
      await ev(`document.querySelector('#lyric-input').dataset.targetNeumeId`),
      'n1',
    );
    await mount(fixture(0));
    await select('Initial clef type', 'f');
    await select('Initial clef staff line', 1);
    assert.equal(
      await ev(`document.querySelectorAll('.score__clef-ink').length`),
      1,
    );
    await shot(`${width}-empty-f1`);
    // Placement retains event ownership and the remembered neume kind.
    await click('[data-tool="podatus"]');
    assert.equal(
      await ev(
        `document.querySelector('[data-initial-clef]').getAttribute('tabindex')`,
      ),
      '-1',
    );
    await select('Initial clef type', 'c');
    assert.equal(
      await ev(
        `document.querySelector('[data-tool="podatus"]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    await click('.score');
    assert.equal(
      await ev(`document.querySelectorAll('[data-neume-id]').length>0`),
      true,
    );
    await key('Escape');
    assert.equal(
      await ev(
        `document.querySelector('[data-initial-clef]').getAttribute('tabindex')`,
      ),
      '0',
    );
  }
  console.log(
    `PASS: 16 glyph/system/occupied-bound specimens; desktop and 320px controls, native pointer/keyboard, history, focus, empty scores and placement. Screenshots: ${output}`,
  );
} finally {
  ws.close();
}
