import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Readability M2: browser focus survives React reparenting a focused note or
// lyric between system groups during an uncommanded reflow, and reflow never
// steals focus from outside the score. Reflow is forced through the real
// lyric-measurement fallback (a FontFaceSet `loading` event), as in
// `lyric-spacing`. Focus is reached both by trusted Tab (bubbling `focusin`)
// and by script focus(), which in headless Firefox emits no focus event, so
// only ScoreSvg's ref-detachment memory can restore it.
// Standalone CDP (Chromium) / WebDriver BiDi (Firefox) driver.
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
const url = process.env.CHANT_PREVIEW_URL ?? 'http://127.0.0.1:4173/';
const pause = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
const salveRegina = await readFile(
  new URL(
    '../../../src/editor/examples/Salve-Regina-Dominican.chant.json',
    import.meta.url,
  ),
  'utf8',
);

async function ev(expression) {
  if (firefox) {
    const r = await rawSend('script.evaluate', {
      expression: `(async()=>JSON.stringify(await (${expression})))()`,
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
}

async function viewport(width, height) {
  if (firefox)
    await rawSend('browsingContext.setViewport', {
      context,
      viewport: { width, height },
    });
  else
    await rawSend('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  await pause(300);
}

async function navigate() {
  if (firefox)
    await rawSend('browsingContext.navigate', {
      context,
      url,
      wait: 'complete',
    });
  else await rawSend('Page.navigate', { url });
  for (let i = 0; i < 60; i++) {
    await pause(100);
    if (await ev(`!!document.querySelector('.neume-palette')`)) return;
  }
  throw Error('Editor did not load');
}

/** One trusted Tab press through the browser's input pipeline. */
async function tab() {
  if (firefox)
    await rawSend('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value: '' },
            { type: 'keyUp', value: '' },
          ],
        },
      ],
    });
  else
    for (const type of ['keyDown', 'keyUp'])
      await rawSend('Input.dispatchKeyEvent', {
        type,
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
  await pause();
}

async function importDocument(text) {
  await ev(`(window.confirm=()=>true,true)`);
  await ev(
    `(()=>{const input=document.querySelector('input[type="file"]');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],'score.chant.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`,
  );
  for (let i = 0; i < 40; i++) {
    await pause(100);
    if ((await ev(`document.querySelectorAll('[data-note-id]').length`)) > 100)
      return;
  }
  throw Error('Import did not render');
}

const fonts = async (type) => {
  await ev(`(document.fonts.dispatchEvent(new Event('${type}')),true)`);
  await pause(300);
};
/** System index of every note and lyric control, keyed by data attribute. */
const systemsById = (attribute) =>
  ev(
    `Object.fromEntries([...document.querySelectorAll('.score [${attribute}][role="button"]')].map(e=>[e.getAttribute('${attribute}'),Number(e.closest('[data-system-index]').dataset.systemIndex)]))`,
  );
const focused = (attribute) =>
  ev(
    `(()=>{const e=document.activeElement;return e&&e.hasAttribute('${attribute}')?{id:e.getAttribute('${attribute}'),system:Number(e.closest('[data-system-index]').dataset.systemIndex)}:{id:null,tag:e?.tagName,cls:e?.getAttribute?.('class')}})()`,
  );

/** Picks a control whose system differs between measured and fallback layout. */
async function movingControls(attribute) {
  const measured = await systemsById(attribute);
  await fonts('loading');
  const fallback = await systemsById(attribute);
  await fonts('loadingdone');
  assert.deepEqual(
    await systemsById(attribute),
    measured,
    `${attribute}: measured layout returns after loadingdone`,
  );
  return Object.keys(measured).filter(
    (id) => id in fallback && fallback[id] !== measured[id],
  );
}

/** Focus `selector` by trusted Tab from the preceding score tab stop. */
async function tabInto(selector) {
  const ok = await ev(
    `(()=>{const stops=[...document.querySelectorAll('.score [tabindex="0"]')];const i=stops.indexOf(document.querySelector(${JSON.stringify(selector)}));if(i<1)return false;stops[i-1].focus();return true})()`,
  );
  assert.ok(ok, `${selector} has a preceding score tab stop`);
  await pause();
  await tab();
}

async function assertSurvivesReparent(attribute, id, label) {
  const before = await focused(attribute);
  assert.equal(before.id, id, `${label}: control focused before reflow`);
  await fonts('loading');
  const during = await focused(attribute);
  assert.equal(during.id, id, `${label}: focus survives fallback reparent`);
  assert.notEqual(
    during.system,
    before.system,
    `${label}: fallback really moves the control to another system`,
  );
  await fonts('loadingdone');
  const after = await focused(attribute);
  assert.equal(after.id, id, `${label}: focus survives measured reparent`);
  assert.equal(after.system, before.system, `${label}: returns to its system`);
  console.log(
    `PASS: ${label} (system ${before.system} -> ${during.system} -> ${after.system})`,
  );
}

try {
  if (firefox) {
    await rawSend('session.new', { capabilities: {} });
    ownsSession = true;
    context = (await rawSend('browsingContext.getTree')).contexts[0].context;
    await rawSend('browsingContext.activate', { context });
  }
  await viewport(1440, 1100);
  await navigate();
  await ev(`(localStorage.clear(),true)`);
  await navigate();
  await importDocument(salveRegina);
  // Start from settled measured layout: real fonts may still be loading.
  await ev(`document.fonts.ready.then(()=>true)`);
  let settled = await systemsById('data-note-id');
  for (let i = 0; ; i++) {
    await pause(300);
    const next = await systemsById('data-note-id');
    if (JSON.stringify(next) === JSON.stringify(settled)) break;
    assert.ok(i < 20, 'measured layout settles');
    settled = next;
  }

  const notes = await movingControls('data-note-id');
  assert.ok(notes.length > 1, 'fixture reparents at least two notes');
  const lyrics = await movingControls('data-syllable-id');
  assert.ok(lyrics.length > 0, 'fixture reparents at least one lyric');
  console.log(
    `Fallback reflow moves ${notes.length} notes and ${lyrics.length} lyrics`,
  );
  const noteSelector = (id) => `.score [data-note-id="${id}"][role="button"]`;

  // 1. Native Tab arrival (bubbling focusin path).
  await tabInto(noteSelector(notes[0]));
  await assertSurvivesReparent('data-note-id', notes[0], 'Tab-focused note');

  // 2. Script focus. Headless Firefox emits no focus event for this, so only
  // the note's ref-detachment memory can carry focus through the reparent.
  await ev(
    `(document.querySelector(${JSON.stringify(noteSelector(notes[1]))}).focus(),true)`,
  );
  await pause();
  await assertSurvivesReparent('data-note-id', notes[1], 'script-focused note');

  // 3. A focused lyric (lyric-spacing covers this in Chromium only). Lyrics
  // have no ref-detachment memory. In headless Firefox the base (9b9d2af)
  // already loses lyric focus here, because no focus event reaches the
  // score's tracker. That defect predates readability M2 and is reported,
  // not asserted, until the owner decides on a fix. Chromium asserts it.
  await tabInto(`.score [data-syllable-id="${lyrics[0]}"]`);
  if (firefox) {
    try {
      await assertSurvivesReparent('data-syllable-id', lyrics[0], 'lyric');
      console.log(
        'NOTE: Firefox lyric reparent focus now passes; the known baseline defect may be fixed. Make this check strict.',
      );
    } catch (error) {
      console.log(
        `KNOWN BASELINE DEFECT (Firefox, not an M2 regression): ${error.message}`,
      );
      await fonts('loadingdone');
    }
  } else {
    await assertSurvivesReparent('data-syllable-id', lyrics[0], 'lyric');
  }

  // 4. Reflow never steals focus from outside the score.
  await ev(
    `(document.querySelector('.neume-palette [data-tool="select"]').focus(),true)`,
  );
  await pause();
  const outside = `document.activeElement?.dataset?.tool ?? document.activeElement?.tagName`;
  assert.equal(await ev(outside), 'select');
  await fonts('loading');
  assert.equal(await ev(outside), 'select', 'no focus theft on fallback');
  await fonts('loadingdone');
  assert.equal(await ev(outside), 'select', 'no focus theft on measured');
  console.log('PASS: reflow leaves focus outside the score alone');

  console.log(
    `PASS: score focus reparenting (${firefox ? 'Firefox' : 'Chromium'}) for Tab- and script-focused notes, ${firefox ? 'lyrics (reported only), ' : 'lyrics, '}and outside focus.`,
  );
} finally {
  if (ownsSession) await rawSend('session.end').catch(() => {});
  ws.close();
}
