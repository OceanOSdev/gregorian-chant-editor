import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-repeated-neumes-'));
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
    case 'Page.printToPDF':
      return rawSend('browsingContext.print', { context, background: true });
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
const raw = () => ev(`localStorage.getItem('${storageKey}')`);
async function ready() {
  for (let i = 0; i < 60; i++) {
    await pause();
    if (await ev(`!!document.querySelector('section[aria-label="Document"]')`))
      return;
  }
  throw Error('Editor did not load');
}
async function navigate() {
  await send('Page.navigate', { url });
  await ready();
}
async function importText(text) {
  await ev(`window.confirm=()=>true`);
  await ev(
    `(()=>{const input=document.querySelector('input[type="file"]');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],'score.chant.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  await pause();
}
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
const selector = (id) => `[data-note-id="${id}"]`;
async function select(id) {
  // Native SVG keyboard activation also works for overlapping compound hit boxes.
  await ev(`document.querySelector(${JSON.stringify(selector(id))}).focus()`);
  await key('Enter');
  assert.equal(
    await ev(
      `document.querySelector(${JSON.stringify(selector(id))}).getAttribute('aria-pressed')`,
    ),
    'true',
  );
}
async function change(label, value) {
  return ev(
    `(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.focus();e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return JSON.parse(localStorage.getItem('${storageKey}'));})()`,
  );
}
async function snapshot(name, target = '.score-workspace') {
  await ev(
    `document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'start'})`,
  );
  const rendered = await ev(
    `({svg:document.querySelector('svg.score').outerHTML,css:[...document.styleSheets].flatMap(s=>[...s.cssRules].map(r=>r.cssText)).join('\\n')})`,
  );
  await writeFile(join(output, name + '.json'), JSON.stringify(rendered));
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
}
const score = async () => JSON.parse(await raw()).document;
async function hydrate(value) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value);
  await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(bytes)})`);
  await navigate();
  assert.equal(await raw(), bytes, 'hydration must not write');
  assert.equal(
    await ev(`document.querySelector('svg.score title').textContent`),
    JSON.parse(bytes).document.title,
    'the fixture must actually decode, not fall back',
  );
  return bytes;
}

