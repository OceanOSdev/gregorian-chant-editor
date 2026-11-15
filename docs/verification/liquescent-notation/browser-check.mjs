import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Standalone CDP/BiDi driver against the real production StrictMode editor.
// Stage 10B liquescent Podatus and Clivis (ADR 0027). Run through the
// verification runner: npm run verify:browser -- --driver liquescent-notation
const output = await mkdtemp(join(tmpdir(), 'chant-liquescence-'));
const fixtures = new URL('./fixtures/', import.meta.url);
const wipBytes = await readFile(
  new URL('salve-regina-dominican-wip.chant.json', fixtures),
  'utf8',
);
const acceptanceBytes = await readFile(
  new URL('salve-regina-liquescent-acceptance.chant.json', fixtures),
  'utf8',
);
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
const score = async () => JSON.parse(await raw()).document;
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
async function hydrate(bytes) {
  await ev(`localStorage.setItem('${storageKey}',${JSON.stringify(bytes)})`);
  await navigate();
  assert.equal(await raw(), bytes, 'hydration must not write');
  assert.equal(
    await ev(`document.querySelector('svg.score title').textContent`),
    JSON.parse(bytes).document.title,
    'the fixture must actually decode, not fall back',
  );
}
async function importText(text) {
  await ev(`window.confirm=()=>true`);
  await ev(
    `(()=>{const input=document.querySelector('input[type="file"]');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],'score.chant.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause();
  await pause();
}
const firefoxKeys = {
  Enter: '',
  Delete: '',
  Tab: '',
  Escape: '',
  ArrowUp: '',
  ArrowDown: '',
  ArrowRight: '',
  ArrowLeft: '',
  ' ': '',
};
const keyCodes = {
  Tab: 9,
  Escape: 27,
  Enter: 13,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowRight: 39,
  ArrowLeft: 37,
  Delete: 46,
  ' ': 32,
};
async function key(name, { shift = false, ctrl = false } = {}) {
  if (firefox) {
    const value = firefoxKeys[name] ?? name;
    const mods = [...(shift ? [''] : []), ...(ctrl ? [''] : [])];
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            ...mods.map((m) => ({ type: 'keyDown', value: m })),
            { type: 'keyDown', value },
            { type: 'keyUp', value },
            ...mods.reverse().map((m) => ({ type: 'keyUp', value: m })),
          ],
        },
      ],
    });
  } else {
    const modifiers = (shift ? 8 : 0) | (ctrl ? 2 : 0);
    if (ctrl)
      await rawSend('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'Control',
        code: 'ControlLeft',
        windowsVirtualKeyCode: 17,
        modifiers: 2,
      });
    const single = name.length === 1 && name !== ' ';
    for (const type of [ctrl ? 'rawKeyDown' : 'keyDown', 'keyUp'])
      await rawSend('Input.dispatchKeyEvent', {
        type,
        key: name,
        code: single ? 'Key' + name.toUpperCase() : name,
        modifiers,
        ...(type === 'keyDown' && (name === 'Enter' || name === ' ' || single)
          ? { text: name === 'Enter' ? '\r' : name }
          : {}),
        windowsVirtualKeyCode:
          keyCodes[name] ?? name.toUpperCase().charCodeAt(0),
      });
    if (ctrl)
      await rawSend('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Control',
        code: 'ControlLeft',
        windowsVirtualKeyCode: 17,
      });
  }
  await pause();
}
async function type(text) {
  if (firefox)
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [...text].flatMap((value) => [
            { type: 'keyDown', value },
            { type: 'keyUp', value },
          ]),
        },
      ],
    });
  else await rawSend('Input.insertText', { text });
  await pause();
}
async function pointerAt(point) {
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
}
async function pointer(selector) {
  await ev(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`,
  );
  await pause();
  const point = await ev(
    `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  await pointerAt(point);
}
async function pointerButton(text) {
  const found = await ev(
    `(()=>{document.querySelector('[data-driver-target]')?.removeAttribute('data-driver-target');const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)})&&!b.disabled);b?.setAttribute('data-driver-target','');return Boolean(b)})()`,
  );
  assert.ok(found, `Missing or disabled button ${text}`);
  await pointer('[data-driver-target]');
}
const note = (id) => `[data-note-id="${id}"]`;
async function focusNote(id) {
  await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(note(id))});e.scrollIntoView({block:'center'});e.focus();return true})()`,
  );
  await pause();
}
async function select(id) {
  await focusNote(id);
  await key('Enter');
  assert.equal(
    await ev(
      `document.querySelector(${JSON.stringify(note(id))}).getAttribute('aria-pressed')`,
    ),
    'true',
    `note ${id} selected`,
  );
}
const announcement = () =>
  ev(`document.querySelector('.editor-announcement').textContent`);
