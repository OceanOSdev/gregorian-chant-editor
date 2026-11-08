import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP driver; mounts the existing real StrictMode editor fixture.
const output = await mkdtemp(join(tmpdir(), 'chant-mid-clefs-'));
const firefox = Boolean(process.env.CHANT_FIREFOX_URL);
const pages = firefox
  ? []
  : await (await fetch('http://127.0.0.1:9230/json')).json();
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
      m.error ? reject(Error(JSON.stringify(m.error))) : resolve(m.result),
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
        expression: `(async()=>JSON.stringify(await (${params.expression})))()`,
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
    case 'Input.dispatchKeyEvent': {
      const values = {
        Enter: '\uE007',
        Escape: '\uE00C',
        Tab: '\uE004',
        Delete: '\uE017',
        Backspace: '\uE003',
        ArrowUp: '\uE013',
        ArrowDown: '\uE015',
      };
      const down = params.type === 'keyDown';
      const modifiers = [
        ...(params.modifiers & 2 ? ['\uE009'] : []),
        ...(params.modifiers & 8 ? ['\uE008'] : []),
      ];
      return rawSend('input.performActions', {
        context,
        actions: [
          {
            type: 'key',
            id: 'keyboard',
            actions: [
              ...(down
                ? modifiers.map((value) => ({ type: 'keyDown', value }))
                : []),
              {
                type: down ? 'keyDown' : 'keyUp',
                value: values[params.key] ?? params.key,
              },
              ...(!down
                ? modifiers.reverse().map((value) => ({ type: 'keyUp', value }))
                : []),
            ],
          },
        ],
      });
    }
    case 'Input.insertText':
      return rawSend('input.performActions', {
        context,
        actions: [
          {
            type: 'key',
            id: 'keyboard',
            actions: [...params.text].flatMap((value) => [
              { type: 'keyDown', value },
              { type: 'keyUp', value },
            ]),
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
    ...(key === 'Enter' ? { text: '\r' } : {}),
    windowsVirtualKeyCode:
      {
        Enter: 13,
        Escape: 27,
        Tab: 9,
        Delete: 46,
        Backspace: 8,
        ArrowUp: 38,
        ArrowDown: 40,
        ' ': 32,
      }[key] ?? key.toUpperCase().charCodeAt(0),
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
const fixture = (count = 15) => ({
  title: 'Stage 6B: clef changes and custodes',
  clef: { type: 'c', staffLine: 3 },
  lyricLanguage: 'la',
  clefChanges: [],
  divisions: [],
  syllables: [],
  neumes: Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    kind: 'punctum',
    notes: [{ id: `note${i}`, staffPosition: 2 + (i % 3) }],
  })),
});
const button = (text) => `[data-test-button="${text}"]`;
const clickButton = async (text) => {
  await ev(
    `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing button '+${JSON.stringify(text)});e.dataset.testButton=${JSON.stringify(text)};})()`,
  );
  await click(button(text));
};
const dialog = () =>
  ev(
    `document.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? null`,
  );
const clefIds = () =>
  ev(
    `[...document.querySelectorAll('[data-clef-change-id]')].map(e=>e.dataset.clefChangeId)`,
  );
const ink = () =>
  ev(
    `[...document.querySelectorAll('[data-note-id]')].map(e=>({id:e.dataset.noteId,y:Number(e.querySelector('.score__note-hit-target').getAttribute('y')) - Number(e.closest('[data-system-index]').dataset.systemIndex)*244}))`,
  );
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  await viewport(1440);
  await send('Page.navigate', {
    url: 'http://127.0.0.1:5173/docs/verification/placement/browser-fixture.html',
  });
  for (let i = 0; i < 50; i++) {
    await pause();
    if (await ev(`typeof mountChantFixture === 'function'`)) break;
  }
  for (const width of [1440, 320]) {
    await viewport(width);
    await mount(fixture());
    // Native pointer activation and a single default pitch-preserving decision.
    await select('Clef insertion boundary', '3');
    const original = await ink();
    await clickButton('Insert clef change');
    assert.equal(await dialog(), 'Clef change draft');
    await select('Draft clef type', 'f');
    await select('Draft clef staff line', '2');
    assert.deepEqual(await ink(), original);
    await clickButton('Apply clef change');
    assert.equal(await dialog(), 'Choose pitch preservation');
    assert.equal(
      await ev(`document.activeElement.textContent.trim()`),
      'Preserve melody',
    );
    if (firefox)
      await clickButton(await ev(`document.activeElement.textContent.trim()`));
    else await key('Enter');
    assert.equal(await dialog(), null);
    const ids = await clefIds();
    assert.equal(ids.length, 1);
    assert.equal(
      await ev(`document.activeElement.dataset.clefChangeId`),
      ids[0],
    );
    assert.ok(
      await ev(`document.querySelectorAll('.score__custos').length > 0`),
    );
    const committed = await ink();
    assert.notDeepEqual(committed, original);
    await shot(`${width}-mid-staff`);
    await key('z', 'KeyZ', 2);
    assert.equal((await clefIds()).length, 0);
    await key('z', 'KeyZ', 10);
    assert.deepEqual(await ink(), committed);
    assert.equal(await dialog(), null);
    // Enter selects the authored glyph; Up opens a draft; Escape cancels.
    await ev(`document.querySelector('[data-clef-change-id]').focus()`);
    await key(' ', 'Space');
    await key('ArrowUp');
    assert.equal(await dialog(), 'Clef change draft');
    await key('Escape');
    assert.deepEqual(await ink(), committed);
    assert.equal(
      await ev(`document.activeElement.dataset.clefChangeId`),
      ids[0],
    );
    // Repeated adjustments resolve once against the original committed value.
    await clickButton('Edit clef change');
    await select('Draft clef staff line', '3');
    await select('Draft clef staff line', '1');
    await select('Draft clef staff line', '2');
    await clickButton('Apply clef change');
    assert.equal(await dialog(), null);
    assert.deepEqual(await ink(), committed);
    await clickButton('Edit clef change');
    await select('Draft clef type', 'c');
    await select('Draft clef staff line', '4');
    await clickButton('Apply clef change');
    assert.equal(await dialog(), 'Choose pitch preservation');
    await clickButton('Preserve noteheads');
    assert.deepEqual(await ink(), committed);
    await ev(`document.querySelector('[data-clef-change-id]').focus()`);
    await key('Delete');
    assert.equal(await dialog(), 'Choose pitch preservation');
    await clickButton('Preserve noteheads');
    assert.equal((await clefIds()).length, 0);
    assert.deepEqual(await ink(), committed);
    // Dirty lyrics survive a canceled clef transaction; native text editing remains native.
    await mount(fixture(3));
    await click('[data-note-id="note1"]');
    await key('l', 'KeyL');
    await send('Input.insertText', { text: 'Ky' });
    await pause();
    await clickButton('Insert clef change');
    await select('Draft clef type', 'f');
    await key('Escape');
    assert.equal(
      await ev(`document.querySelector('#lyric-input').value`),
      'Ky',
    );
    // Tail insertion does not prompt, and native Tab reaches Apply/Cancel.
    await key('Escape');
    await select('Clef insertion boundary', '3');
    await clickButton('Insert clef change');
    await key('Tab');
    await key('Tab');
    assert.equal(
      await ev(`document.activeElement.textContent.trim()`),
      'Apply clef change',
    );
    if (firefox)
      await clickButton(await ev(`document.activeElement.textContent.trim()`));
    else await key('Enter');
    assert.equal(await dialog(), null);
    // Two consecutive changes at a break preserve the first leading authored glyph.
    const d = fixture();
    d.divisions = [{ id: 'D', kind: 'minima', beforeNeumeId: 'n11' }];
    d.clefChanges = [
      {
        id: 'C1',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'n11',
        beforeDivisionId: null,
      },
      {
        id: 'C2',
        clef: { type: 'f', staffLine: 2 },
        beforeNeumeId: 'n11',
        beforeDivisionId: null,
      },
    ];
    await mount(d);
    assert.deepEqual(await clefIds(), ['C1', 'C2']);
    assert.equal(
      await ev(
        `document.querySelector('[data-clef-change-id="C1"]').closest('[data-system-index]').dataset.systemIndex`,
      ),
      '1',
    );
    assert.equal(
      await ev(
        `document.querySelector('[data-system-index="1"]').querySelectorAll(':scope > .score__clef-ink').length`,
      ),
      0,
    );
    assert.equal(
      await ev(
        `document.querySelector('[data-system-index="0"]').querySelectorAll('.score__custos').length`,
      ),
      1,
    );
    // Repeated decorative clefs and all guides are inert.
    assert.equal(
      await ev(
        `[...document.querySelectorAll('.score__custos')].every(e=>e.getAttribute('pointer-events')==='none' && !e.hasAttribute('tabindex'))`,
      ),
      true,
    );
    await shot(`${width}-system-break`);
    assert.equal(
      await ev(`document.documentElement.scrollWidth <= innerWidth`),
      true,
    );
    // Native focus visits each authored event after reflow.
    await ev(`document.querySelector('[data-clef-change-id="C1"]').focus()`);
    await key('Tab');
    assert.equal(await ev(`document.activeElement.dataset.clefChangeId`), 'C2');
  }
  console.log(
    `PASS: Stage 6B ${firefox ? 'Firefox (HTML activation via pointer)' : 'Chromium'} pointer/keyboard insertion, staged drafts, pitch choices, cancellation, history, focus, dirty lyrics, narrow layout and engraving. Screenshots: ${output}`,
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
