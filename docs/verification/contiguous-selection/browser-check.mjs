import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const screenshotDirectory = await mkdtemp(join(tmpdir(), 'chant-ranges-'));
console.log(`Screenshots: ${screenshotDirectory}`);
const editorUrl = process.env.CHANT_EDITOR_URL ?? 'http://127.0.0.1:5173';
const firefox = Boolean(process.env.CHANT_FIREFOX_URL);
let socketUrl = process.env.CHANT_FIREFOX_URL;
if (!firefox) {
  const pages = await (
    await fetch(process.env.CHANT_CHROMIUM_URL ?? 'http://127.0.0.1:9230/json')
  ).json();
  socketUrl = pages.find((p) => p.type === 'page').webSocketDebuggerUrl;
}
const ws = new WebSocket(socketUrl);
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
const rawSend = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, (m) =>
      m.error || m.type === 'error' ? reject(m) : resolve(m.result),
    );
    ws.send(JSON.stringify({ id, method, params }));
  });
let context;
let ownsSession = false;
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  const send = async (method, params = {}) => {
    if (!firefox) return rawSend(method, params);
    switch (method) {
      case 'Runtime.evaluate': {
        const r = await rawSend('script.evaluate', {
          expression: `(async()=>JSON.stringify(await (0,eval)(${JSON.stringify(params.expression)})))()`,
          target: { context },
          awaitPromise: true,
        });
        if (r.type === 'exception') throw Error(JSON.stringify(r));
        return {
          result: {
            value:
              r.result.value === undefined
                ? undefined
                : JSON.parse(r.result.value),
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
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const pause = () => new Promise((r) => setTimeout(r, 100));

  const viewport = async (width) =>
    send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
  await viewport(1440);
  await send('Page.navigate', {
    url: editorUrl + '/docs/verification/placement/browser-fixture.html',
  });
  for (let i = 0; i < 50; i++) {
    await pause();
    if (await ev("typeof mountChantFixture === 'function'")) break;
  }
  const mount = async (doc) => {
    await ev(`(mountChantFixture(${JSON.stringify(doc)}),true)`);
    await pause();
    await pause();
  };
  const shot = async (name) => {
    await pause();
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(
      join(screenshotDirectory, name + '.png'),
      Buffer.from(data, 'base64'),
    );
  };

  const nativeClick = async (selector) => {
    await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});if(!e.closest('.editor-sticky-toolbar') || getComputedStyle(e.closest('.editor-sticky-toolbar')).position!=='sticky')e.scrollIntoView({block:'center'});window.scrollBy(0,e.getBoundingClientRect().y-innerHeight/2);const v=document.querySelector('.score-viewport');let b=e.getBoundingClientRect();if(v&&e.closest('.score')){const vb=v.getBoundingClientRect();v.scrollLeft+=b.x+b.width/2-vb.x-vb.width/2;b=e.getBoundingClientRect();}return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
    );
    await pause();
    const settled = await ev(
      `(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
    );
    await clickPoint(settled);
  };
  const clickPoint = async (p) => {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', {
        type,
        ...p,
        button: type === 'mouseMoved' ? 'none' : 'left',
        clickCount: 1,
      });
    await pause();
  };
  const key = async (name, shift = false) => {
    if (firefox) {
      const value =
        {
          ArrowLeft: '\uE012',
          ArrowRight: '\uE014',
          ArrowUp: '\uE013',
          ArrowDown: '\uE015',
          End: '\uE010',
          Home: '\uE011',
          Escape: '\uE00C',
          Enter: '\uE007',
          Delete: '\uE017',
          Backspace: '\uE003',
          Tab: '\uE004',
        }[name] ?? name;
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
        await send('Input.dispatchKeyEvent', {
          type,
          modifiers: shift ? 8 : 0,
          key: name,
          code: name,
          ...(name === 'Enter' && type === 'keyDown' ? { text: '\r' } : {}),
          windowsVirtualKeyCode:
            {
              Escape: 27,
              Enter: 13,
              Delete: 46,
              Backspace: 8,
              Tab: 9,
              ArrowLeft: 37,
              ArrowRight: 39,
              ArrowUp: 38,
              ArrowDown: 40,
              ' ': 32,
            }[name] ?? name.toUpperCase().charCodeAt(0),
        });
    await pause();
  };

  const shiftClick = async (selector) => {
    if (firefox)
      await rawSend('input.performActions', {
        context,
        actions: [
          {
            type: 'key',
            id: 'keyboard',
            actions: [{ type: 'keyDown', value: '\uE008' }],
          },
        ],
      });
    else
      await rawSend('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Shift',
        code: 'ShiftLeft',
        windowsVirtualKeyCode: 16,
        modifiers: 8,
      });
    const p = await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});window.scrollBy(0,e.getBoundingClientRect().y-innerHeight/2);const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
    );
    await pause();
    Object.assign(
      p,
      await ev(
        `(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
      ),
    );
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', {
        type,
        ...p,
        button: type === 'mouseMoved' ? 'none' : 'left',
        clickCount: 1,
        modifiers: 8,
      });
    if (firefox)
      await rawSend('input.performActions', {
        context,
        actions: [
          {
            type: 'key',
            id: 'keyboard',
            actions: [{ type: 'keyUp', value: '\uE008' }],
          },
        ],
      });
    else
      await rawSend('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Shift',
        code: 'ShiftLeft',
        windowsVirtualKeyCode: 16,
        modifiers: 0,
      });
    await pause();
  };
  const note = (id) => `[data-note-id="${id}"]`;
  const focus = async (selector) => {
    await ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await pause();
  };
  const count = async (n) =>
    assert.match(
      await ev(
        `document.querySelector('#range-selection-status')?.textContent ?? ''`,
      ),
      new RegExp(`^${n} neumes selected`),
    );
  const bytes = () =>
    ev(`localStorage.getItem('gregorian-chant-editor:active-document:v1')`);
  const fixture = {
    title: 'Contiguous selection',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: 70 }, (_, i) => ({
      id: `n${i}`,
      kind: i % 2 ? 'podatus' : 'punctum',
      notes:
        i % 2
          ? [
              { id: `a${i}`, staffPosition: 2 },
              { id: `b${i}`, staffPosition: 4 },
            ]
          : [{ id: `a${i}`, staffPosition: i === 6 ? 3 : 2 }],
    })),
    syllables: [
      { id: 's0', text: 'Ky', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
      {
        id: 's1',
        text: 'rie',
        startsAtNeumeId: 'n5',
        boundaryBefore: 'continuation',
      },
    ],
    divisions: [{ id: 'D', kind: 'minima', beforeNeumeId: 'n8' }],
    clefChanges: [
      {
        id: 'C',
        clef: { type: 'c', staffLine: 3 },
        beforeNeumeId: 'n12',
        beforeDivisionId: null,
      },
    ],
    accidentals: [{ id: 'flat', kind: 'flat', ownerNoteId: 'a6' }],
  };
  await mount(fixture);
  await nativeClick(note('a3'));
  await key('ArrowUp');
  await shiftClick(note('b3'));
  assert.equal(
    await ev(`document.querySelectorAll('.score__neume-selection').length`),
    1,
  );
  await shiftClick(note('a30'));
  await count(28);
  const original = await bytes();
  await nativeClick('[aria-label="Undo last edit"]');
  await count(28);
  assert.notEqual(await bytes(), original);
  await nativeClick('[aria-label="Redo last undone edit"]');
  await count(28);
  assert.equal(await bytes(), original);
  await focus(note('a30'));
  assert.equal(await ev(`getSelection().toString()`), '');
  assert.ok(
    await ev(`document.querySelectorAll('.score__range-selection').length > 1`),
  );
  assert.equal(
    await ev(
      `document.querySelectorAll('.score__note-selection,.score__neume-selection').length`,
    ),
    0,
  );
  assert.ok(
    await ev(
      `[...document.querySelectorAll('.score__range-selection')].every(e=>e.getAttribute('pointer-events')==='none'&&e.getAttribute('aria-hidden')==='true')`,
    ),
  );
  await shot('cross-system');
  await key('ArrowLeft', true);
  await count(27);
  assert.equal(await ev(`document.activeElement.dataset.noteId`), 'a29');
  await key('Tab');
  await count(27);
  await key('Tab', true);
  await count(27);
  for (const k of ['Delete', 'Backspace', 'ArrowUp', 'ArrowDown', 'i'])
    await key(k);
  assert.equal(await bytes(), original);
  await focus('[data-division-id="D"]');
  await key('i');
  await count(27);
  assert.equal(await bytes(), original);
  assert.equal(
    await ev(`document.querySelector('.division-controls') !== null`),
    false,
  );
  await focus('[data-clef-change-id="C"]');
  await key('i');
  await count(27);
  assert.equal(await bytes(), original);
  await focus(note('a3'));
  await key('Enter', true);
  assert.equal(
    await ev(`document.querySelectorAll('.score__neume-selection').length`),
    1,
  );
  await key('ArrowLeft', true);
  await count(2);
  await key('ArrowRight', true);
  await key('ArrowRight', true);
  await count(2);
  await focus(note('a8'));
  await key(' ', true);
  await count(6);
  await viewport(320);
  await pause();
  await count(6);
  await viewport(1440);
  await pause();
  await count(6);
  await key('Escape');
  assert.equal(
    await ev(`document.querySelectorAll('.score__range-selection').length`),
    0,
  );
  await nativeClick(note('a3'));
  await shiftClick(note('a30'));
  await focus(note('a7'));
  await key('l');
  assert.equal(
    await ev(`document.querySelectorAll('.score__range-selection').length`),
    0,
  );
  await key('Escape');
  await send('Page.navigate', { url: editorUrl + '/' });
  await pause();
  await pause();
  // Bundled score is loaded through the application's example control.
  await ev(
    `window.confirm=()=>true;(()=>{const e=document.querySelector('[aria-label="Load example"]');const o=[...e.options].find(o=>/Kyrie XI/i.test(o.textContent));e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await new Promise((r) => setTimeout(r, 600));
  const ids = await ev(
    `[...document.querySelectorAll('[data-neume-id]')].map(e=>e.querySelector('[data-note-id]')?.dataset.noteId).filter(Boolean)`,
  );
  assert.ok(ids.length === 40);
  await nativeClick(note(ids[3]));
  await shiftClick(note(ids[30]));
  await count(28);
  const saved = await bytes();
  await shot('kyrie-cross-system');
  await key('ArrowRight', true);
  await count(29);
  assert.equal(await ev(`document.activeElement.dataset.noteId`), ids[31]);
  assert.ok(
    await ev(
      `(()=>{const b=document.activeElement.getBoundingClientRect(),t=document.querySelector('.editor-sticky-toolbar').getBoundingClientRect();return b.top>=Math.max(0,t.bottom)&&b.bottom<=innerHeight})()`,
    ),
  );
  await viewport(320);
  await pause();
  await count(29);
  await shot('kyrie-narrow');
  assert.equal(await bytes(), saved);
  console.log(
    'PASS: native pointer and keyboard ranges, contraction/reversal, cross-system focus, Tab, safety guards, explicit L, persisted bytes and Kyrie XI at wide/narrow widths.',
  );
} finally {
  if (ownsSession) await rawSend('session.end').catch(() => {});
  ws.close();
}