const undo = async () => {
  await ev(
    `document.querySelector('button[aria-label="Undo last edit"]').click()`,
  );
  await pause();
};
const arrow = (family) => `button[data-tool="${family}-menu"]`;
const primary = (family) => `button[data-tool="${family}"]`;
const menus = () =>
  ev(
    `[...document.querySelectorAll('[role="menu"]')].map(m=>({label:m.getAttribute('aria-label'),items:[...m.querySelectorAll('[role="menuitemradio"]')].map(i=>i.textContent.trim())}))`,
  );
async function choose(family, variant) {
  await pointer(arrow(family));
  await pointer(`[data-variant="${variant}"]`);
  assert.equal(
    await ev(
      `document.querySelector('${arrow(family)}').dataset.activeVariant`,
    ),
    variant,
  );
}
async function changeSelect(label, value) {
  await ev(
    `(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.focus();e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`,
  );
  await pause();
}
const toolbar = () =>
  ev(`(()=>{const t=document.querySelector('.note-context-toolbar');if(!t)return null;const r=t.getBoundingClientRect();return {
    noteFor:t.dataset.noteContextFor??null,neumeFor:t.dataset.neumeContextFor,
    label:t.getAttribute('aria-label'),
    target:t.querySelector('.note-context-toolbar__target')?.textContent,
    appearance:t.querySelector('select[aria-label="Appearance"]')?.value??null,
    toggle:t.querySelector('.note-context-toolbar__toggle')?.getAttribute('aria-pressed')??null,
    error:t.querySelector('.note-context-toolbar__error')?.textContent??null,
    help:[...t.querySelectorAll('.note-context-toolbar__help')].map(h=>h.textContent),
    episemaDisabled:t.querySelector('select[aria-label="Horizontal episema"]')?.disabled??null,
    verticalDisabled:t.querySelector('select[aria-label="Vertical episema"]')?.disabled??null,
    mora:[...(t.querySelector('select[aria-label="Mora scope"]')?.options??[])].map(o=>o.value),
    forms:[...(t.querySelector('select[aria-label="Form"]')?.options??[])].map(o=>o.value),
    controls:[...t.querySelectorAll('select,button')].map(c=>c.getAttribute('aria-label')??c.textContent.trim()),
    visible:r.width>0&&r.height>0&&getComputedStyle(t).visibility==='visible'&&r.left>=0&&r.right<=innerWidth+1,
  }})()`);
const figures = () =>
  ev(
    `[...document.querySelectorAll('g[data-neume-id]')].map(g=>({id:g.dataset.neumeId,kind:g.dataset.neumeKind,figure:g.dataset.liquescentFigure??null,labels:[...g.querySelectorAll('[data-note-id]')].map(n=>n.getAttribute('aria-label'))}))`,
  );
async function snapshot(name) {
  await ev(
    `document.querySelector('.score-workspace').scrollIntoView({block:'start'})`,
  );
  const rendered = await ev(
    `({svg:document.querySelector('svg.score').outerHTML})`,
  );
  await writeFile(join(output, name + '.json'), JSON.stringify(rendered));
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
}
/** The pitches of the neume with this ID in the saved semantic document. */
const pitches = async (neumeId) =>
  (await score()).neumes
    .find((n) => n.id === neumeId)
    ?.notes.map((n) => n.staffPosition);
async function moveSelectedNeumeTo(neumeId, target) {
  const current = await pitches(neumeId);
  const delta = target[0] - current[0];
  for (let i = 0; i < Math.abs(delta); i++)
    await key(delta > 0 ? 'ArrowUp' : 'ArrowDown');
  assert.deepEqual(await pitches(neumeId), target, `${neumeId} pitches`);
}
async function placeAt(pitch, x = 300) {
  await ev(
    `document.querySelector('svg.score').scrollIntoView({block:'center'})`,
  );
  await pause();
  const point = await ev(
    `(()=>{const svg=document.querySelector('svg.score'),lines=[...svg.querySelectorAll('.score__staff-line')],bottom=Math.max(...lines.slice(0,4).map(l=>Number(l.getAttribute('y1'))));const p=new DOMPoint(${x},bottom-${pitch}*12).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y}})()`,
  );
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await pause();
  const ghost = await ev(
    `[...document.querySelectorAll('.score__placement-ghost path')].map(p=>p.getAttribute('d'))`,
  );
  assert.ok(ghost.length >= 1, 'ghost visible');
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await pause();
  return ghost;
}
const blank = {
  format: 'gregorian-chant-editor',
  version: 10,
  document: {
    accidentals: [],
    title: 'Stage 10B liquescence entry',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 4 },
    neumes: [],
    syllables: [],
    divisions: [],
    clefChanges: [],
  },
};
const newIds = (before, after) => {
  const old = new Set(before.neumes.map((n) => n.id));
  return after.neumes.filter((n) => !old.has(n.id));
};

