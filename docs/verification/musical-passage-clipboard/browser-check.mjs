import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const screenshotDirectory = await mkdtemp(join(tmpdir(), 'chant-clipboard-'));
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

  // Native Ctrl+<key> chord (Control in both transports). Optional CDP
  // editing commands make Chromium perform the native text operation.
  const chord = async (name, commands) => {
    if (firefox)
      await rawSend('input.performActions', {
        context,
        actions: [
          {
            type: 'key',
            id: 'keyboard',
            actions: [
              { type: 'keyDown', value: '' },
              { type: 'keyDown', value: name },
              { type: 'keyUp', value: name },
              { type: 'keyUp', value: '' },
            ],
          },
        ],
      });
    else {
      await rawSend('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'Control',
        code: 'ControlLeft',
        windowsVirtualKeyCode: 17,
        modifiers: 2,
      });
      await rawSend('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        modifiers: 2,
        key: name,
        code: 'Key' + name.toUpperCase(),
        windowsVirtualKeyCode: name.toUpperCase().charCodeAt(0),
        ...(commands ? { commands } : {}),
      });
      await rawSend('Input.dispatchKeyEvent', {
        type: 'keyUp',
        modifiers: 2,
        key: name,
        code: 'Key' + name.toUpperCase(),
        windowsVirtualKeyCode: name.toUpperCase().charCodeAt(0),
      });
      await rawSend('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Control',
        code: 'ControlLeft',
        windowsVirtualKeyCode: 17,
        modifiers: 0,
      });
    }
    await pause();
    await pause();
  };
  const note = (id) => `[data-note-id="${id}"]`;
  const focus = async (selector) => {
    await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.focus();return true})()`,
    );
    await pause();
  };
  const saved = () =>
    ev(`localStorage.getItem('gregorian-chant-editor:active-document:v1')`);
  const savedDoc = async () => JSON.parse(await saved()).document;
  // Sighted feedback: rendered, unclipped, inside the viewport, topmost at its
  // centre, and not itself a live region (the hidden announcer speaks once).
  const visibleFeedback = () =>
    ev(`(()=>{
      const e=document.querySelector('#clipboard-feedback');
      if(!e)return null;
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);
      const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {
        text:e.textContent,
        visible:r.width>20&&r.height>8&&r.top>=0&&r.bottom<=innerHeight&&s.visibility==='visible'&&s.clipPath==='none'&&Number(s.opacity)>0.9&&e.contains(top),
        live:e.closest('[aria-live]')!==null,
        describesPaste:[...document.querySelectorAll('.editor-actions button')].some(b=>b.getAttribute('aria-describedby')==='clipboard-feedback'),
      };
    })()`);
  const announcement = () =>
    ev(`document.querySelector('.editor-announcement')?.textContent ?? ''`);
  const rangeStatus = () =>
    ev(`document.querySelector('#range-selection-status')?.textContent ?? ''`);
  const button = (label) =>
    ev(
      `(()=>{const b=[...document.querySelectorAll('.editor-actions button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(label)}));return b?{disabled:b.disabled,label:b.getAttribute('aria-label'),text:b.textContent.trim()}:null})()`,
    );
  const clickButton = async (label) => {
    const found = await ev(
      `(()=>{document.querySelector('[data-driver-target]')?.removeAttribute('data-driver-target');const b=[...document.querySelectorAll('.editor-actions button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(label)}));b?.setAttribute('data-driver-target','');return Boolean(b)})()`,
    );
    assert.ok(found, `Missing ${label} button`);
    await nativeClick('[data-driver-target]');
    await pause();
  };
  // Focus is on a note and visible: below the sticky toolbar, inside the
  // viewport and the horizontally scrolling score.
  const focusVisible = () =>
    ev(`(()=>{
      const e=document.activeElement,n=e?.closest('[data-note-id]');
      if(!n)return {noteId:null};
      const r=n.getBoundingClientRect(),t=document.querySelector('.editor-sticky-toolbar');
      const sticky=getComputedStyle(t).position==='sticky';
      const v=document.querySelector('.score-viewport').getBoundingClientRect();
      const top=sticky?t.getBoundingClientRect().bottom:0;
      return {noteId:n.dataset.noteId,visible:r.top>=top-1&&r.bottom<=innerHeight+1&&r.left>=v.left-1&&r.right<=v.right+1};
    })()`);
  // Records whether each keydown reached the window with default prevented.
  const watchKeys = () =>
    ev(
      `(window.__keys=[],window.__watching||(window.addEventListener('keydown',e=>window.__keys.push({key:e.key,prevented:e.defaultPrevented})),window.__watching=true),true)`,
    );
  const backgroundFocus = new Set();
  const activeKind = () =>
    ev(
      `document.activeElement===document.body||!document.activeElement?'body':document.activeElement.closest('[data-note-id]')?'note':document.activeElement.tagName`,
    );
  // Plain click on empty score surface (left margin, below the staff).
  const clickBackground = async () => {
    const p = await ev(
      `(()=>{const s=document.querySelector('svg.score')??document.querySelector('.score');s.scrollIntoView({block:'center'});const v=document.querySelector('.score-viewport');v.scrollLeft=0;const r=s.getBoundingClientRect(),vb=v.getBoundingClientRect();return {x:Math.max(r.left,vb.left)+4,y:Math.min(r.bottom,innerHeight)-4}})()`,
    );
    await pause();
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', {
        type,
        ...p,
        button: type === 'mouseMoved' ? 'none' : 'left',
        clickCount: 1,
      });
    await pause();
    await pause();
  };
  const lastKey = () => ev(`window.__keys.at(-1) ?? null`);
  const shiftKey = async (name) => key(name, true);
  const strip = (n) => ({
    kind: n.kind,
    notes: n.notes.map(({ id: _id, ...rest }) => rest),
  });
  let f;

  // ---------------------------------------------------------------------
  // Synthetic multi-system fixture: compatible no-accidental repeat path.
  // ---------------------------------------------------------------------
  const kinds = [
    ['clivis', [6, 4]],
    ['podatus', [2, 4]],
    ['torculus', [2, 5, 3]],
    ['punctum', [5]],
  ];
  const neumes = Array.from({ length: 28 }, (_, i) => {
    const [kind, positions] = kinds[i % kinds.length];
    return {
      id: `n${i}`,
      kind,
      notes: positions.map((staffPosition, j) => ({
        id: `n${i}-${j}`,
        staffPosition,
        ...(i === 2 && j === 2 ? { mora: 1 } : {}),
        ...(i === 1 && j === 0 ? { episema: true } : {}),
      })),
    };
  });
  const structural = {
    title: 'Clipboard driver',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    divisions: [{ id: 'bar', kind: 'minima', beforeNeumeId: 'n4' }],
    clefChanges: [],
    syllables: neumes.map((n, i) => ({
      id: `s${i}`,
      text: ['lau', 'da', 'te', 'Do'][i % 4] + 'mi',
      startsAtNeumeId: n.id,
      boundaryBefore: i % 4 ? 'continuation' : 'word',
    })),
    neumes,
  };
  for (const width of [1440, 390]) {
    await viewport(width);
    await mount(structural);
    await watchKeys();
    const systems = await ev(
      `new Set([...document.querySelectorAll('[data-system-index]')].map(e=>e.dataset.systemIndex)).size`,
    );
    assert.ok(systems > 1, `${width}px fixture is not multi-system`);
    assert.equal((await button('Paste')).disabled, true, 'Paste enabled empty');
    assert.equal((await button('Copy')).disabled, true, 'Copy enabled empty');
    // Note selection cannot copy a partial neume; it announces why.
    await nativeClick(note('n1-0'));
    await chord('c');
    assert.equal((await lastKey()).prevented, true);
    assert.match(await announcement(), /^Nothing copied/);
    const copyFeedback = await visibleFeedback();
    assert.match(copyFeedback?.text ?? '', /^Nothing copied/);
    assert.ok(copyFeedback.visible, `${width}px copy feedback not visible`);
    // Keyboard range n1..n3, entirely before the minima at n4.
    await focus(note('n1-0'));
    await shiftKey('Enter');
    await shiftKey('ArrowRight');
    await shiftKey('ArrowRight');
    assert.match(await rangeStatus(), /^3 neumes selected/);
    assert.equal(await visibleFeedback(), null, 'stale feedback after select');
    await chord('c');
    assert.equal(await announcement(), 'Copied 3 neumes.');
    assert.equal(await saved(), null, 'copy saved the document');
    const paste = await button('Paste');
    assert.equal(paste.disabled, false);
    assert.equal(paste.label, 'Paste 3 copied neumes');
    // Paste after a selected note's neume (n5), via Ctrl+V.
    await nativeClick(note('n5-0'));
    await chord('v');
    assert.equal((await lastKey()).prevented, true);
    let doc = await savedDoc();
    let ids = doc.neumes.map((n) => n.id);
    assert.equal(ids.length, 31);
    assert.deepEqual(ids.slice(0, 6), ['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
    assert.equal(ids[9], 'n6');
    assert.deepEqual(
      doc.neumes.slice(6, 9).map(strip),
      neumes.slice(1, 4).map(strip),
      'pasted contours/marks differ',
    );
    const original = new Set(
      neumes.flatMap((n) => [n.id, ...n.notes.map((x) => x.id)]),
    );
    for (const n of doc.neumes.slice(6, 9))
      for (const id of [n.id, ...n.notes.map((x) => x.id)])
        assert.ok(!original.has(id), `reused ID ${id}`);
    assert.deepEqual(doc.syllables, structural.syllables, 'lyrics changed');
    assert.match(await rangeStatus(), /^3 neumes selected/);
    f = await focusVisible();
    assert.equal(f.noteId, doc.neumes[8].notes[0].id, 'focus not on final');
    assert.ok(f.visible, `${width}px focus hidden after paste`);
    await shot(`paste-after-note-${width}`);
    // Repeat paste (focus remains in the score) inserts after the new range.
    await chord('v');
    doc = await savedDoc();
    ids = doc.neumes.map((n) => n.id);
    assert.equal(ids.length, 34);
    assert.equal(ids[12], 'n6');
    assert.equal(new Set(ids).size, 34);
    f = await focusVisible();
    assert.equal(f.noteId, doc.neumes[11].notes[0].id);
    assert.ok(f.visible);
    // A held key's repeated keydown is claimed but never pastes again.
    await ev(
      `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,repeat:true,bubbles:true,cancelable:true})),true`,
    );
    await pause();
    assert.equal((await savedDoc()).neumes.length, 34, 'key repeat pasted');
    // Undo/Redo by native shortcut and button.
    const afterTwo = await saved();
    await chord('z');
    assert.equal((await savedDoc()).neumes.length, 31);
    assert.equal(await rangeStatus(), '', 'range survived undo');
    await clickButton('Undo');
    assert.deepEqual(
      (await savedDoc()).neumes.map((n) => n.id),
      neumes.map((n) => n.id),
    );
    await clickButton('Redo');
    await clickButton('Redo');
    assert.equal(await saved(), afterTwo, 'redo bytes differ');
    // Keyboard paste with no selection after clicking the score background:
    // nothing is focused, and Ctrl+V appends at the true end.
    await key('Escape');
    await clickBackground();
    assert.equal(await rangeStatus(), '', 'background click kept range');
    // Chromium moves focus to <body>; Firefox keeps the previously focused
    // note. Blur explicitly so "nothing focused" is exercised in both.
    backgroundFocus.add(await activeKind());
    await ev(`(document.activeElement?.blur(),true)`);
    assert.equal(await activeKind(), 'body');
    await chord('v');
    assert.equal((await lastKey()).prevented, true);
    doc = await savedDoc();
    assert.equal(doc.neumes.length, 37, 'keyboard append after background');
    assert.equal(doc.neumes.at(-4).id, 'n27');
    f = await focusVisible();
    assert.equal(f.noteId, doc.neumes.at(-1).notes[0].id);
    assert.ok(f.visible, `${width}px focus hidden after append`);
    await shot(`paste-append-${width}`);
    // Escape clears the pasted range; focus stays on a note; Ctrl+V appends.
    await key('Escape');
    assert.equal(await rangeStatus(), '');
    await chord('v');
    doc = await savedDoc();
    assert.equal(doc.neumes.length, 40, 'keyboard append after Escape');
    assert.equal(doc.neumes.at(-7).id, 'n27');
    // Button path with no selection also appends at the true end.
    await key('Escape');
    await clickButton('Paste');
    doc = await savedDoc();
    assert.equal(doc.neumes.length, 43, 'button append');
    f = await focusVisible();
    assert.equal(f.noteId, doc.neumes.at(-1).notes[0].id);
  }

  // Text editing keeps native clipboard: no prevention, clipboard unchanged.
  await viewport(1440);
  await mount(structural);
  await watchKeys();
  await focus(note('n0-0'));
  await shiftKey('Enter');
  await chord('c');
  assert.equal((await button('Paste')).label, 'Paste 1 copied neume');
  await nativeClick('.document-header__title-button');
  assert.equal(
    await ev(`document.activeElement?.getAttribute('aria-label')`),
    'Chant title',
  );
  const before = await announcement();
  await chord('a', ['selectAll']);
  await chord('c', ['copy']);
  assert.equal((await lastKey()).prevented, false, 'title Ctrl+C prevented');
  await ev(`(document.activeElement.setSelectionRange(99,99),true)`);
  await chord('v', ['paste']);
  assert.equal((await lastKey()).prevented, false, 'title Ctrl+V prevented');
  const titleValue = await ev(`document.activeElement.value`);
  const nativeTextRoundTrip = titleValue === 'Clipboard driverClipboard driver';
  assert.equal(await announcement(), before, 'title clipboard announced');
  assert.equal((await button('Paste')).label, 'Paste 1 copied neume');
  await key('Escape');
  // A real browser text selection keeps native copy even in notation scope.
  await focus(note('n2-0'));
  await ev(
    `getSelection().selectAllChildren(document.querySelector('.chant-editor p')),true`,
  );
  await chord('c');
  assert.equal((await lastKey()).prevented, false, 'text selection copy');
  assert.equal((await button('Paste')).label, 'Paste 1 copied neume');
  await ev(`getSelection().removeAllRanges(),true`);

  // ---------------------------------------------------------------------
  // Deterministic accidental conflict: rejection keeps bytes and history.
  // C3: position 3 is B. p3 owns a flat; p1 is an unsigned B-natural.
  // ---------------------------------------------------------------------
  await mount({
    title: 'Clipboard conflict',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    divisions: [],
    clefChanges: [],
    syllables: [],
    accidentals: [{ id: 'flat', kind: 'flat', ownerNoteId: 'p3-0' }],
    neumes: [4, 3, 5, 3].map((staffPosition, i) => ({
      id: `p${i}`,
      kind: 'punctum',
      notes: [{ id: `p${i}-0`, staffPosition }],
    })),
  });
  await focus(note('p3-0'));
  await shiftKey('Enter');
  await chord('c');
  assert.equal(await announcement(), 'Copied 1 neume.');
  // Compatible: append at the end (the pasted B carries its own flat).
  await key('Escape');
  await clickButton('Paste');
  const good = await saved();
  assert.equal(JSON.parse(good).document.accidentals.length, 2);
  // Conflict: after p0 the copied flat would alter the existing p1.
  await nativeClick(note('p0-0'));
  const undoBefore = (await button('Undo')).disabled;
  const redoBefore = (await button('Redo')).disabled;
  await chord('v');
  const conflict =
    /^Cannot paste: the copied music would change existing note 1 after the insertion point from B-natural to B-flat\.$/;
  assert.match(await announcement(), conflict);
  const feedback = await visibleFeedback();
  assert.match(feedback?.text ?? '', conflict, 'conflict feedback missing');
  assert.ok(feedback.visible, 'conflict explanation is not visible');
  assert.equal(feedback.live, false, 'feedback would be spoken twice');
  assert.ok(feedback.describesPaste, 'Paste not described by feedback');
  assert.ok((await focusVisible()).visible, 'feedback hid focused note');
  await shot('conflict-feedback');
  assert.equal(await saved(), good, 'rejected paste changed saved bytes');
  assert.equal((await button('Undo')).disabled, undoBefore);
  assert.equal((await button('Redo')).disabled, redoBefore);
  assert.equal(
    await ev(
      `document.querySelector('[data-note-id="p0-0"]').getAttribute('aria-pressed')`,
    ),
    'true',
    'rejection changed selection',
  );
  await chord('z');
  assert.equal((await savedDoc()).neumes.length, 4, 'one paste, one undo');
  assert.equal(await visibleFeedback(), null, 'feedback survived undo');

  // ---------------------------------------------------------------------
  // Bundled Kyrie XI through the application: eleison passage 3..8, with a
  // flat whose above-note anchor lies inside the copy.
  // ---------------------------------------------------------------------
  await send('Page.navigate', { url: editorUrl + '/' });
  await pause();
  await pause();
  await ev(`window.confirm=()=>true;true`);
  const loadExample = async () => {
    await ev(
      `window.confirm=()=>true;(()=>{const e=document.querySelector('[aria-label="Load example"]');const o=[...e.options].find(o=>/Kyrie XI/i.test(o.textContent));e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`,
    );
    await new Promise((r) => setTimeout(r, 600));
  };
  await loadExample();
  await watchKeys();
  const kyrie = await savedDoc();
  assert.equal(kyrie.neumes.length, 40);
  const k = kyrie.neumes.map((n) => n.id);
  await focus(note(kyrie.neumes[3].notes[0].id));
  await shiftKey('Enter');
  for (let i = 0; i < 5; i++) await shiftKey('ArrowRight');
  assert.match(await rangeStatus(), /^6 neumes selected/);
  await chord('c');
  assert.equal(await announcement(), 'Copied 6 neumes.');
  // Paste after "son." of the Christe (neume 18).
  await nativeClick(note(kyrie.neumes[18].notes[0].id));
  await chord('v');
  let pasted = await savedDoc();
  assert.equal(pasted.neumes.length, 46);
  assert.deepEqual(
    pasted.neumes.slice(0, 19).map((n) => n.id),
    k.slice(0, 19),
  );
  assert.equal(pasted.neumes[25].id, k[19]);
  assert.deepEqual(
    pasted.neumes.slice(19, 25).map(strip),
    kyrie.neumes.slice(3, 9).map(strip),
    'Kyrie contours/marks differ',
  );
  const pastedIds = new Set(
    pasted.neumes.slice(19, 25).flatMap((n) => n.notes.map((x) => x.id)),
  );
  const newSigns = pasted.accidentals.filter((a) =>
    pastedIds.has(a.ownerNoteId),
  );
  assert.equal(newSigns.length, 1);
  assert.equal(newSigns[0].placement.noteId, pasted.neumes[19].notes[0].id);
  assert.ok(!kyrie.accidentals.some((a) => a.id === newSigns[0].id));
  assert.deepEqual(pasted.syllables, kyrie.syllables);
  assert.deepEqual(
    pasted.divisions.map((d) => d.id),
    kyrie.divisions.map((d) => d.id),
  );
  assert.match(await rangeStatus(), /^6 neumes selected/);
  f = await focusVisible();
  assert.equal(f.noteId, pasted.neumes[24].notes[0].id);
  assert.ok(f.visible, 'Kyrie focus hidden');
  await shot('kyrie-paste');
  await chord('v');
  pasted = await savedDoc();
  assert.equal(pasted.neumes.length, 52);
  assert.equal(pasted.neumes[31].id, k[19]);
  await chord('z');
  await chord('z');
  assert.deepEqual(await savedDoc(), kyrie, 'Kyrie undo bytes differ');

  // Clipboard survives New and bundled example replacement (not persisted).
  await nativeClick('.document-header__actions button:first-of-type');
  assert.equal((await savedDoc()).neumes.length, 0);
  assert.equal((await button('Paste')).label, 'Paste 6 copied neumes');
  assert.ok(!(await saved()).includes('clipboard'));
  // Immediately press Ctrl+V (focus is still on New, outside the score).
  assert.equal(await ev(`document.activeElement?.textContent?.trim()`), 'New');
  await chord('v');
  const blank = await savedDoc();
  assert.equal(blank.neumes.length, 6);
  assert.equal(blank.accidentals.length, 1);
  await loadExample();
  assert.equal((await savedDoc()).neumes.length, 40);
  assert.equal((await button('Paste')).label, 'Paste 6 copied neumes');
  await viewport(390);
  await nativeClick(note(kyrie.neumes[38].notes[0].id));
  await chord('v');
  f = await focusVisible();
  assert.ok(f.visible, 'narrow Kyrie focus hidden');
  await shot('kyrie-paste-390');

  console.log(
    `Focus after score-background click: ${[...backgroundFocus].join(', ')}`,
  );
  console.log(
    `Native text clipboard round trip in title input: ${nativeTextRoundTrip ? 'yes' : 'not observable in this headless browser'}`,
  );
  console.log(
    'PASS: copy/paste by native Ctrl+C/V and buttons, paste after note, range and score end, repeated paste across systems at 1440/390px with visible focus, key-repeat guard, undo/redo bytes, text-input and text-selection native clipboard unaffected, deterministic accidental rejection with unchanged bytes/history/selection, Kyrie XI eleison duplication with remapped internal anchor, and clipboard across New/example replacement.',
  );
} finally {
  if (ownsSession) await rawSend('session.end').catch(() => {});
  ws.close();
}
