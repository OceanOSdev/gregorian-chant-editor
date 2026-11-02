import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const editorUrl = process.env.CHANT_EDITOR_URL ?? 'http://127.0.0.1:5173';
const artifacts = await mkdtemp(join(tmpdir(), 'chant-one-shot-'));
const pages = await (await fetch('http://127.0.0.1:9230/json')).json();
const ws = new WebSocket(
  pages.find((p) => p.type === 'page').webSocketDebuggerUrl,
);
await new Promise((r) => ws.addEventListener('open', r));
let serial = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, (m) => (m.error ? reject(m.error) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const pause = (ms = 100) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const viewport = (width) =>
  send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
const click = async (selector) => {
  const point = await ev(
    `(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)throw Error('Missing '+${JSON.stringify(selector)}); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
  );
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    ...point,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    ...point,
  });
  await pause();
};
const button = async (text) => {
  const selector = await ev(
    `(() => { const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!e)throw Error('No button '+${JSON.stringify(text)}); e.id='test-click';return '#test-click';})()`,
  );
  await click(selector);
  await ev(`document.querySelector('#test-click')?.removeAttribute('id')`);
};
const key = async (key, modifiers = 0, code = key) => {
  const vk =
    {
      Enter: 13,
      Tab: 9,
      Escape: 27,
      ArrowUp: 38,
      ArrowDown: 40,
      ArrowLeft: 37,
      ArrowRight: 39,
      ' ': 32,
      '-': 189,
    }[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    modifiers,
    windowsVirtualKeyCode: vk,
    ...(key === 'Enter' ? { text: '\r' } : {}),
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
  await pause();
};
const insert = (text) => send('Input.insertText', { text });
const score = () =>
  ev(
    `JSON.parse(localStorage.getItem('gregorian-chant-editor.document.v1')).document`,
  );
const screenshot = async (name) => {
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    join(artifacts, name + '.png'),
    Buffer.from(result.data, 'base64'),
  );
};
const openFile = async (path) => {
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: 'input[type=file]',
  });
  await send('DOM.setFileInputFiles', { nodeId, files: [path] });
  await pause(250);
};
const download = async (name, action) => {
  await action();
  for (let i = 0; i < 30; i++) {
    if ((await readdir(artifacts)).includes(name))
      return readFile(join(artifacts, name), 'utf8');
    await pause(100);
  }
  throw Error('Download did not arrive: ' + name);
};
try {
  await send('Page.enable');
  await send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: artifacts,
  });
  await viewport(1440);
  await send('Page.navigate', { url: editorUrl });
  await pause(600);
  await ev(`localStorage.clear()`);
  await send('Page.reload');
  await pause(900);
  assert.equal((await score()).neumes.length, 7);
  await screenshot('desktop');

  // Real pointer selection and native key editing; history and reload recovery.
  const before = await score();
  await click('.score .score__note');
  const selectedId = await ev(
    `document.querySelector('.score__note[aria-pressed=true]').dataset.noteId`,
  );
  await key('ArrowRight');
  assert.notEqual(
    await ev(`document.activeElement.dataset.noteId`),
    selectedId,
  );
  assert.equal(
    await ev(
      `document.querySelector('.score__note[aria-pressed=true]').dataset.noteId`,
    ),
    selectedId,
  );
  await key('ArrowLeft');
  await key('ArrowUp');
  await pause(500);
  assert.equal(
    (await score()).neumes[0].notes[0].staffPosition,
    before.neumes[0].notes[0].staffPosition + 1,
  );
  await button('Undo');
  await pause(500);
  assert.equal(
    (await score()).neumes[0].notes[0].staffPosition,
    before.neumes[0].notes[0].staffPosition,
  );
  await button('Redo');
  await click('[aria-label="Chant title"]');
  await key('a', 2, 'KeyA');
  await insert('Probe score');
  assert.equal(
    await ev(
      `(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()`,
    ),
    true,
  );
  await key('Tab');
  await pause(600);
  assert.equal((await score()).title, 'Probe score');
  await send('Page.reload');
  await pause(800);
  assert.equal(
    await ev(`document.querySelector('h1').textContent`),
    'Probe score',
  );
  const json = await download('Probe-score.chant.json', () =>
    button('Save chant'),
  );
  assert.equal(JSON.parse(json).document.title, 'Probe score');

  // Exported notation is a self-contained image, with no selection or interaction UI.
  await click('.export-menu summary');
  const svg = await download('Probe-score.svg', () => button('SVG score'));
  assert(svg.includes('<style') && svg.includes('score__ink'));
  assert(
    !svg.includes('role="button"') &&
      !svg.includes('score__note-hit-target') &&
      !svg.includes('score__note-selection'),
  );
  const gabc = await download('Probe-score.gabc', () => button('GABC'));
  assert(gabc.includes('name: Probe score;') && gabc.includes('%%'));

  // Invalid input preserves the entire document; valid replacement requires explicit choice.
  const bad = join(artifacts, 'bad.json');
  await writeFile(bad, '{"version":99}');
  await openFile(bad);
  assert(
    (await ev(`document.querySelector('[role=alert]').textContent`)).includes(
      'version',
    ),
  );
  assert.equal((await score()).title, 'Probe score');
  await click('[aria-label="Chant title"]');
  await key('a', 2, 'KeyA');
  await insert('Keep me');
  await key('Tab');
  await pause(500);
  await openFile(join(artifacts, 'Probe-score.chant.json'));
  assert(await ev(`Boolean(document.querySelector('[role=alertdialog]'))`));
  await button('Keep editing');
  assert.equal((await score()).title, 'Keep me');
  await openFile(join(artifacts, 'Probe-score.chant.json'));
  await button('Replace chant');
  await pause(500);
  assert.equal((await score()).title, 'Probe score');

  // Blank score, all graphical tools, persistent placement, and continuous lyric entry.
  await button('New chant');
  await pause(500);
  assert.equal((await score()).neumes.length, 0);
  const tools = [
    'punctum',
    'podatus',
    'clivis',
    'scandicus',
    'torculus',
    'climacus',
    'porrectus',
  ];
  for (const tool of tools) {
    await click(`[data-tool="${tool}"]`);
    const point = await ev(
      `(() => {const svg=document.querySelector('.score');svg.scrollIntoView({block:'center'});const p=new DOMPoint(620,100).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};})()`,
    );
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: 'left',
      clickCount: 1,
      ...point,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: 'left',
      clickCount: 1,
      ...point,
    });
    await pause();
  }
  await click('[data-tool="select"]');
  await pause(500);
  assert.equal((await score()).neumes.length, 7);
  assert.equal(
    (await score()).neumes.reduce((n, v) => n + v.notes.length, 0),
    17,
  );
  await click('.score .score__note');
  await button('Lyrics L');
  const syllables = [
    ['Ky', '-'],
    ['ri', '-'],
    ['e', ' '],
    ['e', '-'],
    ['lé', '-'],
    ['i', '-'],
    ['son', 'Enter'],
  ];
  for (const [text, delimiter] of syllables) {
    await insert(text);
    if (delimiter === '-' || delimiter === ' ')
      await key(delimiter, 0, delimiter === '-' ? 'Minus' : 'Space');
    else await key(delimiter);
    await pause();
  }
  await pause(600);
  assert.equal((await score()).syllables.length, 7);
  assert.deepEqual(
    (await score()).syllables.map((s) => s.text),
    ['Ky', 'ri', 'e', 'e', 'lé', 'i', 'son'],
  );
  await screenshot('composed');

  // Dirty drafts are never included in downloaded files or silently discarded.
  await ev(`document.querySelector('.score__lyric').focus()`);
  await key('l', 0, 'KeyL');
  await pause();
  assert(
    await ev(`Boolean(document.querySelector('.lyric-floating-entry input'))`),
  );
  await key('a', 2, 'KeyA');
  await insert('Draft');
  await pause();
  assert(
    await ev(
      `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Save chant').disabled`,
    ),
  );
  await key('Escape');
  await pause(500);
  assert.equal((await score()).syllables[0].text, 'Ky');

  // Metadata cannot appear edited while history or anchor-move modes block it.
  await ev(`document.querySelector('.score__lyric').focus()`);
  await key('l', 0, 'KeyL');
  await key('a', 2, 'KeyA');
  await insert('Unsaved');
  await button('Undo');
  assert.equal(
    await ev(`document.querySelector('[aria-label="Chant title"]').disabled`),
    true,
  );
  assert.equal(
    await ev(`document.querySelector('[aria-label="C clef line"]').disabled`),
    true,
  );
  await button('Cancel history');
  await key('Escape');
  await click('.score__lyric');
  await ev(
    `document.querySelector('button[id="move-lyric-test"]')?.removeAttribute('id');[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Move syllable:')).id='move-lyric-test'`,
  );
  await click('#move-lyric-test');
  assert.equal(
    await ev(`document.querySelector('[aria-label="Chant title"]').disabled`),
    true,
  );
  await button('Cancel move');
  // Long imported score: real text bounds, continuation marks, narrow viewport, zoom and print.
  const long = join(artifacts, 'long.gabc');
  await writeFile(
    long,
    'name: Long specimen;\nlanguage: Latin;\n%%\n(c4) ' +
      Array.from(
        { length: 18 },
        () => 'Be(f)ne(g)dic(h)tus(i) mi(h)se(g)ri(f)cor(g)di(h)am(i)',
      ).join(' '),
  );
  await openFile(long);
  await button('Replace chant');
  await pause(800);
  assert.equal((await score()).neumes.length, 180);
  assert(
    (await ev(
      `document.querySelectorAll('.score [data-system-index]').length`,
    )) > 1,
  );
  assert((await ev(`document.querySelectorAll('.score__hyphen').length`)) > 0);
  const collisions = await ev(
    `(() => { const bad=[];for(const s of document.querySelectorAll('.score [data-system-index]')){const ls=[...s.querySelectorAll('.score__lyric')];for(let i=1;i<ls.length;i++){const a=ls[i-1].getBBox(),b=ls[i].getBBox();if(a.x+a.width>b.x+0.5)bad.push([a.x+a.width,b.x]);}}return bad;})()`,
  );
  assert.deepEqual(collisions, []);
  await viewport(320);
  await pause();
  assert((await ev('document.documentElement.scrollWidth')) <= 320);
  await ev('window.scrollTo(0,0)');
  await screenshot('narrow');
  await click('[aria-label="Score zoom"]');
  await key('1');
  await key('Enter');
  await pause();
  assert((await ev('document.documentElement.scrollWidth')) <= 320);
  await viewport(1440);
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  assert.equal(
    await ev(
      `getComputedStyle(document.querySelector('.print-score')).display`,
    ),
    'block',
  );
  assert.equal(
    await ev(
      `getComputedStyle(document.querySelector('.document-controls')).display`,
    ),
    'none',
  );
  const pdf = await send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
  });
  await writeFile(
    join(artifacts, 'score.pdf'),
    Buffer.from(pdf.data, 'base64'),
  );
  await send('Emulation.setEmulatedMedia', { media: '' });
  // Save shortcut includes a still-focused title field in one history action.
  await click('[aria-label="Chant title"]');
  await key('a', 2, 'KeyA');
  await insert('Shortcut save');
  const shortcutFile = await download('Shortcut-save.chant.json', () =>
    key('s', 2, 'KeyS'),
  );
  assert.equal(JSON.parse(shortcutFile).document.title, 'Shortcut save');
  await pause(500);
  assert.equal((await score()).title, 'Shortcut save');

  // Corrupt recovery is preserved byte-for-byte until explicit resume.
  await ev(
    `localStorage.setItem('gregorian-chant-editor.document.v1','unreadable recovery')`,
  );
  await send('Page.reload');
  await pause(800);
  assert.equal(
    await ev(`localStorage.getItem('gregorian-chant-editor.document.v1')`),
    'unreadable recovery',
  );
  assert(
    (
      await ev(`document.querySelector('.document-warning').textContent`)
    ).includes('paused'),
  );
  const recovery = await download('browser-recovery.chant.json', () =>
    button('Download browser copy'),
  );
  assert.equal(recovery, 'unreadable recovery');
  await button('Resume saving this tab');
  await pause(500);
  assert.equal((await score()).title, 'Kyrie eleison');

  // Compact input that expands beyond the save limit must fail before replacement.
  const oversized = join(artifacts, 'expanded.json');
  const many = Array.from({ length: 8000 }, (_, i) => ({
    id: 'n-' + i,
    kind: 'punctum',
    notes: [{ id: 'note-' + i, staffPosition: 2 }],
  }));
  const manyLyrics = many.map((n, i) => ({
    id: 'syllable-' + i,
    text: 'Benedictus',
    startsAtNeumeId: n.id,
    boundaryBefore: 'word',
  }));
  const compact = JSON.stringify({
    format: 'gregorian-chant-editor',
    version: 1,
    document: {
      title: 'Large import',
      lyricLanguage: 'la',
      clef: { type: 'c', staffLine: 4 },
      neumes: many,
      syllables: manyLyrics,
    },
  });
  assert(Buffer.byteLength(compact) < 2_000_000);
  await writeFile(oversized, compact);
  await openFile(oversized);
  await pause(800);
  assert.equal((await score()).title, 'Kyrie eleison');
  assert(
    (await ev(`document.querySelector('[role=alert]').textContent`)).includes(
      '2 MB',
    ),
  );
  assert.equal(
    await ev(`Boolean(document.querySelector('[role=alertdialog]'))`),
    false,
  );

  // Actual second-tab storage writes pause the first tab instead of overwriting it.
  const { targetId } = await send('Target.createTarget', { url: editorUrl });
  await pause(800);
  const tabs = await (await fetch('http://127.0.0.1:9230/json')).json();
  const peer = new WebSocket(
    tabs.find((p) => p.id === targetId).webSocketDebuggerUrl,
  );
  await new Promise((r) => peer.addEventListener('open', r));
  await new Promise((resolve, reject) => {
    peer.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id === 1) {
        if (m.error) reject(m.error);
        else resolve(m);
      }
    });
    peer.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(()=>{const key='gregorian-chant-editor.document.v1';const f=JSON.parse(localStorage.getItem(key));f.document.title='Other tab';localStorage.setItem(key,JSON.stringify(f));})()`,
        },
      }),
    );
  });
  await pause(300);
  assert(
    (
      await ev(`document.querySelector('.document-warning').textContent`)
    ).includes('Another tab'),
  );
  await click('[aria-label="Chant title"]');
  await key('a', 2, 'KeyA');
  await insert('This tab');
  await key('Tab');
  await pause(500);
  assert.equal((await score()).title, 'Other tab');
  peer.close();
  await send('Target.closeTarget', { targetId });
  await button('Resume saving this tab');
  await pause(500);
  assert.equal((await score()).title, 'This tab');

  // Storage write failure is visible and file download still works.
  const injected = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}`,
  });
  await send('Page.reload');
  await pause(900);
  assert(
    (await ev(`document.querySelector('[role=alert]').textContent`)).includes(
      'storage',
    ),
  );
  await download('This-tab.chant.json', () => button('Save chant'));
  await send('Page.removeScriptToEvaluateOnNewDocument', {
    identifier: injected.identifier,
  });
  await send('Page.reload');
  await pause(800);
  // An edited document that cannot serialize must still protect unload/replacement.
  const outOfRange = join(artifacts, 'range.chant.json');
  const rangeDoc = {
    format: 'gregorian-chant-editor',
    version: 1,
    document: {
      title: 'Range',
      lyricLanguage: 'la',
      clef: { type: 'c', staffLine: 3 },
      neumes: [
        {
          id: 'range-neume',
          kind: 'punctum',
          notes: [{ id: 'range-note', staffPosition: 1024 }],
        },
      ],
      syllables: [],
    },
  };
  await writeFile(outOfRange, JSON.stringify(rangeDoc));
  await openFile(outOfRange);
  await button('Replace chant');
  await pause(500);
  await click('.score .score__note');
  await key('ArrowUp');
  await pause();
  assert(
    (await ev(`document.querySelector('[role=alert]').textContent`)).includes(
      'staff position',
    ),
  );
  assert.equal(
    await ev(
      `(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()`,
    ),
    true,
  );
  await button('New chant');
  assert.equal(
    await ev(`Boolean(document.querySelector('[role=alertdialog]'))`),
    true,
  );
  await button('Replace chant');
  await pause(500);
  console.log(
    JSON.stringify(
      {
        passed: true,
        artifacts,
        scenarios: [
          'pointer and keyboard pitch editing',
          'undo and redo',
          'metadata and browser recovery',
          'JSON download and guarded file replacement',
          'strict invalid-file handling',
          'clean SVG and GABC downloads',
          'new chant and all seven graphical tools',
          'continuous lyrics and draft protection',
          '180-neume text clearance',
          '320px and zoom containment',
          'paginated print PDF',
          'shortcut save with pending metadata',
          'corrupt recovery preservation and download',
          'oversized normalized file rejection',
          'real cross-tab write conflict',
          'storage quota failure with file fallback',
          'dirty title and unserializable document unload protection',
          'metadata locks during draft history and anchor movement',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  ws.close();
}