try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
  }
  for (const width of [1440, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate();

    // 1. Palette: Podatus keeps its options and adds two; new Clivis family.
    await pointer(arrow('podatus'));
    assert.deepEqual(await menus(), [
      {
        label: 'Podatus family',
        items: [
          'Podatus',
          'Pes subbipunctis',
          'Pes subtripunctis',
          'Epiphonus',
          'Augmentative pes (Dominican)',
        ],
      },
    ]);
    await key('Escape');
    await pointer(arrow('clivis'));
    assert.deepEqual(await menus(), [
      { label: 'Clivis family', items: ['Clivis', 'Cephalicus'] },
    ]);
    await key('Escape');
    assert.deepEqual(await menus(), []);

    // 2. Owner's v9 WIP: hydrate unchanged, then continue "Ad te" through the
    // real contextual insertion paths after the final division.
    await hydrate(wipBytes);
    const wip = JSON.parse(wipBytes).document;
    const finalBar = wip.divisions.find((d) => d.beforeNeumeId === null);
    await pointer(primary('punctum'));
    await key('Escape');
    await ev(
      `(()=>{const e=document.querySelector('[data-division-id="${finalBar.id}"]');e.scrollIntoView({block:'center'});e.focus();return true})()`,
    );
    await key('Enter');
    await pointerButton('Insert Punctum after division');
    let now = await score();
    const [ad] = newIds(wip, now);
    assert.equal(ad.kind, 'punctum');
    assert.equal(
      now.divisions.find((d) => d.id === finalBar.id).beforeNeumeId,
      ad.id,
      'Ad follows the final division',
    );
    await select(ad.notes[0].id);
    await moveSelectedNeumeTo(ad.id, [0]);
    // Remember Epiphonus from its family, then insert it after Ad with I.
    await choose('podatus', 'epiphonus');
    await key('Escape');
    await select(ad.notes[0].id);
    await key('i');
    let before = now;
    now = await score();
    const [epiphonus] = newIds(before, now);
    assert.equal(epiphonus.kind, 'podatus');
    assert.equal(epiphonus.liquescence, 'diminutive');
    await select(epiphonus.notes[0].id);
    await key('Enter', { shift: true });
    await moveSelectedNeumeTo(epiphonus.id, [2, 3]);
    assert.match(await announcement(), /./);
    await pointer(primary('punctum'));
    await key('Escape');
    await select(epiphonus.notes[1].id);
    await key('i');
    before = now;
    now = await score();
    const [te] = newIds(before, now);
    await select(te.notes[0].id);
    await moveSelectedNeumeTo(te.id, [4]);
    // Lyrics: "Ad" on the punctum (the epiphonus continues it), "te".
    for (const [id, text] of [
      [ad.notes[0].id, 'Ad'],
      [te.notes[0].id, 'te'],
    ]) {
      await focusNote(id);
      await key('l');
      await type(text);
      await key('Enter');
      await pointerButton('Done');
    }
    now = await score();
    const order = now.neumes.map((n) => n.id);
    assert.deepEqual(
      order.slice(0, 35),
      wip.neumes.map((n) => n.id),
    );
    assert.deepEqual(now.neumes.slice(0, 35), wip.neumes, 'WIP unchanged');
    assert.deepEqual(order.slice(35), [ad.id, epiphonus.id, te.id]);
    assert.deepEqual(
      now.neumes
        .slice(35)
        .map((n) => [
          n.kind,
          n.liquescence ?? null,
          n.notes.map((x) => x.staffPosition),
        ]),
      [
        ['punctum', null, [0]],
        ['podatus', 'diminutive', [2, 3]],
        ['punctum', null, [4]],
      ],
    );
    const lyricOf = (id) => now.syllables.find((s) => s.startsAtNeumeId === id);
    assert.equal(lyricOf(ad.id)?.text, 'Ad');
    assert.equal(lyricOf(epiphonus.id), undefined, 'epiphonus belongs to Ad');
    assert.equal(lyricOf(te.id)?.text, 'te');
    assert.equal(JSON.parse(await raw()).version, 10);
    const engraved = (await figures()).find((f) => f.id === epiphonus.id);
    assert.equal(engraved.figure, 'epiphonus');
    assert.deepEqual(
      engraved.labels.map((l) => l.split('.')[0]),
      [
        'Select lower note of epiphonus',
        'Select upper liquescent note of epiphonus',
      ],
    );
    await snapshot(`wip-ad-te-${width}`);

    // 3. Every inventory occurrence from the v10 acceptance fixture.
    await hydrate(acceptanceBytes);
    const accepted = await figures();
    assert.deepEqual(
      accepted.filter((f) => f.figure).map((f) => [f.id, f.figure]),
      [
        ['ad1e', 'epiphonus'],
        ['ad2e', 'epiphonus'],
        ['eia', 'augmentative-pes'],
        ['er', 'epiphonus'],
        ['cor', 'cephalicus'],
        ['dul', 'cephalicus'],
      ],
    );
    assert.match(
      (await ev(
        `document.querySelector('svg.score desc')?.textContent ?? document.querySelector('svg.score').getAttribute('aria-description') ?? ''`,
      )) +
        (await ev(
          `[...document.querySelectorAll('svg.score [id]')].map(e=>e.textContent).join(' ')`,
        )),
      /6 liquescent neumes/,
    );
    await snapshot(`acceptance-${width}`);

    // 4. Podatus appearance selector on a constituent; IDs/pitches retained.
    const eia = (await score()).neumes.find((n) => n.id === 'eia');
    await select('eia-0');
    await key('Tab');
    let t = await toolbar();
    assert.equal(t.noteFor, 'eia-0');
    assert.equal(t.appearance, 'augmentative-descending');
    assert.ok(t.visible, 'toolbar visible in viewport');
    assert.deepEqual(t.mora, ['none', 'first']);
    assert.deepEqual(t.forms, ['default'], 'no quilisma on a liquescent pes');
    for (const value of ['diminutive', 'ordinary', 'augmentative-descending']) {
      await changeSelect('Appearance', value);
      const changed = (await score()).neumes.find((n) => n.id === 'eia');
      assert.deepEqual(changed.notes, eia.notes);
      if (value === 'ordinary') assert.equal('liquescence' in changed, false);
      else assert.equal(changed.liquescence, value);
      assert.equal(
        await ev(
          `document.querySelector('${note('eia-0')}').getAttribute('aria-pressed')`,
        ),
        'true',
        'selection retained',
      );
    }
    // Second note: marks unavailable with an explanation.
    await key('Escape');
    await select('eia-1');
    t = await toolbar();
    assert.equal(t.episemaDisabled, true);
    assert.equal(t.verticalDisabled, true);
    assert.ok(
      t.help.some((h) =>
        /second note of an augmentative pes \(Dominican\) cannot carry/.test(h),
      ),
    );
    await key('Escape');

    // 5. Clivis Liquescent toggle (aria-pressed), then rejection with marks.
    await select('cor-0');
    await key('Tab');
    t = await toolbar();
    assert.equal(t.toggle, 'true');
    await pointer('.note-context-toolbar__toggle');
    assert.equal((await toolbar()).toggle, 'false');
    assert.equal(
      'liquescence' in (await score()).neumes.find((n) => n.id === 'cor'),
      false,
    );
    await pointer('.note-context-toolbar__toggle');
    assert.equal((await toolbar()).toggle, 'true');
    await key('Escape');
    // Ordinary Podatus "cis" with a second-note episema rejects visibly.
    await select('cis-1');
    await key('Tab');
    await changeSelect('Horizontal episema', 'on');
    const marked = await raw();
    await changeSelect('Appearance', 'diminutive');
    assert.equal(await raw(), marked, 'rejected without history or autosave');
    t = await toolbar();
    assert.match(t.error, /Remove marks from the second note first/);
    assert.equal(t.appearance, 'ordinary');
    assert.match(
      await announcement(),
      /Remove marks from the second note first/,
    );
    await key('Escape');

    // 6. Whole-neume selection exposes only the appearance control.
    await select('er-0');
    await key('Enter', { shift: true });
    await key('Tab');
    t = await toolbar();
    assert.equal(t.noteFor, null);
    assert.equal(t.neumeFor, 'er');
    assert.equal(t.target, 'Whole epiphonus');
    assert.deepEqual(t.controls, ['Appearance', 'Close note properties']);
    await changeSelect('Appearance', 'augmentative-descending');
    assert.equal(
      (await score()).neumes.find((n) => n.id === 'er').liquescence,
      'augmentative-descending',
    );
    await undo();
    assert.equal(
      (await score()).neumes.find((n) => n.id === 'er').liquescence,
      'diminutive',
    );
    await key('Escape');

    // 7. D5: deleting a constituent leaves an ordinary Punctum; undo restores.
    const withEpiphonus = await raw();
    await select('ad1e-1');
    await key('Delete');
    const survivor = (await score()).neumes.find((n) => n.id === 'ad1e');
    assert.deepEqual(survivor, {
      id: 'ad1e',
      kind: 'punctum',
      notes: [{ id: 'ad1e-0', staffPosition: 2 }],
    });
    assert.match(
      await announcement(),
      /^Note deleted from the epiphonus\. The remaining note is now an ordinary punctum\./,
    );
    await undo();
    assert.equal(await raw(), withEpiphonus);

    // 8. Musical clipboard: whole augmentative pes, paste after "cis".
    await select('eia-0');
    await key('Enter', { shift: true });
    await key('c', { ctrl: true });
    assert.match(await announcement(), /^Copied/);
    await select('cis-0');
    await key('Enter', { shift: true });
    const beforePaste = await score();
    await key('v', { ctrl: true });
    const [pasted] = newIds(beforePaste, await score());
    assert.equal(pasted.kind, 'podatus');
    assert.equal(pasted.liquescence, 'augmentative-descending');
    assert.deepEqual(
      pasted.notes.map((n) => n.staffPosition),
      [2, 3],
    );
    assert.ok(!['eia', 'eia-0', 'eia-1'].includes(pasted.id));

    // 9. v10 reload, export and import; the same file tagged v9 is rejected.
    const bytes = await raw();
    assert.equal(JSON.parse(bytes).version, 10);
    await navigate();
    assert.equal(await raw(), bytes, 'reload keeps v10 bytes');
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
    const beforeV9 = await raw();
    await importText(JSON.stringify({ ...JSON.parse(exported), version: 9 }));
    assert.equal(await raw(), beforeV9, 'v9 rejects the liquescent field');

    // 10. One-click graphical placement of each variant with exact ghosts.
    await hydrate(JSON.stringify(blank));
    let x = 120;
    for (const [family, variant, kind, liquescence, positions] of [
      ['podatus', 'epiphonus', 'podatus', 'diminutive', [2, 3]],
      [
        'podatus',
        'augmentative-pes',
        'podatus',
        'augmentative-descending',
        [2, 3],
      ],
      ['clivis', 'cephalicus', 'clivis', 'diminutive', [3, 2]],
    ]) {
      await choose(family, variant);
      const prior = await ev(`localStorage.getItem('${storageKey}')`);
      const beforePlace = prior ? JSON.parse(prior).document : blank.document;
      const ghost = await placeAt(positions[0], x);
      x += 70;
      const [placed] = newIds(beforePlace, await score());
      assert.equal(placed.kind, kind);
      assert.equal(placed.liquescence, liquescence);
      assert.deepEqual(
        placed.notes.map((n) => n.staffPosition),
        positions,
      );
      const committed = await ev(
        `[...document.querySelectorAll('g[data-neume-id="${placed.id}"] path')].map(p=>p.getAttribute('d')).length`,
      );
      assert.ok(committed >= ghost.length, `${variant} ink rendered`);
      await key('Escape');
    }
    await snapshot(`entry-${width}`);
    assert.equal(
      await ev(`document.documentElement.scrollWidth<=innerWidth`),
      true,
      'no horizontal page overflow',
    );
  }
  console.log(
    JSON.stringify({
      browser: firefox ? 'Firefox/BiDi' : 'Chromium/CDP',
      userAgent: await ev('navigator.userAgent'),
      output,
      checks:
        'Podatus family (5 options) and new Clivis family; owner v9 WIP hydrated without write and continued with Ad te via after-division insertion, remembered I insertion, pitch moves and lyrics (Ad/epiphonus/te, v10 save, WIP prefix unchanged); all six inventory figures engraved with labels and score count; Podatus Appearance selector transitions with stable IDs and retained selection; second-note marks disabled with explanation; Clivis Liquescent toggle; visible/announced rejection with no autosave; whole-neume appearance toolbar with undo; D5 deletion announcement and exact undo; clipboard copy/paste of augmentative pes; v10 reload/export/import and v9 rejection; one-click graphical placement of all three variants; no overflow; at 1440px and 320px',
    }),
  );
} finally {
  if (ownsSession) await rawSend('session.end');
  ws.close();
}
