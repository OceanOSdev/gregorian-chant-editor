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
const selectBoundary = async (index) =>
  select(
    'Clef insertion boundary',
    await ev(
      `document.querySelector('[aria-label="Clef insertion boundary"]').options[${index}].value`,
    ),
  );
const scoreOrder = () =>
  ev(
    `[...document.querySelectorAll('[data-neume-id],[data-clef-change-id],[data-division-id]')].map(e=>e.dataset.neumeId ?? e.dataset.clefChangeId ?? e.dataset.divisionId)`,
  );
const scorePoint = async (x, y, scrollX) => {
  await ev(
    `(()=>{const v=document.querySelector('.score-viewport');v.scrollIntoView({block:'center'});if(${scrollX ?? false}){const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('.score').getScreenCTM());v.scrollLeft+=p.x-v.getBoundingClientRect().left-v.clientWidth/2;}})()`,
  );
  await pause();
  return ev(
    `(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('.score').getScreenCTM());window.scrollBy(0,p.y-innerHeight/2);const q=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('.score').getScreenCTM());return {x:q.x,y:q.y}})()`,
  );
};
const pointClick = async (point) => {
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
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
    await selectBoundary(3);
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
    await ev(`document.querySelector('#lyric-input').focus()`);
    await key('Escape');
    assert.equal(await dialog(), null);
    assert.equal(
      await ev(`document.querySelector('#lyric-input').value`),
      'Ky',
    );
    // Tail insertion does not prompt, and native Tab reaches Apply/Cancel.
    await key('Escape');
    await selectBoundary(3);
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
  for (const width of [1440, 320]) {
    await viewport(width);
    for (const position of ['mid-staff', 'trailing', 'system-leading'])
      for (const after of [false, true]) {
        const d = fixture(position === 'system-leading' ? 15 : 3);
        d.clefChanges = [
          {
            id: 'C',
            clef: { type: 'c', staffLine: 4 },
            beforeNeumeId:
              position === 'trailing'
                ? null
                : position === 'system-leading'
                  ? 'n11'
                  : 'n1',
            beforeDivisionId: null,
          },
        ];
        await mount(d);
        const old = await scoreOrder();
        const geometry = await ev(
          `(()=>{const c=document.querySelector('[data-clef-change-id]'),b=c.querySelector('path').getBBox(),s=c.closest('[data-system-index]');return {left:b.x,right:b.x+b.width,y:Number(s.querySelectorAll('.score__staff-line')[1].getAttribute('y1'))}})()`,
        );
        await click('[data-tool="punctum"]');
        assert.equal(
          await ev(`document.querySelector('.clef-change-controls').disabled`),
          true,
        );
        const point = await scorePoint(
          after ? geometry.right + 1 : geometry.left - 1,
          geometry.y,
        );
        await pointClick(point);
        const order = await scoreOrder();
        const added = order.find((id) => !old.includes(id));
        assert.ok(added);
        const at = old.indexOf('C') + Number(after);
        assert.deepEqual(order, [...old.slice(0, at), added, ...old.slice(at)]);
      }
    // Stable dropdown boundaries survive edits earlier in the score.
    const d = fixture(3);
    d.clefChanges = [
      {
        id: 'C',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'n1',
        beforeDivisionId: null,
      },
    ];
    await mount(d);
    const boundary = JSON.stringify({
      beforeNeumeId: 'n1',
      beforeDivisionId: null,
      beforeClefId: 'C',
    });
    await select('Clef insertion boundary', boundary);
    await click('[data-note-id="note0"]');
    await key('Tab');
    assert.equal(await ev(`document.activeElement.dataset.clefChangeId`), 'C');
    await key('i', 'KeyI');
    assert.match(
      await ev(`document.querySelector('.editor-announcement').textContent`),
      /Insert before clef or Insert after clef/,
    );
    assert.deepEqual(await scoreOrder(), ['n0', 'C', 'n1', 'n2']);
    await clickButton('Insert punctum before clef');
    const earlier = await scoreOrder();
    assert.equal(
      await ev(
        `document.querySelector('[aria-label="Clef insertion boundary"]').value`,
      ),
      boundary,
    );
    await clickButton('Insert clef change');
    await clickButton('Apply clef change');
    assert.equal(await dialog(), null);
    const order = await scoreOrder();
    const added = order.find((id) => !earlier.includes(id));
    assert.equal(order.indexOf(added), order.indexOf('C') - 1);
    await select('Authored clef target', '');
    assert.equal(
      await ev(
        `document.querySelector('[aria-label="Authored clef target"]').value`,
      ),
      '',
    );
    await select('Authored clef target', 'C');
    await clickButton('Delete clef change');
    if (await dialog()) await clickButton('Preserve noteheads');
    assert.equal(
      await ev(
        `document.querySelector('[aria-label="Clef insertion boundary"]').value`,
      ),
      '',
    );
    assert.match(
      await ev(
        `document.querySelector('[aria-label="Clef insertion boundary"]').selectedOptions[0].textContent`,
      ),
      /Boundary no longer exists/,
    );
    assert.equal(
      await ev(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Insert clef change').matches(':disabled')`,
      ),
      true,
    );
    await selectBoundary(0);
    // No-selection I inserts after trailing authored events.
    const tail = fixture(3);
    tail.clefChanges = [
      {
        id: 'T',
        clef: { type: 'f', staffLine: 2 },
        beforeNeumeId: null,
        beforeDivisionId: null,
      },
    ];
    await mount(tail);
    await ev(
      `(()=>{document.querySelector('.score').setAttribute('tabindex','0');document.querySelector('.score').focus();})()`,
    );
    await key('i', 'KeyI');
    const endOrder = await scoreOrder();
    assert.equal(endOrder.at(-2), 'T');
    assert.equal(endOrder.length, 5);
    // Both confirmation choices remain available when melody preservation overflows.
    const extreme = fixture(2);
    extreme.neumes[1].notes[0].staffPosition = Number.MAX_SAFE_INTEGER;
    await mount(extreme);
    await selectBoundary(1);
    const before = await ink();
    await clickButton('Insert clef change');
    await select('Draft clef staff line', '4');
    await clickButton('Apply clef change');
    assert.equal(await dialog(), 'Choose pitch preservation');
    await clickButton('Preserve melody');
    assert.equal(await dialog(), 'Choose pitch preservation');
    assert.match(
      await ev(
        `document.querySelector('[role="dialog"] [role="status"]').textContent`,
      ),
      /overflow/,
    );
    await clickButton('Preserve noteheads');
    assert.equal(await dialog(), null);
    assert.deepEqual(await ink(), before);
    // The actual SVG caret, including its cap, stays clear of the end guide.
    await mount(fixture());
    await click('[data-tool="punctum"]');
    const end = await ev(
      `(()=>{const s=document.querySelector('[data-system-index="0"]'),n=[...s.querySelectorAll('[data-neume-id]')].at(-1).querySelector('.score__ink').getBBox();return {x:n.x+n.width+16.5,y:Number(s.querySelectorAll('.score__staff-line')[1].getAttribute('y1'))}})()`,
    );
    const hover = await scorePoint(end.x, end.y);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...hover,
      button: 'left',
    });
    await pause();
    assert.equal(
      await ev(
        `(()=>{const a=document.querySelector('.score__placement-caret').getBBox(),b=document.querySelector('.score__custos').getBBox();return a.x+a.width<b.x || a.x>b.x+b.width})()`,
      ),
      true,
    );
    // An oversized syllable exposes clef ink, guide ink and an insertion target after it.
    const huge = fixture(2);
    huge.syllables = [
      {
        id: 's',
        text: 'a'.repeat(180),
        startsAtNeumeId: 'n0',
        boundaryBefore: 'word',
      },
    ];
    huge.clefChanges = [
      {
        id: 'C',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'n1',
        beforeDivisionId: null,
      },
    ];
    await mount(huge);
    const ext = await ev(
      `(()=>{const c=document.querySelector('[data-clef-change-id]'),s=c.closest('[data-system-index]'),b=c.querySelector('path').getBBox(),g=s.querySelector('.score__custos').getBBox(),end=Number(s.querySelector('.score__staff-line').getAttribute('x2'));return {left:b.x,right:b.x+b.width,guideRight:g.x+g.width,end,y:Number(s.querySelectorAll('.score__staff-line')[1].getAttribute('y1'))}})()`,
    );
    assert.ok(ext.end > ext.right && ext.end > ext.guideRight);
    await click('[data-tool="punctum"]');
    const point = await scorePoint(ext.right + 1, ext.y, true);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...point,
      button: 'left',
    });
    await pause();
    assert.equal(
      await ev(`!!document.querySelector('.score__placement-caret')`),
      true,
    );
    await pointClick(point);
    assert.equal((await scoreOrder()).length, 4);
    await key('Escape');
    await shot(`${width}-review-oversized`);
    // Division-leading wrap: one outgoing guide for the pending transition.
    const mixed = fixture(2);
    mixed.divisions = Array.from({ length: 30 }, (_, i) => ({
      id: `D${i}`,
      kind: 'minor',
      beforeNeumeId: 'n1',
    }));
    mixed.clefChanges = [
      {
        id: 'C',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'n1',
        beforeDivisionId: 'D29',
      },
    ];
    await mount(mixed);
    assert.equal(
      await ev(
        `document.querySelector('[data-system-index="0"]').querySelectorAll('.score__custos').length`,
      ),
      1,
    );
    assert.equal(
      await ev(
        `document.querySelector('[data-system-index="1"]').querySelectorAll('.score__custos').length`,
      ),
      0,
    );
    await shot(`${width}-review-division-leading`);
  }
  console.log(
    'PASS: review regressions — graphical clef sides, oversized reachability, escaped-dialog Escape, stable dropdown boundaries, explicit I feedback/end fallback, placement guards, target clearing, pitch-policy overflow, and duplicate guide suppression.',
  );
  console.log(
    `PASS: Stage 6B ${firefox ? 'Firefox (HTML activation via pointer)' : 'Chromium'} pointer/keyboard insertion, staged drafts, pitch choices, cancellation, history, focus, dirty lyrics, narrow layout and engraving. Screenshots: ${output}`,
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