async function pointer(selector) {
  await ev(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`,
  );
  await pause();
  const point = await ev(
    `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
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
const arrow = 'button[data-tool="punctum-menu"]';
const menuOpen = () => ev(`!!document.querySelector('[role="menu"]')`);
const focusedTool = () => ev('document.activeElement?.dataset.tool ?? null');
const primary = 'button[data-tool="punctum"]';
const selectedTool = () =>
  ev(
    `[...document.querySelectorAll('.neume-palette [aria-pressed="true"]')].map(n=>n.dataset.tool)`,
  );
const family = () =>
  ev(`document.querySelector('${arrow}').dataset.activeVariant`);
async function choose(kind) {
  await pointer(arrow);
  await pointer(
    `[role="menuitemradio"]:nth-child(${['punctum', 'bistropha', 'tristropha'].indexOf(kind) + 1})`,
  );
  assert.equal(await family(), kind);
}
async function placeAt(pitch = 2, systemIndex = 0) {
  await ev(
    `document.querySelector('svg.score').scrollIntoView({block:'center'})`,
  );
  await pause();
  const point = await ev(
    `(()=>{const svg=document.querySelector('svg.score'),lines=[...svg.querySelectorAll('.score__staff-line')],bottom=Math.max(...lines.slice(${systemIndex * 4},${systemIndex * 4 + 4}).map(l=>Number(l.getAttribute('y1'))));const p=new DOMPoint(300,bottom-${pitch}*12).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y}})()`,
  );
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await pause();
  const paths = await ev(
    `[...document.querySelectorAll('.score__placement-ghost path')].map(p=>p.getAttribute('d'))`,
  );
  if (!paths.length) {
    console.log({
      point,
      diagnostic: await ev(
        `({at:document.elementFromPoint(${point.x},${point.y})?.outerHTML.slice(0,600),tool:document.querySelector('button[data-tool="punctum-menu"]')?.outerHTML,svg:document.querySelector('svg.score')?.getBoundingClientRect().toJSON(),scrollY})`,
      ),
    });
  }
  assert.ok(paths.length >= 1, 'ghost visible');
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
  return paths;
}
const base = {
  format: 'gregorian-chant-editor',
  version: 6,
  document: {
    title: 'Stage 9A repeated square heads',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 4 },
    neumes: [],
    syllables: [],
    divisions: [],
    clefChanges: [],
    accidentals: [],
  },
};
const n = (id, kind, pitch, marks = {}) => ({
  id,
  kind,
  notes: Array.from(
    { length: kind === 'bistropha' ? 2 : kind === 'tristropha' ? 3 : 1 },
    (_, i) => ({ id: id + '-' + i, staffPosition: pitch, ...marks }),
  ),
});
try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate();
    await hydrate(base);
    const original = await raw();
    await pointer(arrow);
    assert.equal(await raw(), original);
    await key('ArrowDown');
    assert.equal(
      await ev('document.activeElement.textContent.trim()'),
      'Bistropha',
    );
    await key('Escape');
    assert.equal(
      await ev('document.activeElement.dataset.tool'),
      'punctum-menu',
    );
    assert.equal(await raw(), original);
    assert.equal(await family(), undefined);
    await choose('tristropha');
    await pointer(arrow);
    await snapshot('menu-' + width, '.neume-palette');
    await key('Escape');
    assert.deepEqual(
      await selectedTool(),
      [],
      'ordinary punctum must not be pressed',
    );
    await pointer(arrow);
    await key('Escape');
    assert.equal(await family(), 'tristropha');
    assert.equal(await raw(), original);
    await pointer(arrow);
    await key('Tab');
    assert.equal(await ev(`!!document.querySelector('[role="menu"]')`), false);
    assert.equal(await raw(), original);
    assert.equal(await family(), 'tristropha');
    await pointer(arrow);
    await pointer('h1');
    assert.equal(await ev(`!!document.querySelector('[role="menu"]')`), false);
    assert.equal(await raw(), original);
    // Primary Punctum while the menu is open: switch, close, keep primary focus.
    await pointer(arrow);
    assert.equal(await menuOpen(), true);
    await pointer(primary);
    assert.equal(await menuOpen(), false, 'primary activation closes menu');
    assert.equal(await family(), 'punctum');
    assert.deepEqual(await selectedTool(), ['punctum']);
    assert.equal(await focusedTool(), 'punctum', 'focus stays on primary');
    assert.equal(await raw(), original, 'tool switch alone writes nothing');
    await pointer(arrow);
    assert.equal(await menuOpen(), true, 'no stale open state remains');
    await key('Escape');
    await choose('tristropha');
    // Dismissal-only score click: no edit, chevron focus, shortcuts still work.
    await pointer(arrow);
    await placeAt(2);
    assert.equal(
      await raw(),
      original,
      'outside score click only dismisses menu',
    );
    assert.equal(await menuOpen(), false);
    assert.equal(await family(), 'tristropha');
    assert.equal(
      await focusedTool(),
      'punctum-menu',
      'score dismissal restores chevron focus',
    );
    await key('i', 'KeyI');
    const recalled = await score();
    assert.equal(recalled.neumes.length, 1, 'I works after dismissal');
    assert.equal(recalled.neumes[0].kind, 'tristropha');
    await key('t', 'KeyT');
    assert.equal(
      await focusedTool(),
      'punctum-menu',
      'T works after dismissal',
    );
    await ev(
      `document.querySelector('button[aria-label="Undo last edit"]').click()`,
    );
    await pause();
    assert.equal((await score()).neumes.length, 0);
    // Clicking another exposed control while open keeps its native focus.
    // At 320px the open menu covers wrapped neighbours, so pick one not under it.
    await pointer(arrow);
    const exposed = await ev(
      `[...document.querySelectorAll('.neume-palette button[data-tool]')].find(b=>{if(b.closest('.punctum-menu'))return false;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b})?.dataset.tool`,
    );
    assert.ok(exposed, 'some palette control is exposed beside the menu');
    await pointer(`button[data-tool="${exposed}"]`);
    assert.equal(await menuOpen(), false);
    assert.equal(await focusedTool(), exposed, 'outside control keeps focus');
    assert.equal((await score()).neumes.length, 0);
    await pointer(primary);
    assert.equal(await family(), 'punctum');
    assert.deepEqual(await selectedTool(), ['punctum']);
    for (const kind of ['bistropha', 'tristropha']) {
      await choose(kind);
      const before = (await score()).neumes.length;
      const ghost = await placeAt(2);
      assert.equal(ghost.length, kind === 'bistropha' ? 2 : 3);
      await placeAt(3);
      const after = await score();
      assert.equal(after.neumes.length, before + 2);
      const inserted = after.neumes.filter((n) => n.kind === kind);
      assert.ok(inserted.length >= 2);
      assert.ok(
        inserted.every(
          (n) => new Set(n.notes.map((n) => n.staffPosition)).size === 1,
        ),
      );
      assert.equal(await family(), kind);
      assert.equal(JSON.parse(await raw()).version, 7);
      await pointer('[data-tool="select"]');
      await ev(`document.querySelector('[data-note-id]').focus()`);
      await key('t', 'KeyT');
      assert.equal(
        await ev('document.activeElement.dataset.tool'),
        'punctum-menu',
      );
      assert.equal(await family(), undefined);
      await key('i', 'KeyI');
      assert.equal((await score()).neumes.at(-1).kind, kind);
      await pointer(primary);
      assert.equal(await family(), 'punctum');
    }
    // Keyboard-only activation: native roving arrows, opening, End, Enter, no score edit.
    await ev(`document.querySelector('${primary}').focus()`);
    const beforeMenu = await raw();
    await key('ArrowRight');
    assert.equal(
      await ev('document.activeElement.dataset.tool'),
      'punctum-menu',
    );
    await key('Enter');

    await key('End');

    await key('Enter');
    assert.equal(await family(), 'tristropha');
    assert.equal(await raw(), beforeMenu);
    await key('Escape');
    assert.deepEqual(await selectedTool(), ['select']);
    await key('i', 'KeyI');
    assert.equal((await score()).neumes.at(-1).kind, 'tristropha');
    const bytes = await raw();
    await navigate();
    assert.equal(await raw(), bytes);
    await ev(
      `window.__download=null;URL.createObjectURL=blob=>{window.__download=blob;return 'blob:captured'};HTMLAnchorElement.prototype.click=function(){}`,
    );
    await ev(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export').click()`,
    );
    await pause();
    const exported = await ev('window.__download.text()');
    assert.deepEqual(JSON.parse(exported), JSON.parse(bytes));
    await importText(exported);
    assert.deepEqual(await score(), JSON.parse(bytes).document);
    // Native note selection, unavailable mora, independent signs, contour rejection, deletion/history.
    await hydrate({
      ...base,
      document: {
        ...base.document,
        neumes: [n('tri', 'tristropha', 5), n('bi', 'bistropha', 4)],
      },
    });
    await select('tri-1');
    assert.equal(
      await ev(
        `document.querySelector('[aria-label="Mora scope"]').getAttribute('aria-disabled')`,
      ),
      'true',
    );
    assert.ok(
      await ev(
        `document.querySelector('.note-context-toolbar').textContent.includes('Mora authoring is unavailable')`,
      ),
    );
    await change('Horizontal episema', 'on');
    await change('Vertical episema', 'on');
    await change('Written accidental', 'flat');
    const marked = await score();
    assert.equal(marked.accidentals[0].ownerNoteId, 'tri-0');
    assert.equal(marked.neumes[0].notes[1].episema, true);
    assert.equal(marked.neumes[0].notes[1].verticalEpisema, true);
    await ev(`document.querySelector('[data-note-id="tri-1"]').focus()`);
    await key('ArrowUp');
    assert.deepEqual(await score(), marked);
    const announcement = () =>
      ev(`document.querySelector('.editor-announcement').textContent`);
    assert.match(await announcement(), /same pitch/);
    await key('Enter', 'Enter', true);
    await key('ArrowUp');
    assert.ok(
      (await score()).neumes[0].notes.every((n) => n.staffPosition === 6),
    );
    await ev(
      `document.querySelector('button[aria-label="Undo last edit"]').click()`,
    );
    await pause();
    assert.deepEqual(await score(), marked);
    await ev(`document.querySelector('[data-note-id="tri-1"]').focus()`);
    await key('Enter');
    await key('Delete');
    const reduced = await score();
    assert.equal(reduced.neumes[0].kind, 'bistropha');
    assert.deepEqual(
      reduced.neumes[0].notes.map((n) => n.id),
      ['tri-0', 'tri-2'],
    );
    await ev(
      `document.querySelector('button[aria-label="Undo last edit"]').click()`,
    );
    await pause();
    assert.deepEqual(await score(), marked);
    await ev(
      `document.querySelector('button[aria-label="Redo last undone edit"]').click()`,
    );
    await pause();
    assert.deepEqual(await score(), reduced);
    await snapshot('interaction-' + width);
    // Explicit ink specimens: line/space, both lengths, signs and adjacent neumes.
    const specimen = {
      ...base,
      document: {
        ...base.document,
        neumes: [
          n('line-bi', 'bistropha', 4),
          n('space-bi', 'bistropha', 3),
          n('line-tri', 'tristropha', 2),
          n('space-tri', 'tristropha', 1),
          n('sign-bi', 'bistropha', 4, {
            episema: true,
            verticalEpisema: true,
          }),
          n('sign-tri', 'tristropha', 3, {
            episema: true,
            verticalEpisema: true,
          }),
        ],
      },
    };
    await hydrate(specimen);
    await snapshot('engraving-' + width);
    assert.equal(
      await ev(`document.documentElement.scrollWidth<=innerWidth`),
      true,
    );
    assert.equal(
      await ev(
        `document.querySelectorAll('.neume-palette [tabindex="0"]').length`,
      ),
      1,
    );
    const targets = await ev(
      `Array.from(document.querySelectorAll('[data-neume-id]')).filter(n=>n.classList.contains('score__neume')).map(n=>n.getBoundingClientRect().width)`,
    );
    assert.ok(targets.every((w) => w > 0));
  }
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox/BiDi' : 'Chromium/CDP',
      userAgent: await ev('navigator.userAgent'),
      output,
      checks:
        'split primary/menu/dismiss/keyboard/Tab/remembered I/T, line-space repeated placement/ghost, v6 import/reload, signs/B ownership/contour rejection/normalization/history, desktop/320px',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
