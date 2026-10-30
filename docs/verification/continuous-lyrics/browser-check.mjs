import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const pages = await (await fetch('http://127.0.0.1:9230/json')).json();
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
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
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, (m) => (m.error ? reject(m.error) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
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

await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', {
  url: 'http://127.0.0.1:5173/docs/verification/placement/browser-fixture.html',
});
for (let i = 0; i < 50; i++) {
  await pause();
  if (await ev("typeof mountChantFixture === 'function'")) break;
}
const mount = async (
  count = 14,
  syllables = [
    {
      id: 'existing',
      text: 'old',
      startsAtNeumeId: 'n4',
      boundaryBefore: 'word',
    },
  ],
) => {
  await ev(
    `mountChantFixture(${JSON.stringify({ title: 'Stage 2', clef: { type: 'c', staffLine: 3 }, syllables, neumes: Array.from({ length: count }, (_, i) => ({ id: `n${i}`, kind: 'punctum', notes: [{ id: `note${i}`, staffPosition: 2 }] })) })})`,
  );
  await pause();
};
const button = async (text) => {
  const found = await ev(
    `(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b)return false;b.click();return true})()`,
  );
  assert(found, `Missing button ${text}`);
  await pause();
};
const key = async (key, text, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    windowsVirtualKeyCode:
      key === 'Backspace'
        ? 8
        : key === 'Delete'
          ? 46
          : key === 'Enter'
            ? 13
            : key === 'Tab'
              ? 9
              : key === 'Escape'
                ? 27
                : 0,
    text,
    modifiers,
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers });
  await pause();
};
const type = async (text) => {
  await send('Input.insertText', { text });
  await pause();
};
const note = async (id) => {
  await ev(
    `document.querySelector('[data-note-id="note${id}"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
  );
  await pause();
};
const input = () => ev("document.querySelector('#lyric-input')?.value ?? null");
const lyrics = () =>
  ev(
    "Array.from(document.querySelectorAll('.score__lyric')).map(n=>n.textContent)",
  );
await mount();
await note(0);
await ev("document.querySelector('[data-note-id=note0]').focus()");
await key('l', 'l');
assert.equal(await input(), '');
await type('Al');
await key('-', '-');
await key('_', '_', 8);
await type('le');
await key(' ', ' ');
await type('lu');
await key('-', '-');
assert.equal(await input(), null);
assert.deepEqual(await lyrics(), ['Al', 'le', 'lu', 'old']);
await key('x', 'x');
assert.deepEqual(await lyrics(), ['Al', 'le', 'lu', 'old']);
await key('_', '_', 8);
assert.equal(await input(), '');
assert.equal(
  await ev(
    'document.querySelector(\'select[aria-label="Word boundary"]\').value',
  ),
  'word',
);
await type('Κύ');
await note(7);
assert.deepEqual(await lyrics(), ['Al', 'le', 'lu', 'old', 'Κύ']);
await type('draft');
await key('Tab');
assert.equal(await input(), 'draft');
assert.equal(await ev("document.activeElement.id === 'lyric-input'"), false);
await button('Lyrics');
assert.equal(await ev('document.activeElement.id'), 'lyric-input');
await ev("document.querySelector('#lyric-input').select()");
await type('two words');
await note(8);
assert.equal(await input(), 'two words');
assert.equal(await ev('document.activeElement.id'), 'lyric-input');
await key('Escape');
assert.equal(await input(), null);
assert.deepEqual(await lyrics(), ['Al', 'le', 'lu', 'old', 'Κύ']);
await ev(
  "document.querySelector('[data-syllable-id=existing].score__lyric').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
);
await pause();
await key('Enter');
await ev("document.querySelector('#lyric-input').select()");
await type('ri');
await key('Enter');
assert.deepEqual(await lyrics(), ['Al', 'le', 'lu', 'ri', 'Κύ']);
assert.equal(await ev('document.activeElement.dataset.syllableId'), 'existing');
await key('s', 's');
await type('an');
assert.equal(await input(), 'san');
await key('Enter');
assert.deepEqual(await lyrics(), ['Al', 'le', 'lu', 'san', 'Κύ']);
await key('-', '-');
assert.equal(await input(), null); // n5 is occupied: pause
await button('Done');
// The first replacement character must not be selected again, even if it equals the old text.
await mount(2, [
  { id: 'single', text: 's', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
]);
await ev(
  "document.querySelector('.score__lyric').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
);
await pause();
await key('s', 's');
await type('an');
assert.equal(await input(), 'san');
assert.equal(
  await ev(
    "document.querySelector('#lyric-input').dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}))",
  ),
  true,
);
// End-of-music remains active and resumes when music is inserted.
await mount(1, []);
await note(0);
await button('Lyrics');
await type('Al');
await key('-', '-');
assert.equal(
  await ev(
    "document.querySelector('.lyric-actions').textContent.includes('End of music')",
  ),
  true,
);
await button('Insert Punctum');
assert.equal(await input(), '');
assert.equal(await ev('document.activeElement.id'), 'lyric-input');
await type('le');
await key('Tab');
await button('Undo');
assert.equal(await ev("!!document.querySelector('[role=dialog]')"), true);
await button('Cancel history');
assert.equal(await input(), 'le');
await button('Undo');
await button('Save draft');
assert.deepEqual(await lyrics(), ['Al']);
await button('Redo');
assert.deepEqual(await lyrics(), ['Al', 'le']);

// IME, paste, repeat and draft recovery use native input plus guarded commands.
await mount(14, []);
await note(10);
await button('Lyrics');
await type('Κύ');
assert.equal(
  await ev("document.querySelector('#lyric-input').dataset.targetNeumeId"),
  'n10',
);
await ev(
  `(()=>{const i=document.querySelector('#lyric-input');i.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'_',isComposing:true,bubbles:true,cancelable:true}));i.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));})()`,
);
assert.deepEqual(await lyrics(), []);
assert.equal(await input(), 'Κύ');
assert.equal(
  await ev(
    `(()=>{const d=new DataTransfer();d.setData('text/plain','two words');return document.querySelector('#lyric-input').dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}))})()`,
  ),
  false,
);
assert.equal(await input(), 'Κύ');
await ev(
  "document.querySelector('#lyric-input').dispatchEvent(new KeyboardEvent('keydown',{key:'_',repeat:true,bubbles:true,cancelable:true}))",
);
assert.equal(
  await ev("document.querySelector('#lyric-input').dataset.targetNeumeId"),
  'n10',
);
await ev(
  "document.querySelector('[data-note-id=note10]').dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}))",
);
await pause();
assert.equal(await input(), null);
assert.equal(
  await ev(
    "document.querySelector('.lyric-actions').textContent.includes('Your text is preserved')",
  ),
  true,
);
await note(11);
await button('Retry at selected neume');
assert.equal(await input(), 'Κύ');
assert.equal(
  await ev("document.querySelector('#lyric-input').dataset.targetNeumeId"),
  'n11',
);
// Input remains the same DOM node while layout changes around its anchor.
await ev("void(window.stage2Input=document.querySelector('#lyric-input'))");
await ev(
  "document.querySelector('[data-note-id=note0]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))",
);
await pause();
// Keyboard target navigation commits the current text rather than losing it.
assert.equal(
  await ev("window.stage2Input===document.querySelector('#lyric-input')"),
  true,
);
await type('Al');
await send('Emulation.setDeviceMetricsOverride', {
  width: 320,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await pause();
assert.equal(
  await ev('document.documentElement.scrollWidth <= innerWidth'),
  true,
);
const bounds = await ev(
  "(()=>{const b=document.querySelector('#lyric-input').getBoundingClientRect();return {left:b.left,right:b.right,width:innerWidth}})()",
);
assert(bounds.left >= 0 && bounds.right <= bounds.width);
console.log(
  'PASS: IME guard, paste rejection, autorepeat, dirty target recovery, retry, persistent input node, responsive input bounds',
);
await send('Emulation.setDeviceMetricsOverride', {
  width: 320,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
assert.equal(
  await ev('document.documentElement.scrollWidth <= innerWidth'),
  true,
);
console.log(
  'PASS: L activation, sequential -/Space/_ entry, occupied protection, Greek text, click commit, native Tab, invalid navigation, Escape, intentional replacement, typed replacement caret, end resumption, history resolution, 320px overflow',
);

// Keyboard-only traversal must reach selection/deletion without mouse or programmatic focus.
const tabToLyric = async () => {
  for (let step = 0; step < 60; step++) {
    await key('Tab');
    if (await ev("document.activeElement.matches('.score__lyric')")) return;
  }
  assert.fail('Tab did not reach an engraved syllable');
};
const lyricsActive = () =>
  ev(
    "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith('Lyrics')).getAttribute('aria-pressed')",
  );
for (const deletion of ['Delete', 'Backspace']) {
  await mount(6, [
    {
      id: 'keyboard',
      text: 'Ky',
      startsAtNeumeId: 'n2',
      boundaryBefore: 'word',
    },
  ]);
  await tabToLyric();
  assert.equal(
    await ev("document.activeElement.getAttribute('aria-pressed')"),
    'false',
  );
  await key(deletion);
  assert.deepEqual(await lyrics(), ['Ky']);
  await key(' ', ' ');
  assert.equal(
    await ev("document.activeElement.getAttribute('aria-pressed')"),
    'true',
  );
  assert.equal(await input(), null);
  assert.equal(await lyricsActive(), 'false');
  await key(deletion);
  assert.deepEqual(await lyrics(), []);
  assert.equal(
    await ev("document.querySelectorAll('[data-neume-id]').length"),
    6,
  );
  assert.equal(await ev('document.activeElement.dataset.noteId'), 'note2');
  assert.equal(await input(), null);
}
// Selected-minus activates continuation entry from Select, retaining the original anchor.
await mount(6, [
  { id: 'keyboard', text: 'Ky', startsAtNeumeId: 'n2', boundaryBefore: 'word' },
]);
await tabToLyric();
await key(' ', ' ');
await key('-', '-');
assert.equal(await input(), '');
assert.equal(
  await ev("document.querySelector('#lyric-input').dataset.targetNeumeId"),
  'n3',
);
assert.equal(
  await ev(
    'document.querySelector(\'select[aria-label="Word boundary"]\').value',
  ),
  'continuation',
);
assert.deepEqual(await lyrics(), ['Ky']);
await type('ri');
await key('Enter');
assert.deepEqual(await lyrics(), ['Ky', 'ri']);
// The same path must pause, rather than overwrite, if the next anchor is occupied.
await mount(6, [
  { id: 'keyboard', text: 'Ky', startsAtNeumeId: 'n2', boundaryBefore: 'word' },
  { id: 'next', text: 'old', startsAtNeumeId: 'n3', boundaryBefore: 'word' },
]);
await tabToLyric();
await key(' ', ' ');
await key('-', '-');
assert.equal(await input(), null);
assert.equal(await lyricsActive(), 'true');
assert.deepEqual(await lyrics(), ['Ky', 'old']);
assert.equal(
  await ev(
    "document.querySelector('.lyric-actions').textContent.includes('Already anchored')",
  ),
  true,
);
// Selection retains engraved ink, with separate purple selection and blue keyboard focus outlines.
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await mount(4, [
  {
    id: 'visual',
    text: 'Kyrie',
    startsAtNeumeId: 'n0',
    boundaryBefore: 'word',
  },
]);
await tabToLyric();
const originalInk = await ev(
  "getComputedStyle(document.querySelector('.score__lyric')).fill",
);
await key(' ', ' ');
const selectedStyle = await ev(
  "(()=>{const t=document.querySelector('.score__lyric'),g=t.parentElement,s=getComputedStyle(g),f=getComputedStyle(t);return {ink:f.fill,decoration:f.textDecorationLine,selection:s.outlineStyle,selectionColor:s.outlineColor,focus:f.outlineStyle,focusColor:f.outlineColor,focusVisible:t.matches(':focus-visible')}})()",
);
assert.equal(selectedStyle.ink, originalInk);
assert.equal(selectedStyle.decoration, 'none');
assert.equal(selectedStyle.selection, 'dashed');
assert.equal(selectedStyle.focus, 'solid');
assert.notEqual(selectedStyle.selectionColor, selectedStyle.focusColor);
assert.equal(selectedStyle.focusVisible, true);
await writeFile(
  'docs/verification/continuous-lyrics/keyboard-selection.png',
  Buffer.from(
    (await send('Page.captureScreenshot', { format: 'png' })).data,
    'base64',
  ),
);
await key('Tab');
assert.equal(
  await ev("!!document.querySelector('.score__lyric-group--selected')"),
  true,
);
console.log(
  'PASS: keyboard-only Tab → Space → Delete/Backspace, inactive-mode continuation, occupied-anchor safety, non-link selection ink and distinct focus',
);
// Single-click selection and both lyric deletion paths share the same semantics.
for (const active of [false, true]) {
  for (const deletion of ['Delete', 'Backspace', 'button']) {
    await mount(14, [
      {
        id: 'deletable',
        text: 'Kyrie',
        startsAtNeumeId: 'n11',
        boundaryBefore: 'word',
      },
    ]);
    if (active) {
      await note(0);
      await button('Lyrics');
    }
    const before = await ev(
      "Array.from(document.querySelectorAll('[data-neume-id]')).map(n=>n.dataset.neumeId)",
    );
    await ev(
      "document.querySelector('.score__lyric').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
    );
    await pause();
    assert.equal(await input(), null);
    assert.equal(
      await ev(
        "document.querySelector('.score__lyric').getAttribute('aria-pressed')",
      ),
      'true',
    );
    assert.equal(
      await ev('document.activeElement.dataset.syllableId'),
      'deletable',
    );
    if (deletion === 'button') await button('Delete syllable');
    else await key(deletion);
    assert.deepEqual(await lyrics(), []);
    assert.equal(await input(), null);
    assert.deepEqual(
      await ev(
        "Array.from(document.querySelectorAll('[data-neume-id]')).map(n=>n.dataset.neumeId)",
      ),
      before,
    );
    assert.equal(await ev('document.activeElement.dataset.noteId'), 'note11');
    assert.equal(
      await ev(
        "document.querySelector('[data-selected-neume-id]').dataset.selectedNeumeId",
      ),
      'n11',
    );
    assert.equal(
      await ev(
        "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith('Lyrics')).getAttribute('aria-pressed')",
      ),
      String(active),
    );
    await ev(
      "document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',repeat:true,bubbles:true,cancelable:true}))",
    );
    await pause();
    assert.equal(
      await ev("document.querySelectorAll('[data-neume-id]').length"),
      14,
    );
    await button('Undo');
    assert.deepEqual(await lyrics(), ['Kyrie']);
    await button('Redo');
    assert.deepEqual(await lyrics(), []);
  }
}
// Editing opens a collapsed normal cursor; typing from selection replaces instead.
await mount(2, [
  {
    id: 'normal',
    text: 'Kyrie',
    startsAtNeumeId: 'n0',
    boundaryBefore: 'word',
  },
]);
await ev(
  "document.querySelector('.score__lyric').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
);
await pause();
await key('Enter');
assert.equal(await input(), 'Kyrie');
assert.equal(
  await ev(
    "document.querySelector('#lyric-input').selectionStart === document.querySelector('#lyric-input').selectionEnd",
  ),
  true,
);
await key('Backspace');
assert.equal(await input(), 'Kyri');
assert.deepEqual(await lyrics(), ['Kyrie']);
await ev("document.querySelector('#lyric-input').setSelectionRange(0,1)");
await key('Delete');
assert.equal(await input(), 'yri');
assert.deepEqual(await lyrics(), ['Kyrie']);
await key('Escape');
assert.deepEqual(await lyrics(), ['Kyrie']);
// A real double-click (including its preceding clicks) opens normal editing.
const lyricPoint = await ev(
  "(()=>{const b=document.querySelector('.score__lyric').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()",
);
for (const clickCount of [1, 2]) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...lyricPoint,
    button: 'left',
    clickCount,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...lyricPoint,
    button: 'left',
    clickCount,
  });
}
await pause();
assert.equal(await input(), 'Kyrie');
assert.equal(
  await ev(
    "document.querySelector('#lyric-input').selectionStart === document.querySelector('#lyric-input').selectionEnd",
  ),
  true,
);
console.log(
  'PASS: single-click selection, Delete/Backspace/button deletion with and without Lyrics mode, preserved neumes, anchor focus, no empty input, atomic undo/redo, repeat protection, normal Enter/double-click cursors, native character deletion',
);
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await mount(10, [
  { id: 'al', text: 'Al', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
  {
    id: 'le',
    text: 'le',
    startsAtNeumeId: 'n3',
    boundaryBefore: 'continuation',
  },
]);
await note(6);
await button('Lyrics');
await type('lu');
await ev('window.scrollTo(0,0)');
await pause();
await writeFile(
  'docs/verification/continuous-lyrics/desktop.png',
  Buffer.from(
    (await send('Page.captureScreenshot', { format: 'png' })).data,
    'base64',
  ),
);
await send('Emulation.setDeviceMetricsOverride', {
  width: 320,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await ev('window.scrollTo(0,0)');
await pause();
assert.equal(
  await ev('document.documentElement.scrollWidth <= innerWidth'),
  true,
);
const laterBounds = await ev(
  "(()=>{const b=document.querySelector('#lyric-input').getBoundingClientRect();return {left:b.left,right:b.right,width:innerWidth}})()",
);
assert(laterBounds.left >= 0 && laterBounds.right <= laterBounds.width);
await writeFile(
  'docs/verification/continuous-lyrics/mobile.png',
  Buffer.from(
    (await send('Page.captureScreenshot', { format: 'png' })).data,
    'base64',
  ),
);
ws.close();
