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
      m.error || m.type === 'error'
        ? reject(Error(JSON.stringify(m.error)))
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
        ArrowLeft: '\uE012',
        ArrowRight: '\uE014',
        Home: '\uE011',
        End: '\uE010',
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
        ArrowLeft: 37,
        ArrowRight: 39,
        Home: 36,
        End: 35,
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
const shot = async (name, preserveView = false) => {
  if (!preserveView)
    await ev(
      `document.querySelector('.score').scrollIntoView({block:'center'})`,
    );
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
const offset = (type, line) => (type === 'c' ? 0 : 3) - 2 * (line - 1);
const layoutFor = (d) => ev(`clefLayout(${JSON.stringify(d)})`);
const boundarySlot = async (d, boundary) => {
  const l = await layoutFor(d);
  const found = l.systems
    .flatMap((s) => s.slots.map((slot) => ({ slot, system: s })))
    .findLast(
      ({ slot }) => JSON.stringify(slot.boundary) === JSON.stringify(boundary),
    );
  assert.ok(found, 'Missing test slot');
  return found;
};
const move = async (point) => {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    ...point,
    button: 'left',
  });
  await pause();
};
const hoverSlot = async (d, boundary, line) => {
  const { slot, system } = await boundarySlot(d, boundary);
  const point = await scorePoint(slot.x, system.staffLines[line - 1].y, true);
  await move(point);
  const shown = await ev(
    `(()=>{const e=document.querySelector('.score__clef-placement-preview');return e?{type:e.dataset.clefType,line:Number(e.dataset.staffLine),x:Number(e.querySelector('line').getAttribute('x1')),pointer:e.getAttribute('pointer-events')}:null})()`,
  );
  assert.ok(shown, 'Expected clef ghost');
  assert.equal(shown.line, line);
  assert.equal(shown.x, slot.x);
  assert.equal(shown.pointer, 'none');
  return point;
};
const end = { beforeNeumeId: null, beforeDivisionId: null, beforeClefId: null };
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
  await ev(
    `(async()=>{window.clefLayout=(await import('/src/editor/layout/layout-chant.ts')).layoutChant;})()`,
  );
  for (const width of [1440, 320]) {
    await viewport(width);
    for (const preserve of ['melody', 'noteheads'])
      for (const type of ['c', 'f'])
        for (const line of [1, 2, 3, 4]) {
          const d = fixture(3);
          await mount(d);
          assert.equal(
            await ev(
              `!!document.querySelector('[aria-label="Clef insertion boundary"]')`,
            ),
            false,
          );
          const original = await ink();
          await click(`[data-tool="${type}-clef"]`);
          assert.equal(
            await ev(
              `document.querySelector('input[name="clef-insertion-policy"]:checked').value`,
            ),
            'melody',
          );
          await click(
            `input[name="clef-insertion-policy"][value="${preserve}"]`,
          );
          const boundary = {
            beforeNeumeId: 'n1',
            beforeDivisionId: null,
            beforeClefId: null,
          };
          const point = await hoverSlot(d, boundary, line);
          assert.deepEqual(await ink(), original);
          assert.equal((await clefIds()).length, 0);
          assert.equal(
            await ev(
              `document.querySelector('.score__clef-placement-preview').dataset.clefType`,
            ),
            type,
          );
          if (line === 4)
            await shot(`${width}-${type}-${preserve}-ghost`, true);
          await pointClick(point);
          const delta = -4 - offset(type, line);
          assert.equal(await dialog(), null);
          assert.equal((await clefIds()).length, 1);
          const placed = await ev(
            `(()=>{const e=document.querySelector('[data-clef-change-id]');return e.getAttribute('aria-label')})()`,
          );
          assert.ok(placed.includes(`staff line ${line}`));
          assert.ok(placed.includes(type.toUpperCase()));
          const after = await ink();
          assert.equal(after[0].y, original[0].y);
          for (let i = 1; i < 3; i++)
            assert.equal(
              after[i].y,
              original[i].y - (preserve === 'noteheads' ? 0 : delta * 12),
            );
          assert.equal(
            await ev(
              `document.querySelector('[data-tool="${type}-clef"]').getAttribute('aria-pressed')`,
            ),
            'true',
          );
          if (line === 4) await shot(`${width}-${type}-${preserve}-inserted`);
          await key('z', 'KeyZ', 2);
          assert.equal((await clefIds()).length, 0);
          assert.deepEqual(await ink(), original);
          await key('z', 'KeyZ', 10);
          assert.equal((await clefIds()).length, 1);
          assert.deepEqual(await ink(), after);
          assert.equal(await dialog(), null);
          await key('Escape');
          assert.equal(
            await ev(
              `document.querySelector('[data-tool="select"]').getAttribute('aria-pressed')`,
            ),
            'true',
          );
        }
    // Retain the selected behavior across C/F and repeat affected insertions.
    await mount(fixture(3));
    await click('[data-tool="c-clef"]');
    await click('input[name="clef-insertion-policy"][value="noteheads"]');
    for (const [index, type] of ['c', 'f', 'c'].entries()) {
      await click(`[data-tool="${type}-clef"]`);
      assert.equal(
        await ev(
          `document.querySelector('input[name="clef-insertion-policy"]:checked').value`,
        ),
        'noteheads',
      );
      const ids = await clefIds();
      const d = {
        ...fixture(3),
        clefChanges: ids.map((id, i) => ({
          id,
          clef: { type: i === 1 ? 'f' : 'c', staffLine: 4 },
          beforeNeumeId: 'n1',
          beforeDivisionId: null,
        })),
      };
      const p = await hoverSlot(
        d,
        { beforeNeumeId: 'n1', beforeDivisionId: null, beforeClefId: null },
        4,
      );
      await pointClick(p);
      assert.equal(await dialog(), null);
      assert.equal((await clefIds()).length, index + 1);
    }
    // Exact before/after slots around consecutive authored changes and adjacent bars.
    const mixed = fixture(3);
    mixed.divisions = [
      { id: 'D1', kind: 'minor', beforeNeumeId: 'n1' },
      { id: 'D2', kind: 'finalis', beforeNeumeId: 'n1' },
    ];
    mixed.clefChanges = [
      {
        id: 'C1',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'n1',
        beforeDivisionId: 'D1',
      },
      {
        id: 'C2',
        clef: { type: 'f', staffLine: 2 },
        beforeNeumeId: 'n1',
        beforeDivisionId: null,
      },
    ];
    const walk = ['n0', 'C1', 'D1', 'D2', 'C2', 'n1', 'n2'];
    for (const boundary of [
      { beforeNeumeId: 'n0', beforeDivisionId: null, beforeClefId: null },
      { beforeNeumeId: 'n1', beforeDivisionId: 'D1', beforeClefId: 'C1' },
      { beforeNeumeId: 'n1', beforeDivisionId: 'D1', beforeClefId: null },
      { beforeNeumeId: 'n1', beforeDivisionId: 'D2', beforeClefId: null },
      { beforeNeumeId: 'n1', beforeDivisionId: null, beforeClefId: 'C2' },
      { beforeNeumeId: 'n1', beforeDivisionId: null, beforeClefId: null },
      end,
    ]) {
      await mount(mixed);
      await click('[data-tool="f-clef"]');
      const point = await hoverSlot(mixed, boundary, 3);
      await pointClick(point);
      assert.equal(await dialog(), null);
      const order = await scoreOrder(),
        id = order.find((id) => !walk.includes(id));
      assert.ok(id);
      const following =
        boundary.beforeClefId ??
        boundary.beforeDivisionId ??
        boundary.beforeNeumeId;
      const index = following ? walk.indexOf(following) : walk.length;
      assert.deepEqual(order, [
        ...walk.slice(0, index),
        id,
        ...walk.slice(index),
      ]);
    }
    // Wrapping and continuation-side insertion retain the previewed semantic slot.
    const wrapped = fixture(25);
    wrapped.clefChanges = [
      {
        id: 'C',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'n11',
        beforeDivisionId: null,
      },
    ];
    await mount(wrapped);
    await click('[data-tool="c-clef"]');
    const boundary = {
      beforeNeumeId: 'n11',
      beforeDivisionId: null,
      beforeClefId: 'C',
    };
    const point = await hoverSlot(wrapped, boundary, 2);
    await pointClick(point);
    assert.equal(await dialog(), null);
    assert.equal((await clefIds()).length, 2);
    const wrappedIds = await clefIds();
    assert.notEqual(wrappedIds[0], 'C');
    await shot(`${width}-wrapped-clef`);
    // Contextual edit: no global target picker, transient draft, one final policy.
    await key('Escape');
    const id = (await clefIds()).find((id) => id !== 'C');
    await click(`[data-clef-change-id="${id}"]`);
    assert.equal(
      await ev(`!!document.querySelector('[aria-label="Selected clef"]')`),
      true,
    );
    await clickButton('Edit clef change');
    const committed = await ink();
    await select('Draft clef type', 'f');
    await select('Draft clef staff line', '3');
    await select('Draft clef staff line', '1');
    assert.deepEqual(await ink(), committed);
    assert.equal(
      await ev(`!!document.querySelector('.score__clef-draft-preview')`),
      true,
    );
    await shot(`${width}-selected-clef-draft`);
    await clickButton('Cancel clef change');
    assert.deepEqual(await ink(), committed);
    assert.equal(await ev(`document.activeElement.dataset.clefChangeId`), id);
    await click('[data-clef-change-id="C"]');
    await key('ArrowDown');
    assert.equal(
      await ev(`!!document.querySelector('[aria-label="Edit selected clef"]')`),
      true,
    );
    await select('Draft clef type', 'f');
    await click('input[name="clef-insertion-policy"][value="noteheads"]');
    await shot(`${width}-shared-edit-draft`, true);
    await clickButton('Apply clef change');
    assert.equal(await dialog(), null);
    await shot(`${width}-shared-edit-applied`, true);
    assert.deepEqual(await ink(), committed);
    assert.equal(await ev(`document.activeElement.dataset.clefChangeId`), 'C');
    // Existing edits use the shared selected mode once on Apply, scoped to the passage.
    for (const preserve of ['melody', 'noteheads']) {
      const d = fixture(5);
      d.clefChanges = [
        {
          id: 'edit',
          clef: { type: 'c', staffLine: 3 },
          beforeNeumeId: 'n1',
          beforeDivisionId: null,
        },
        {
          id: 'later',
          clef: { type: 'f', staffLine: 3 },
          beforeNeumeId: 'n3',
          beforeDivisionId: null,
        },
      ];
      await mount(d);
      const original = await ink();
      await click('[data-clef-change-id="edit"]');
      assert.equal(
        await ev(`!!document.querySelector('.clef-insertion-behavior')`),
        true,
      );
      await click(`input[name="clef-insertion-policy"][value="${preserve}"]`);
      await key('Tab');
      await ev(
        `document.querySelector('[data-clef-change-id="edit"]').focus()`,
      );
      await key('ArrowDown');
      await select('Draft clef type', 'f');
      await select('Draft clef staff line', '2');
      assert.deepEqual(await ink(), original);
      assert.equal(
        await ev(
          `document.querySelector('input[name="clef-insertion-policy"]:checked').disabled`,
        ),
        false,
      );
      await shot(`${width}-shared-${preserve}-draft`, true);
      await clickButton('Apply clef change');
      assert.equal(await dialog(), null);
      const after = await ink();
      for (let i = 0; i < 5; i++)
        assert.equal(
          after[i].y,
          original[i].y +
            (preserve === 'melody' && (i === 1 || i === 2) ? 60 : 0),
        );
      await shot(`${width}-shared-${preserve}-applied`, true);
      await key('z', 'KeyZ', 2);
      assert.deepEqual(await ink(), original);
      await key('z', 'KeyZ', 10);
      assert.deepEqual(await ink(), after);
      assert.equal(await dialog(), null);
      // Final no-op returns without history; mode persists into placement.
      await clickButton('Edit clef change');
      await select('Draft clef type', 'c');
      await select('Draft clef type', 'f');
      await clickButton('Apply clef change');
      await key('z', 'KeyZ', 2);
      assert.deepEqual(await ink(), original);
      await key('z', 'KeyZ', 10);
      assert.deepEqual(await ink(), after);
      await click('[data-tool="c-clef"]');
      assert.equal(
        await ev(
          `document.querySelector('input[name="clef-insertion-policy"]:checked').value`,
        ),
        preserve,
      );
      // Deletion is still conditional, independent of the shared mode.
      await key('Escape');
      await click('[data-clef-change-id="edit"]');
      await clickButton('Delete clef change');
      assert.equal(await dialog(), 'Choose pitch preservation');
      await shot(`${width}-deletion-choice`, true);
      await clickButton('Cancel clef change');
      assert.deepEqual(await ink(), after);
      assert.equal(
        await ev(`document.documentElement.scrollWidth<=innerWidth`),
        true,
      );
    }
    // Out-of-band hover/click is inert; changing tools and Escape remove the ghost.
    await mount(fixture(3));
    await click('[data-tool="c-clef"]');
    await hoverSlot(fixture(3), end, 3);
    const outside = await scorePoint(300, 160);
    await move(outside);
    assert.equal(
      await ev(`!!document.querySelector('.score__clef-placement-preview')`),
      false,
    );
    await pointClick(outside);
    assert.equal((await clefIds()).length, 0);
    await hoverSlot(fixture(3), end, 3);
    await click('[data-tool="punctum"]');
    assert.equal(
      await ev(`!!document.querySelector('.score__clef-placement-preview')`),
      false,
    );
    // Cancellation preserves redo and a native dirty lyric draft through arming.
    await mount(fixture(3));
    await click('[data-note-id="note1"]');
    await key('l', 'KeyL');
    await send('Input.insertText', { text: 'Ky' });
    await pause();
    await click('[data-tool="c-clef"]');
    const affectedPoint = await hoverSlot(
      fixture(3),
      { beforeNeumeId: 'n1', beforeDivisionId: null, beforeClefId: null },
      4,
    );
    await pointClick(affectedPoint);
    assert.equal(await dialog(), null);
    assert.equal((await clefIds()).length, 1);
    await key('Escape');
    await click('[data-clef-change-id]');
    await clickButton('Edit clef change');
    await select('Draft clef staff line', '1');
    assert.equal(await dialog(), null);
    await ev(`document.querySelector('#lyric-input').focus()`);
    await key('Escape');
    assert.equal(await dialog(), null);
    assert.equal(
      await ev(`document.querySelector('#lyric-input').value`),
      'Ky',
    );
    assert.equal((await clefIds()).length, 1);
    await click('[data-tool="c-clef"]');
    await key('Escape');
    assert.equal(
      await ev(
        `document.querySelector('[data-tool="select"]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    assert.equal(
      await ev(`document.querySelector('#lyric-input').value`),
      'Ky',
    );
    // Roving toolbar and a fully keyboard-operated slot/line route.
    await mount(fixture(3));
    await ev(`document.querySelector('[data-tool="select"]').focus()`);
    await key('End');
    assert.equal(await ev(`document.activeElement.dataset.tool`), 'f-clef');
    await key('ArrowLeft');
    assert.equal(await ev(`document.activeElement.dataset.tool`), 'c-clef');
    if (firefox) await clickButton('C clef');
    else await key('Enter');
    assert.equal(
      await ev(
        `document.querySelector('[data-tool="c-clef"]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    for (let i = 0; i < 40; i++) {
      if (
        await ev(
          `document.activeElement.textContent.trim()==='Place clef with keyboard'`,
        )
      )
        break;
      await key('Tab');
    }
    assert.equal(
      await ev(`document.activeElement.textContent.trim()`),
      'Place clef with keyboard',
    );
    if (firefox) await clickButton('Place clef with keyboard');
    else await key('Enter');
    assert.equal(await ev(`document.activeElement.matches('.score')`), true);
    await key('End');
    await key('ArrowDown');
    await key('ArrowDown');
    assert.equal(
      await ev(
        `document.querySelector('.score__clef-placement-preview').dataset.staffLine`,
      ),
      '1',
    );
    await key('Enter');
    assert.equal((await clefIds()).length, 1);
    assert.equal(await dialog(), null);
    assert.equal(await ev(`document.activeElement.matches('.score')`), true);
    await key('Escape');
    // I still inserts the remembered neume, never a clef.
    await click('[data-tool="select"]');
    await click('.score');
    await click('[data-tool="podatus"]');
    await click('[data-tool="f-clef"]');
    await ev(`document.querySelector('.score').focus()`);
    await key('i', 'KeyI');
    assert.equal((await clefIds()).length, 1);
    assert.equal((await scoreOrder()).length, 5);
    assert.equal(
      await ev(`document.documentElement.scrollWidth<=innerWidth`),
      true,
    );
  }
  // Native radio arrows select the same policy used by score keyboard insertion.
  await viewport(1440);
  await mount(fixture(3));
  const keyboardOriginal = await ink();
  await click('[data-tool="c-clef"]');
  await click('input[name="clef-insertion-policy"][value="melody"]');
  await key('ArrowRight');
  assert.equal(
    await ev(
      `document.querySelector('input[name="clef-insertion-policy"]:checked').value`,
    ),
    'noteheads',
  );
  await clickButton('Place clef with keyboard');
  await key('ArrowRight');
  await key('ArrowUp');
  await key('Enter');
  assert.equal(await dialog(), null);
  assert.equal((await clefIds()).length, 1);
  assert.deepEqual(await ink(), keyboardOriginal);
  // A DOM double-click continuation must not insert a second authored event.
  await ev(
    `document.querySelector('.score').dispatchEvent(new MouseEvent('click', {bubbles:true,detail:2}))`,
  );
  assert.equal((await clefIds()).length, 1);
  // An unsafe Keep pitches request rejects without a dialog or policy fallback.
  await viewport(1440);
  const unsafe = fixture(1);
  unsafe.neumes[0].notes[0].staffPosition = Number.MAX_SAFE_INTEGER;
  await mount(unsafe);
  await click('[data-tool="c-clef"]');
  await clickButton('Place clef with keyboard');
  await key('ArrowUp');
  await key('Enter');
  assert.equal(await dialog(), null);
  assert.equal((await clefIds()).length, 0);
  assert.equal(
    await ev(
      `document.querySelector('input[name="clef-insertion-policy"]:checked').value`,
    ),
    'melody',
  );
  assert.match(
    await ev(
      `document.querySelector('.clef-insertion-behavior [role="status"]').textContent`,
    ),
    /overflow/,
  );
  await click('input[name="clef-insertion-policy"][value="noteheads"]');
  await clickButton('Place clef with keyboard');
  await key('Enter');
  assert.equal(await dialog(), null);
  assert.equal((await clefIds()).length, 1);
  // Failed edit stays a nonmodal draft and accepts an explicit policy change/retry.
  const unsafeEdit = fixture(2);
  unsafeEdit.neumes[1].notes[0].staffPosition = Number.MAX_SAFE_INTEGER;
  unsafeEdit.clefChanges = [
    {
      id: 'unsafe-edit',
      clef: { type: 'c', staffLine: 3 },
      beforeNeumeId: 'n1',
      beforeDivisionId: null,
    },
  ];
  await mount(unsafeEdit);
  await click('[data-clef-change-id="unsafe-edit"]');
  await key('ArrowUp');
  await clickButton('Apply clef change');
  assert.equal(await dialog(), null);
  assert.equal(
    await ev(`!!document.querySelector('[aria-label="Edit selected clef"]')`),
    true,
  );
  assert.match(
    await ev(
      `document.querySelector('[aria-label="Edit selected clef"] [role="status"]').textContent`,
    ),
    /overflow/,
  );
  assert.match(
    await ev(
      `document.querySelector('[data-clef-change-id]').getAttribute('aria-label')`,
    ),
    /staff line 3/,
  );
  await shot('shared-edit-overflow', true);
  await click('input[name="clef-insertion-policy"][value="noteheads"]');
  await clickButton('Apply clef change');
  assert.equal(await dialog(), null);
  assert.match(
    await ev(
      `document.querySelector('[data-clef-change-id]').getAttribute('aria-label')`,
    ),
    /staff line 4/,
  );
  for (const width of [1440, 320]) {
    await viewport(width);
    await mount(fixture(3));
    await ev(`(()=>{document.querySelector('main').style.zoom='1.5';})()`);
    await pause();
    await click('[data-tool="f-clef"]');
    await click('input[name="clef-insertion-policy"][value="noteheads"]');
    const point = await hoverSlot(
      fixture(3),
      { beforeNeumeId: 'n1', beforeDivisionId: null, beforeClefId: null },
      4,
    );
    await pointClick(point);
    assert.equal(await dialog(), null);
    const ids = await clefIds();
    assert.equal(ids.length, 1);
    assert.deepEqual(await scoreOrder(), ['n0', ids[0], 'n1', 'n2']);
    assert.match(
      await ev(
        `document.querySelector('[data-clef-change-id]').getAttribute('aria-label')`,
      ),
      /F .*staff line 4/,
    );
    await ev(`(()=>{document.querySelector('main').style.zoom='';})()`);
  }
  console.log(
    `PASS: graphical C/F hover/snap/click, preselected one-click policies and exact history, mixed slots, wrapping, shared-mode staged Apply without popup and separate deletion confirmation, rejection/cancellation, dirty lyrics, native toolbar and keyboard-only insertion, I, desktop/320px and 150% CSS zoom. Browser: ${firefox ? 'Firefox (HTML activation via pointer; native score keyboard)' : 'Chromium (including keyboard-only HTML activation)'}. Screenshots: ${output}`,
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
