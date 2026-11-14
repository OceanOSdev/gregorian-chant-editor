import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const screenshotDirectory = await mkdtemp(join(tmpdir(), 'chant-divisions-'));
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
          expression: `(async()=>JSON.stringify(await (${params.expression})))()`,
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

  const fixture = (count = 2) => ({
    title: 'Stage 5B — divisions',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: 2 }],
    })),
    clefChanges: [],
    divisions: [
      { id: 'D', kind: 'minima', beforeNeumeId: count > 1 ? 'n1' : null },
    ],
    syllables:
      count > 1
        ? [
            {
              id: 's0',
              text: 'Al',
              startsAtNeumeId: 'n0',
              boundaryBefore: 'word',
            },
            {
              id: 's1',
              text: 'le',
              startsAtNeumeId: 'n1',
              boundaryBefore: 'continuation',
            },
          ]
        : [],
  });
  await ev(
    `(async()=>{const l=await import('/src/editor/layout/layout-chant.ts');const m=await import('/src/editor/rendering/use-lyric-measurement.ts');window.divisionLayout=doc=>l.layoutChant(doc,m.createSvgLyricMeasurer());return true})()`,
  );
  const nativeClick = async (selector) => {
    const p = await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const v=document.querySelector('.score-viewport');let b=e.getBoundingClientRect();if(v&&e.closest('.score')){const vb=v.getBoundingClientRect();v.scrollLeft+=b.x+b.width/2-vb.x-vb.width/2;b=e.getBoundingClientRect();}return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
    );
    await clickPoint(p);
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
  const scorePoint = async (x, y) =>
    ev(
      `(()=>{document.querySelector('.score').scrollIntoView({block:'center'});const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('.score').getScreenCTM());return {x:p.x,y:p.y}})()`,
    );
  const clickText = async (text) => {
    const p = await ev(
      `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error(${JSON.stringify(text)});e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
    );
    await clickPoint(p);
  };
  const choose = async (label, value) => {
    await ev(
      `(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`,
    );
    await pause();
  };
  const key = async (name) => {
    if (firefox) {
      const value =
        {
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
              { type: 'keyDown', value },
              { type: 'keyUp', value },
            ],
          },
        ],
      });
    } else
      for (const type of ['keyDown', 'keyUp'])
        await send('Input.dispatchKeyEvent', {
          type,
          key: name,
          code: name,
          ...(name === 'Enter' && type === 'keyDown' ? { text: '\r' } : {}),
          windowsVirtualKeyCode:
            { Escape: 27, Enter: 13, Delete: 46, Backspace: 8, Tab: 9 }[name] ??
            name.toUpperCase().charCodeAt(0),
        });
    await pause();
  };
  const order = () =>
    ev(
      `Array.from(document.querySelectorAll('[data-neume-id], [data-division-id]')).map(e=>e.getAttribute('data-neume-id')??e.getAttribute('data-division-id'))`,
    );
  const focus = async (selector) => {
    await ev(
      `(document.querySelector(${JSON.stringify(selector)}).focus(),true)`,
    );
    await pause();
  };
  const focused = () =>
    ev(`document.activeElement?.getAttribute('data-division-id')`);
  for (const width of [1440, 320]) {
    await viewport(width);
    for (const side of ['before', 'after']) {
      const d = fixture();
      await mount(d);
      await clickText('Punctum');
      const slot = await ev(
        `divisionLayout(${JSON.stringify(d)}).systems[0].slots[${side === 'before' ? 1 : 2}]`,
      );
      const p = await scorePoint(slot.x, 100);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
      await pause();
      assert.equal(
        await ev(
          `Number(document.querySelector('.score__placement-caret line').getAttribute('x1'))`,
        ),
        slot.x,
      );
      await clickPoint(p);
      const actual = await order();
      assert.equal(actual.length, 4);
      assert.equal(actual.indexOf('D'), side === 'before' ? 2 : 1);
      assert.deepEqual(
        await ev(
          `Array.from(document.querySelectorAll('.score__lyric')).map(e=>e.dataset.syllableId)`,
        ),
        ['s0', 's1'],
      );
      assert.equal(
        await ev(
          `document.querySelector('button[data-tool="punctum"]').getAttribute('aria-pressed')`,
        ),
        'true',
      );
      assert.equal(
        await ev(
          `document.querySelector('.score__placement-preview')?.getAttribute('pointer-events')??'none'`,
        ),
        'none',
      );
      await key('Escape');
      await clickText('Undo');
      assert.deepEqual(await order(), ['n0', 'D', 'n1']);
      await clickText('Redo');
      assert.equal((await order()).length, 4);
    }
    for (const side of ['before', 'after']) {
      await mount(fixture());
      await focus('[data-division-id="D"]');
      await key('Enter');
      await clickText(`Insert Punctum ${side} division`);
      const actual = await order();
      assert.equal(actual.indexOf('D'), side === 'before' ? 2 : 1);
    }
    // Stage 5C: native Tab to explicit sides; Chromium also activates with Enter.
    for (const side of ['before', 'after']) {
      await mount(fixture());
      await focus('[data-division-id="D"]');
      await key('Enter');
      await focus('select[aria-label="Change division kind"]');
      await key('Tab');
      if (side === 'after') await key('Tab');
      assert.equal(
        await ev(`document.activeElement.textContent.trim()`),
        `Insert Punctum ${side} division`,
      );
      // Firefox headless changes activeElement but does not activate this HTML
      // button with BiDi Return/Enter in this environment; retain foreground acceptance.
      if (firefox) continue;
      await key('Enter');
      const actual = await order();
      assert.equal(actual.length, 4, `Keyboard insertion ${side} division`);
      assert.equal(actual.indexOf('D'), side === 'before' ? 2 : 1);
      await clickText('Undo');
      assert.deepEqual(await order(), ['n0', 'D', 'n1']);
    }
    await mount(fixture());
    await nativeClick('[data-division-id="D"]');
    assert.equal(await focused(), 'D');
    await choose('Change division kind', 'finalis');
    assert.equal(
      await ev(
        `document.querySelector('[data-division-id="D"]').getAttribute('data-division-kind')`,
      ),
      'finalis',
    );
    assert.equal(
      await ev(
        `document.querySelectorAll('[data-division-id="D"] .score__division-ink line').length`,
      ),
      2,
    );
    await clickText('Undo');
    assert.equal(await focused(), 'D');
    assert.equal(
      await ev(
        `document.querySelector('[data-division-id="D"]').getAttribute('data-division-kind')`,
      ),
      'minima',
    );
    await clickText('Redo');
    assert.equal(await focused(), 'D');
    await key('Delete');
    assert.deepEqual(await order(), ['n0', 'n1']);
    await clickText('Undo');
    assert.deepEqual(await order(), ['n0', 'D', 'n1']);
    await focus('[data-division-id="D"]');
    await key('Enter');
    await focus('[data-note-id="note0"]');
    await key('Tab');
    assert.equal(await focused(), 'D');
    assert.equal(
      await ev(
        `document.querySelector('[data-division-id="D"]').getAttribute('aria-pressed')`,
      ),
      'true',
    );
    await key('Tab');
    assert.equal(
      await ev(`document.activeElement.getAttribute('data-note-id')`),
      'note1',
    );
    await focus('[data-division-id="D"]');
    await key('Backspace');
    assert.deepEqual(await order(), ['n0', 'n1']);
    await mount(fixture());
    for (const kind of ['minima', 'minor', 'maior', 'finalis']) {
      await choose('Division placement kind', kind);
      await clickText('Place division');
      const p = await scorePoint(450, 100);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
      await pause();
      assert.equal(
        await ev(
          `document.querySelectorAll('.score__placement-ghost .score__division-ink line').length`,
        ),
        kind === 'finalis' ? 2 : 1,
      );
      assert.equal(
        await ev(
          `document.querySelectorAll('.score__placement-preview [tabindex]').length`,
        ),
        0,
      );
      await clickPoint(p);
      assert.equal(
        await ev(
          `document.querySelector('button[data-tool="punctum"]').getAttribute('aria-pressed')`,
        ),
        'false',
      );
      await key('Escape');
    }
    assert.equal((await order()).length, 7);
    assert.equal(
      await ev(
        `document.querySelector('.score__division').getAttribute('role')`,
      ),
      'button',
    );
    assert.equal(
      await ev(
        `document.querySelector('button.editor-insert').textContent.includes('Punctum')`,
      ),
      true,
    );
    await shot(`four-kinds-${width}`);
    assert.equal(
      await ev(`document.documentElement.scrollWidth <= innerWidth`),
      true,
    );
  }
  for (const count of [0, 1, 20]) {
    const d = fixture(count);
    d.syllables = [];
    d.divisions = [
      { id: 'a', kind: 'minima', beforeNeumeId: d.neumes[0]?.id ?? null },
      { id: 'b', kind: 'minor', beforeNeumeId: d.neumes[0]?.id ?? null },
      { id: 'z', kind: 'finalis', beforeNeumeId: null },
    ];
    await mount(d);
    const expected = count
      ? ['a', 'b', ...d.neumes.map((n) => n.id), 'z']
      : ['a', 'b', 'z'];
    assert.deepEqual(await order(), expected);
    for (const id of ['a', 'b', 'z']) {
      await focus(`[data-division-id="${id}"]`);
      assert.equal(await focused(), id);
    }
    await shot(`leading-trailing-${count}`);
  }
  // Real measured outgoing mark, reflow, font changes and exceptional scrolling.
  const d = fixture(20);
  d.divisions = [{ id: 'D', kind: 'finalis', beforeNeumeId: 'n10' }];
  d.syllables[1].startsAtNeumeId = 'n19';
  await mount(d);
  await focus('[data-division-id="D"]');
  await ev(`document.querySelector('main').style.zoom='1.5'`);
  await pause();
  assert.equal(await focused(), 'D');
  assert.equal(
    await ev(`document.querySelectorAll('[data-outgoing="true"]').length>0`),
    true,
  );
  await shot('outgoing-zoom');
  await ev(`document.querySelector('main').style.zoom=''`);
  const wide = fixture();
  wide.syllables[0].text = 'a'.repeat(180);
  await mount(wide);
  assert.equal(
    await ev(
      `document.querySelector('.score-viewport').scrollWidth>document.querySelector('.score-viewport').clientWidth`,
    ),
    true,
  );
  assert.equal(
    await ev(`document.documentElement.scrollWidth<=innerWidth`),
    true,
  );
  await nativeClick('[data-division-id="D"]');
  assert.equal(await focused(), 'D');
  await shot('oversized-scrolled');
  // PR #48: measured glyph extents must clear both sides of each bar.
  for (const width of [1440, 320]) {
    await viewport(width);
    for (const boundaryBefore of ['word', 'continuation']) {
      for (const [before, after] of [
        [35, 2],
        [2, 35],
        [50, 50],
        [180, 180],
      ]) {
        const doc = fixture(3);
        doc.syllables[0].text = 'a'.repeat(before);
        doc.syllables[1].text = 'a'.repeat(after);
        doc.syllables[1].boundaryBefore = boundaryBefore;
        await mount(doc);
        const clearance = await ev(`(()=>{
          const bar = document.querySelector('[data-division-id="D"]');
          const system = bar.closest('[data-system-index]');
          const ink = bar.querySelector('.score__division-ink').getBBox();
          const source = system.querySelector('[data-syllable-id="s0"]');
          const target = system.querySelector('[data-syllable-id="s1"]');
          const a=source?.getBBox(), b=target?.getBBox();
          return { before: a ? ink.x-.75-a.x-a.width : null, after: b ? b.x-ink.x-ink.width-.75 : null, contained: document.documentElement.scrollWidth<=innerWidth };
        })()`);
        if (clearance.before !== null)
          assert(clearance.before >= 15.9, JSON.stringify(clearance));
        if (clearance.after !== null)
          assert(clearance.after >= 15.9, JSON.stringify(clearance));
        assert(clearance.contained);
        assert.deepEqual(await order(), ['n0', 'D', 'n1', 'n2']);
        if (
          boundaryBefore === 'word' &&
          ((before === 35 && after === 2) || (before === 2 && after === 35))
        )
          await shot(
            `review-${before > after ? 'preceding' : 'following'}-${width}`,
          );
      }
    }
    // Explicit sides still work beside an oversized lyric's extended staff.
    for (const side of ['before', 'after']) {
      const doc = fixture();
      doc.syllables[0].text = 'a'.repeat(180);
      await mount(doc);
      await clickText('Punctum');
      const target = await ev(
        `(()=>{const l=divisionLayout(${JSON.stringify(doc)});const s=l.systems[0];const b=s.divisions[0];return {x:${side === 'before' ? 'b.bounds.x-1' : 'b.bounds.x+b.bounds.width+1'},y:s.staffLines[1].y,caret:s.slots[${side === 'before' ? 1 : 2}].x}})()`,
      );
      const p = await ev(
        `(()=>{const svg=document.querySelector('.score'),v=document.querySelector('.score-viewport');let p=new DOMPoint(${target.x},${target.y}).matrixTransform(svg.getScreenCTM());const r=v.getBoundingClientRect();v.scrollLeft+=p.x-r.x-r.width/2;p=new DOMPoint(${target.x},${target.y}).matrixTransform(svg.getScreenCTM());window.scrollBy(0,p.y-innerHeight/2);p=new DOMPoint(${target.x},${target.y}).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y}})()`,
      );
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
      await pause();
      assert.equal(
        await ev(
          `Number(document.querySelector('.score__placement-caret line').getAttribute('x1'))`,
        ),
        target.caret,
      );
      await clickPoint(p);
      assert.equal((await order()).indexOf('D'), side === 'before' ? 2 : 1);
      await shot(`review-clearance-${width}-${side}`);
    }
  }
  console.log(
    firefox
      ? 'PASS: native Tab reaches both explicit insertion-side buttons. NOT RUN: Firefox headless HTML Enter activation; owner foreground check pending.'
      : 'PASS: native Tab/Enter inserts on both explicit division sides and Undo restores order at desktop/320px.',
  );
  console.log(
    'PASS: PR #48 measured glyph/bar clearance on both sides, continuing/distinct words, oversized wrapping and native scrolled insertion sides.',
  );
  console.log(
    'PASS: division pointer caret/commit sides, explicit insertion buttons, persistent four-kind tools, selection/focus/kind/deletion/history, native Tab, leading/adjacent/trailing/empty and multi-system scores, 320px containment, zoom and exceptional scrolling.',
  );
} finally {
  if (ownsSession) await rawSend('session.end').catch(() => {});
  ws.close();
}
