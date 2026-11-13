import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
const output = await mkdtemp(join(tmpdir(), 'chant-note-context-'));
const firefox = Boolean(process.env.CHANT_FIREFOX_URL);
const pages = firefox
  ? []
  : await (
      await fetch(
        process.env.CHANT_CHROMIUM_URL ?? 'http://127.0.0.1:9236/json',
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
const url = process.env.CHANT_PREVIEW_URL ?? 'http://127.0.0.1:4174/';
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
async function key(key, code = key, modifiers = []) {
  if (firefox) {
    const value =
      {
        Enter: '\uE007',
        Delete: '\uE017',
        Tab: '\uE004',
        Escape: '\uE00C',
        ArrowUp: '\uE013',
        ArrowDown: '\uE015',
      }[key] ?? key;
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            ...modifiers.map((key) => ({
              type: 'keyDown',
              value: key === 'Control' ? '\uE009' : '\uE008',
            })),
            { type: 'keyDown', value },
            { type: 'keyUp', value },
            ...[...modifiers].reverse().map((key) => ({
              type: 'keyUp',
              value: key === 'Control' ? '\uE009' : '\uE008',
            })),
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
        modifiers:
          (modifiers.includes('Control') ? 2 : 0) |
          (modifiers.includes('Shift') ? 8 : 0),
        windowsVirtualKeyCode: {
          Tab: 9,
          Escape: 27,
          Enter: 13,
          ArrowUp: 38,
          ArrowDown: 40,
        }[key],
      });
  await pause();
}
const selector = (id) => `[data-note-id="${id}"]`;
async function select(id) {
  // Native SVG keyboard activation also works for overlapping compound hit boxes.
  await ev(
    `document.querySelector(${JSON.stringify(selector(id))}).focus({preventScroll:true})`,
  );
  await key('Enter');
  assert.equal(
    await ev(
      `document.querySelector(${JSON.stringify(selector(id))}).getAttribute('aria-pressed')`,
    ),
    'true',
  );
}
const ownerSource = await readFile(
  new URL(
    '../../../src/editor/examples/pater-noster.chant.json',
    import.meta.url,
  ),
  'utf8',
);
const panelSelector = '.note-context-toolbar';
const score = async () => JSON.parse(await raw()).document;
async function hydrate(source) {
  const bytes = typeof source === 'string' ? source : JSON.stringify(source);
  await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(bytes)})`);
  await navigate();
  assert.equal(await raw(), bytes);
}
async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
}
async function change(label, value) {
  return ev(
    `(()=>{const e=document.querySelector('${panelSelector} select[aria-label="${label}"]');e.focus({preventScroll:true});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return JSON.parse(localStorage.getItem('${storageKey}'));})()`,
  );
}
async function pointer(selector) {
  const p = await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...p,
      button: 'left',
      clickCount: 1,
    });
  await pause();
}
async function revealNote(id) {
  await ev(`(()=>{
 const n=document.querySelector(${JSON.stringify(selector(id))});const v=n.closest('.score-viewport');
 let b=n.getBoundingClientRect(),r=v.getBoundingClientRect();
 if(v.scrollWidth>v.clientWidth)v.scrollLeft+=b.left+b.width/2-r.left-r.width/2;
 b=n.getBoundingClientRect();window.scrollBy({top:b.top+b.height/2-innerHeight/2,behavior:'instant'});
 })()`);
  await pause();
}
async function focusNote(id) {
  await revealNote(id);
  await select(id);
  await pause();
}
async function contextMetrics(id) {
  const result = await ev(`(()=>{
 const n=document.querySelector(${JSON.stringify(selector(id))}),p=document.querySelector('${panelSelector}');
 const rect=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height}};
 const v=visualViewport;
 return {note:rect(n),panel:p?rect(p):null,viewport:{left:v.offsetLeft,right:v.offsetLeft+v.width,top:v.offsetTop,bottom:v.offsetTop+v.height},visibility:p?getComputedStyle(p).visibility:null,position:p?getComputedStyle(p).position:null,parent:p?.parentElement.tagName,controlsFit:p?p.scrollWidth<=p.clientWidth+1:null,selected:n.getAttribute('aria-pressed'),scrollY,scoreTop:document.querySelector('svg.score').getBoundingClientRect().top+scrollY,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
 })()`);
  assert.equal(result.visibility, 'visible', JSON.stringify(result));
  assert.equal(result.selected, 'true');
  assert.equal(result.position, 'fixed');
  assert.equal(result.parent, 'BODY');
  assert.equal(
    result.controlsFit,
    true,
    'all contextual controls must fit horizontally',
  );
  const { panel: p, note: n, viewport: v } = result;
  assert.ok(
    p.left >= v.left - 1 &&
      p.right <= v.right + 1 &&
      p.top >= v.top - 1 &&
      p.bottom <= v.bottom + 1,
    JSON.stringify(result),
  );
  assert.ok(
    p.right <= n.left ||
      p.left >= n.right ||
      p.bottom <= n.top ||
      p.top >= n.bottom,
    JSON.stringify(result),
  );
  assert.ok(
    result.scrollWidth <= result.width,
    'toolbar must not create page overflow',
  );
  return result;
}
const reports = [];
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
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await hydrate(ownerSource);
    const target = await ev(
      `(()=>{const groups=[...document.querySelectorAll('[data-system-index]')];const group=groups[Math.max(3,groups.length-3)];return {id:[...group.querySelectorAll('[data-neume-kind="punctum"] [data-note-id]')].find(n=>!/episema|mora/i.test(n.getAttribute('aria-label'))).dataset.noteId,system:Number(group.dataset.systemIndex),systems:groups.length}})()`,
    );
    assert.ok(target.system >= 3);
    const id = target.id;
    await revealNote(id);
    await screenshot('before-' + width);
    const before = await score();
    const top = await ev(
      `document.querySelector('svg.score').getBoundingClientRect().top+scrollY`,
    );
    const scroll = await ev('scrollY');
    await pointer(selector(id));
    await pause();
    assert.equal(
      await ev(`document.activeElement.getAttribute('data-note-id')`),
      id,
      'opening must not steal score focus',
    );
    let metrics = await contextMetrics(id);
    assert.ok(Math.abs(metrics.scoreTop - top) < 0.05);
    assert.ok(Math.abs(metrics.scrollY - scroll) < 1);
    assert.equal(
      await ev(`document.querySelectorAll('.note-modifiers').length`),
      0,
      'no duplicated top inspector',
    );
    assert.equal(
      await ev(`document.querySelectorAll('select[aria-label="Form"]').length`),
      1,
    );
    await screenshot('selected-' + width);
    await key('Tab');
    assert.equal(
      await ev(
        `document.activeElement.closest('${panelSelector}')?.getAttribute('aria-label')`,
      ),
      'Selected note properties',
    );
    assert.equal(
      await ev('document.activeElement.getAttribute("aria-label")'),
      'Form',
    );
    await key('Tab', 'Tab', ['Shift']);
    assert.equal(
      await ev(`document.activeElement.getAttribute('data-note-id')`),
      id,
    );
    await key('Tab');
    const original = { ...structuredClone(before), accidentals: [] };
    const getNote = (d) =>
      d.neumes.flatMap((n) => n.notes).find((n) => n.id === id);
    const expected = structuredClone(original);
    expected.accidentals = [];
    getNote(expected).mora = 1;
    let saved = await change('Mora scope', 'sole');
    assert.equal(saved.version, 5);
    assert.deepEqual(saved.document, expected);
    getNote(expected).episema = true;
    saved = await change('Horizontal episema', 'on');
    assert.deepEqual(saved.document, expected);
    const beforeVertical = structuredClone(expected);
    getNote(expected).verticalEpisema = true;
    saved = await change('Vertical episema', 'on');
    assert.deepEqual(saved.document, expected);
    const committed = await raw();
    await change('Vertical episema', 'on');
    assert.equal(await raw(), committed);
    await key('z', 'KeyZ', ['Control']);
    assert.deepEqual(
      await score(),
      beforeVertical,
      'no-op did not create a history entry',
    );
    await key('z', 'KeyZ', ['Control', 'Shift']);
    assert.deepEqual(await score(), expected);
    for (const form of ['virga', 'inclinatum', 'default']) {
      const prior = structuredClone(expected);
      if (form === 'default') delete getNote(expected).form;
      else getNote(expected).form = form;
      saved = await change('Form', form);
      assert.deepEqual(saved.document, expected);
      const bytes = await raw();
      await change('Form', form);
      assert.equal(await raw(), bytes);
      await key('z', 'KeyZ', ['Control']);
      assert.deepEqual(await score(), prior);
      await key('z', 'KeyZ', ['Control', 'Shift']);
      assert.deepEqual(await score(), expected);
      if (form !== 'default') await screenshot('form-' + form + '-' + width);
    }
    await ev(
      `document.querySelector('${panelSelector} select[aria-label="Form"]').focus({preventScroll:true})`,
    );
    await key('ArrowDown');
    await key('Tab');
    const nativeForm = structuredClone(expected);
    getNote(nativeForm).form = 'virga';
    assert.deepEqual(
      await score(),
      nativeForm,
      'native form arrows edit form only',
    );
    await change('Form', 'default');
    assert.deepEqual(await score(), expected);
    assert.equal(
      await ev(
        `document.querySelector('${panelSelector} select[aria-label="Vertical episema"]').value`,
      ),
      'on',
    );
    await contextMetrics(id);
    assert.ok(
      Math.abs((await ev('scrollY')) - scroll) < 1,
      'editing properties must remain local',
    );
    await screenshot('after-' + width);
    const beforeDismiss = await raw();
    await key('Escape');
    assert.equal(
      await ev(`!!document.querySelector('${panelSelector}')`),
      false,
    );
    assert.equal(
      await ev(`document.activeElement.getAttribute('data-note-id')`),
      id,
      JSON.stringify(
        await ev(
          `({active:document.activeElement.outerHTML,panel:!!document.querySelector('${panelSelector}'),scrollY})`,
        ),
      ),
    );
    assert.equal(await raw(), beforeDismiss);
    await pointer(selector(id));
    await pause();
    await contextMetrics(id);
    assert.equal(
      await ev(`document.activeElement.getAttribute('data-note-id')`),
      id,
    );
    await key('Tab');
    await pause();
    await contextMetrics(id);
    await ev(
      `document.querySelector('${panelSelector} button').focus({preventScroll:true})`,
    );
    for (const k of ['i', 't', 'Delete', 'ArrowUp']) await key(k);
    assert.equal(
      await raw(),
      beforeDismiss,
      'toolbar keys cannot insert/delete/transpose notation',
    );
    await pause();
    await pointer(`${panelSelector} button`);
    assert.equal(
      await ev(`document.activeElement.getAttribute('data-note-id')`),
      id,
      JSON.stringify(
        await ev(
          `({active:document.activeElement.outerHTML,panel:!!document.querySelector('${panelSelector}'),scrollY})`,
        ),
      ),
    );
    assert.equal(await raw(), beforeDismiss);
    const beforeReopen = await raw();
    await ev('window.scrollTo(0,0)');
    await pause();
    await key('Tab');
    await pause();
    await contextMetrics(id);
    assert.equal(
      await ev('document.activeElement.getAttribute("aria-label")'),
      'Form',
    );
    assert.equal(
      await raw(),
      beforeReopen,
      'offscreen keyboard reopening changes no semantics',
    );
    await key('Escape');
    await key('Tab');
    await key('Tab');
    assert.equal(
      await ev('document.activeElement.getAttribute("aria-label")'),
      'Mora scope',
    );
    await key('Tab');
    assert.equal(
      await ev('document.activeElement.getAttribute("aria-label")'),
      'Horizontal episema',
    );
    await key('Tab');
    assert.equal(
      await ev('document.activeElement.getAttribute("aria-label")'),
      'Vertical episema',
    );
    await key('Tab');
    assert.equal(
      await ev('document.activeElement.getAttribute("aria-label")'),
      'Close note properties',
    );
    await key('Tab');
    assert.ok(
      await ev('!!document.activeElement.closest("svg.score")'),
      'Tab exits back into score',
    );
    await select(id);
    await pause();
    await contextMetrics(id);
    await ev('window.scrollBy(0,70)');
    await pause();
    await contextMetrics(id);
    if (width === 320)
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 600,
        deviceScaleFactor: 1,
        mobile: false,
      });
    await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector(id))});scrollTo(0,e.getBoundingClientRect().top+scrollY-24)})()`,
    );
    await pause();
    metrics = await contextMetrics(id);
    assert.ok(
      metrics.panel.top >= metrics.note.bottom,
      'flip below at viewport top: ' +
        JSON.stringify({ width, target, metrics }),
    );
    await screenshot('flipped-' + width);
    await change('Vertical episema', 'off');
    await change('Horizontal episema', 'off');
    await change('Mora scope', 'none');
    const removed = await score();
    assert.deepEqual(
      removed,
      original,
      'removing all three restores exact owner document',
    );
    await ev(
      `document.querySelector('${panelSelector} select[aria-label="Vertical episema"]').focus({preventScroll:true})`,
    );
    await key('ArrowDown');
    await key('Tab');
    assert.equal(
      (await score()).neumes.flatMap((n) => n.notes).find((n) => n.id === id)
        .verticalEpisema,
      true,
      'native select arrows commit without transposing',
    );
    assert.equal(
      (await score()).neumes.flatMap((n) => n.notes).find((n) => n.id === id)
        .staffPosition,
      getNote(original).staffPosition,
    );
    const refresh = await raw();
    await navigate();
    assert.equal(await raw(), refresh);
    assert.ok(
      (await score()).neumes.flatMap((n) => n.notes).find((n) => n.id === id)
        .verticalEpisema,
    );
    await focusNote(id);
    await contextMetrics(id);
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 260,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await focusNote(id);
    await contextMetrics(id);
    assert.ok(
      await ev(
        `document.querySelector('${panelSelector}').scrollHeight>=document.querySelector('${panelSelector}').clientHeight`,
      ),
    );
    await screenshot('short-' + width);
    const shortBytes = await raw();
    await key('Tab');
    await key('Tab');
    await key('Tab');
    await key('Tab');
    assert.equal(
      await ev('document.activeElement.getAttribute("aria-label")'),
      'Vertical episema',
    );
    assert.ok(
      await ev(
        `(()=>{const r=document.activeElement.getBoundingClientRect(),p=document.querySelector('${panelSelector}').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom})()`,
      ),
      'Tab reveals lower controls inside the short panel',
    );
    await key('Tab');
    assert.equal(
      await ev('document.activeElement.getAttribute("aria-label")'),
      'Close note properties',
    );
    await key('Escape');
    assert.equal(await raw(), shortBytes);
    assert.equal(
      await ev(`document.activeElement.getAttribute('data-note-id')`),
      id,
    );

    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await focusNote(id);
    await contextMetrics(id);
    reports.push({ width, ...target, metrics });
  }
  if (!firefox) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await hydrate(ownerSource);
    const id = reports[1].id;
    await focusNote(id);
    await rawSend('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 });
    await pause();
    await focusNote(id);
    assert.ok(await ev('visualViewport.scale>1.4'));
    await contextMetrics(id);
    await screenshot('pinch-zoom-320');
    await rawSend('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }
  // Legal compound mora patterns: each menu is derived from the same kind.
  await hydrate(ownerSource);
  const compound = await ev(
    `(()=>{const groups=[...document.querySelectorAll('[data-neume-id]')].filter(g=>['podatus','clivis'].includes(g.dataset.neumeKind));return groups.at(-1).querySelector('[data-note-id]').dataset.noteId})()`,
  );
  await focusNote(compound);
  await contextMetrics(compound);
  assert.deepEqual(
    await ev(
      `Array.from(document.querySelector('${panelSelector} select[aria-label="Mora scope"]').options,o=>o.value)`,
    ),
    ['none', 'first', 'second', 'both'],
  );
  const beforeCompound = await score();
  let saved = await change('Mora scope', 'both');
  const marked = saved.document.neumes.find((n) =>
    n.notes.some((note) => note.id === compound),
  );
  assert.ok(marked.notes.every((n) => n.mora === 1));
  await key('z', 'KeyZ', ['Control']);
  assert.deepEqual(await score(), { ...beforeCompound, accidentals: [] });
  await key('z', 'KeyZ', ['Control', 'Shift']);
  assert.deepEqual(await score(), saved.document);
  await screenshot('compound-320');
  // All seven menu families, including final-only/final-pair three-note scopes.
  const shapes = [
    ['punctum', [2]],
    ['podatus', [2, 3]],
    ['clivis', [3, 2]],
    ['scandicus', [1, 2, 3]],
    ['torculus', [1, 3, 2]],
    ['climacus', [3, 2, 1]],
    ['porrectus', [3, 1, 2]],
  ];
  const corpus = {
    format: 'gregorian-chant-editor',
    version: 5,
    document: {
      ...JSON.parse(ownerSource).document,
      accidentals: [],
      neumes: shapes.map(([kind, pitches], i) => ({
        id: 'n' + i,
        kind,
        notes: pitches.map((staffPosition, j) => ({
          id: `note-${i}-${j}`,
          staffPosition,
        })),
      })),
      syllables: [],
      divisions: [],
      clefChanges: [],
    },
  };
  await hydrate(corpus);
  for (const [i] of shapes.entries()) {
    await focusNote('note-' + i + '-0');
    const options = await ev(
      `Array.from(document.querySelector('${panelSelector} select[aria-label="Mora scope"]').options,o=>o.value)`,
    );
    assert.deepEqual(
      options,
      i === 0
        ? ['none', 'sole']
        : i <= 2
          ? ['none', 'first', 'second', 'both']
          : ['none', 'final', 'final-two'],
    );
    const formOptions = await ev(
      `Array.from(document.querySelector('${panelSelector} select[aria-label="Form"]').options,o=>o.value)`,
    );
    assert.deepEqual(
      formOptions,
      i === 0
        ? ['default', 'virga', 'inclinatum']
        : i === 1
          ? ['default', 'quilisma']
          : ['default'],
    );
    assert.equal(
      await ev(
        `document.querySelector('${panelSelector} select[aria-label="Form"]').disabled`,
      ),
      i >= 2,
    );
    if (i >= 2)
      assert.match(
        await ev(`document.querySelector('${panelSelector}').textContent`),
        /No alternate form/,
      );
    if (i >= 2) {
      await key('Tab');
      assert.equal(
        await ev('document.activeElement.getAttribute("aria-label")'),
        (await ev(
          `!!document.querySelector('${panelSelector} select[aria-label="Written accidental"]')`,
        ))
          ? 'Written accidental'
          : 'Mora scope',
        'disabled Form is skipped; B properties precede mora',
      );
      await key('Tab', 'Tab', ['Shift']);
      if (i === 2) await screenshot('form-disabled-320');
    }
    if (i > 2) {
      await change('Mora scope', 'final-two');
      const n = (await score()).neumes[i];
      assert.equal(n.notes[0].mora, undefined);
      assert.equal(n.notes[1].mora, 1);
      assert.equal(n.notes[2].mora, 1);
    }
  }
  await focusNote('note-3-1');
  assert.deepEqual(
    await ev(
      `Array.from(document.querySelector('${panelSelector} select[aria-label="Form"]').options,o=>o.value)`,
    ),
    ['default', 'quilisma'],
  );
  const unshaped = await score();
  await change('Form', 'quilisma');
  assert.equal((await score()).neumes[3].notes[1].form, 'quilisma');
  await screenshot('form-quilisma-320');
  await key('z', 'KeyZ', ['Control']);
  assert.deepEqual(await score(), unshaped);
  // Responsive reflow and real horizontal score-viewport scrolling.
  const wide = structuredClone(corpus);
  wide.document.neumes = wide.document.neumes.slice(0, 2);
  wide.document.syllables = [
    {
      id: 'wide-lyric',
      text: 'a'.repeat(180),
      startsAtNeumeId: 'n0',
      boundaryBefore: 'word',
    },
  ];
  await hydrate(wide);
  await focusNote('note-0-0');
  await contextMetrics('note-0-0');
  assert.ok(
    await ev('document.querySelector(".score-viewport").scrollLeft>0'),
    'oversized unit needs actual horizontal scrolling',
  );
  await ev('document.querySelector(".score-viewport").scrollBy(16,0)');
  await pause();
  await contextMetrics('note-0-0');
  await screenshot('horizontal-scroll-320');
  // Placement owns the score; this convenience cannot edit during placement.
  await ev(
    `document.querySelector('.neume-palette button[data-tool="punctum"]').click()`,
  );
  await pause();
  assert.equal(await ev(`!!document.querySelector('${panelSelector}')`), false);
  await writeFile(
    join(output, 'context-results.json'),
    JSON.stringify(
      { browser: firefox ? 'Firefox' : 'Chromium', reports, result: 'PASS' },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox' : 'Chromium',
      output,
      result: 'PASS',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
