// Contextual note/accidental toolbars under CSS zoom versus real page zoom
// (issue #112). Native pointer and keyboard input only; no app internals.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const screenshotDirectory = await mkdtemp(join(tmpdir(), 'chant-zoom-tools-'));
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
  const ev = async (expression) => {
    if (firefox) {
      const r = await rawSend('script.evaluate', {
        expression: `(async()=>JSON.stringify(await (0,eval)(${JSON.stringify(expression)})))()`,
        target: { context },
        awaitPromise: true,
      });
      if (r.type === 'exception') throw Error(JSON.stringify(r));
      return r.result.value === undefined
        ? undefined
        : JSON.parse(r.result.value);
    }
    const r = await rawSend('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const pause = () => new Promise((r) => setTimeout(r, 100));
  const viewport = ({ width, height, dpr }) =>
    firefox
      ? rawSend('browsingContext.setViewport', {
          context,
          viewport: { width, height },
          devicePixelRatio: dpr,
        })
      : rawSend('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: dpr,
          mobile: false,
        });
  const shot = async (name) => {
    const { data } = firefox
      ? await rawSend('browsingContext.captureScreenshot', {
          context,
          origin: 'viewport',
          format: { type: 'image/png' },
        })
      : await rawSend('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        });
    await writeFile(
      join(screenshotDirectory, name + '.png'),
      Buffer.from(data, 'base64'),
    );
  };
  // Every press is preceded by a move to the same point, as a real mouse is.
  const clickPoint = async ({ x, y }) => {
    if (firefox)
      await rawSend('input.performActions', {
        context,
        actions: [
          {
            type: 'pointer',
            id: 'mouse',
            parameters: { pointerType: 'mouse' },
            actions: [
              {
                type: 'pointerMove',
                x: Math.round(x),
                y: Math.round(y),
                origin: 'viewport',
              },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ],
      });
    else
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
        await rawSend('Input.dispatchMouseEvent', {
          type,
          x,
          y,
          button: type === 'mouseMoved' ? 'none' : 'left',
          clickCount: 1,
        });
    await pause();
  };
  // WebDriver key values (Firefox only uses Escape and Tab; see below).
  const webDriverKeys = { Escape: '\uE00C', Tab: '\uE004' };
  const key = async (name) => {
    if (firefox)
      await rawSend('input.performActions', {
        context,
        actions: [
          {
            type: 'key',
            id: 'keyboard',
            actions: [
              { type: 'keyDown', value: webDriverKeys[name] },
              { type: 'keyUp', value: webDriverKeys[name] },
            ],
          },
        ],
      });
    else
      for (const type of ['keyDown', 'keyUp'])
        await rawSend('Input.dispatchKeyEvent', {
          type,
          key: name,
          code: name,
          ...(name === 'Enter' && type === 'keyDown' ? { text: '\r' } : {}),
          windowsVirtualKeyCode: { Escape: 27, Enter: 13, Tab: 9 }[name],
        });
    await pause();
  };

  await viewport({ width: 1440, height: 1100, dpr: 1 });
  if (firefox)
    await rawSend('browsingContext.navigate', {
      context,
      url: editorUrl + '/docs/verification/placement/browser-fixture.html',
      wait: 'complete',
    });
  else
    await rawSend('Page.navigate', {
      url: editorUrl + '/docs/verification/placement/browser-fixture.html',
    });
  for (let i = 0; i < 50; i++) {
    await pause();
    if (await ev("typeof mountChantFixture === 'function'")) break;
  }
  // C clef on line 4: staff position 5 is B, so `b8` can own a flat.
  const fixture = {
    title: 'CSS zoom contextual toolbars',
    clef: { type: 'c', staffLine: 4 },
    clefChanges: [],
    divisions: [],
    lyricLanguage: 'la',
    syllables: [],
    accidentals: [{ id: 'flat', kind: 'flat', ownerNoteId: 'b8' }],
    neumes: Array.from({ length: 16 }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [
        { id: i === 8 ? 'b8' : `note${i}`, staffPosition: i === 8 ? 5 : 3 },
      ],
    })),
  };
  const targets = {
    note: {
      selector: '[data-note-id="note6"]',
      panel: '[aria-label="Selected note properties"]',
      close: `document.querySelector('[aria-label="Close note properties"]')`,
      focused: `document.activeElement?.dataset?.noteId==='note6'`,
    },
    accidental: {
      selector: '[data-accidental-id="flat"]',
      panel: '[aria-label="Selected accidental properties"]',
      close: `[...document.querySelectorAll('[aria-label="Selected accidental properties"] button')].find((b)=>b.textContent.trim()==='Close accidental properties')`,
      focused: `document.activeElement?.dataset?.accidentalId==='flat'`,
    },
  };
  const panelOpen = (target) =>
    ev(
      `(()=>{const p=document.querySelector('${target.panel}');return !!p&&getComputedStyle(p).visibility==='visible'})()`,
    );

  // Puts the target at a fixed fraction of the viewport height, then clicks it.
  const open = async (target, fraction) => {
    await ev(`(mountChantFixture(${JSON.stringify(fixture)}),true)`);
    await pause();
    await pause();
    const point = await ev(
      `(()=>{const e=document.querySelector('${target.selector}');e.scrollIntoView({block:'center'});window.scrollBy(0,e.getBoundingClientRect().y-innerHeight*${fraction});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
    );
    await pause();
    await clickPoint(point);
    assert.equal(await panelOpen(target), true, 'panel opens on click');
  };

  // Rendered geometry, all in client (viewport) pixels.
  const geometry = (target) =>
    ev(`(()=>{
      const p=document.querySelector('${target.panel}'),r=p.getBoundingClientRect();
      const t=document.querySelector('${target.selector}').getBoundingClientRect();
      const s=document.querySelector('.editor-sticky-toolbar')?.getBoundingClientRect();
      const c=${target.close},cr=c.getBoundingClientRect();
      const x=cr.x+cr.width/2,y=cr.y+cr.height/2,hit=document.elementFromPoint(x,y);
      const z=p.currentCSSZoom??1;
      return {
        panel:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},
        target:{left:t.left,top:t.top,right:t.right,bottom:t.bottom},
        sticky:s&&s.bottom>0&&s.top<innerHeight?s.bottom:0,
        viewport:{width:visualViewport.width,height:visualViewport.height},
        close:{x,y,hit:!!hit&&(hit===c||c.contains(hit))},
        zoom:z,
        style:{left:parseFloat(p.style.left),top:parseFloat(p.style.top),width:parseFloat(p.style.width)},
      };
    })()`);

  const scenarios = [
    { name: 'desktop-1440', width: 1440, height: 1100, dpr: 1, zoom: 1 },
    { name: 'narrow-320', width: 320, height: 1100, dpr: 1, zoom: 1 },
    { name: 'css-zoom-150', width: 480, height: 1100, dpr: 1, zoom: 1.5 },
    // 150% browser zoom of a 480x1100 window: fewer CSS pixels, denser
    // device pixels, and no CSS `zoom` at all.
    { name: 'page-zoom-150', width: 320, height: 733, dpr: 1.5, zoom: 1 },
  ];
  // Headless Firefox reports document.hasFocus() false and, on master too,
  // delivers Enter key events to a focused button without activating it.
  // Chromium covers keyboard Close; Firefox keeps native pointer and Escape.
  const dismissals = firefox
    ? ['pointer', 'escape']
    : ['pointer', 'escape', 'keyboard'];
  const results = [];
  for (const scenario of scenarios) {
    await viewport(scenario);
    await ev(`(document.documentElement.style.zoom='${scenario.zoom}',true)`);
    await pause();
    for (const [kind, target] of Object.entries(targets))
      for (const fraction of [0.5, 0.85])
        for (const dismissal of dismissals) {
          const label = `${scenario.name} ${kind} at ${fraction} by ${dismissal}`;
          await open(target, fraction);
          // A panel shorter than its content scrolls internally (the short
          // viewport policy); reach Close within the panel, never the page.
          const inner = await ev(`(()=>{
            const p=document.querySelector('${target.panel}'),y=scrollY;
            const scrolls=p.scrollHeight>p.clientHeight;
            if(scrolls)${target.close}.scrollIntoView({block:'nearest'});
            return {scrolls,pageMoved:scrollY!==y};
          })()`);
          assert.equal(inner.pageMoved, false, `${label}: page scrolled`);
          await pause();
          const g = await geometry(target);
          const tol = 0.5;
          // CSS zoom is the panel's own; page zoom must not appear as one.
          assert.equal(g.zoom, scenario.zoom, `${label}: effective zoom`);
          // Inline CSS pixels times the zoom are exactly what is rendered.
          assert(
            Math.abs(g.style.left * g.zoom - g.panel.left) <= tol &&
              Math.abs(g.style.top * g.zoom - g.panel.top) <= tol,
            `${label}: inline style is not in the panel's CSS pixels ${JSON.stringify(g)}`,
          );
          assert(
            g.panel.left >= -tol &&
              g.panel.right <= g.viewport.width + tol &&
              g.panel.bottom <= g.viewport.height + tol,
            `${label}: panel leaves the viewport ${JSON.stringify(g)}`,
          );
          assert(
            g.panel.top >= g.sticky - tol,
            `${label}: panel covers the sticky toolbar ${JSON.stringify(g)}`,
          );
          assert(
            g.panel.bottom <= g.target.top + tol ||
              g.panel.top >= g.target.bottom - tol ||
              g.panel.right <= g.target.left + tol ||
              g.panel.left >= g.target.right - tol,
            `${label}: panel covers its target ${JSON.stringify(g)}`,
          );
          assert(g.close.hit, `${label}: Close is not hit-testable`);
          if (fraction === 0.5 && dismissal === 'pointer')
            await shot(`${scenario.name}-${kind}-open`);
          if (dismissal === 'pointer') await clickPoint(g.close);
          else if (dismissal === 'escape') {
            // Native Tab from the selected target enters the panel.
            await key('Tab');
            assert(
              await ev(
                `document.querySelector('${target.panel}').contains(document.activeElement)`,
              ),
              `${label}: Tab enters the panel`,
            );
            await key('Escape');
          } else {
            await ev(`(${target.close}.focus(),true)`);
            await key('Enter');
          }
          assert.equal(await panelOpen(target), false, `${label}: dismissed`);
          assert(await ev(target.focused), `${label}: focus returns`);
          results.push(label);
        }
  }
  await ev(`(document.documentElement.style.zoom='1',true)`);
  await viewport({ width: 1440, height: 1100, dpr: 1 });
  console.log(
    `PASS (${firefox ? 'Firefox' : 'Chromium'}): ${results.length} cases. Note and accidental toolbars stay inside the viewport, below the sticky toolbar and clear of their target at 1440px, 320px, 150% CSS zoom and 150% page zoom; Close is hit-testable and dismisses natively; Escape${firefox ? '' : ' and keyboard Close'} dismiss; focus returns to the target.`,
  );
} finally {
  if (ownsSession) await rawSend('session.end').catch(() => {});
  ws.close();
}
