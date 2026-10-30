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
await send('Page.navigate', {
  url: 'http://127.0.0.1:5173/docs/verification/placement/browser-fixture.html',
});
for (let i = 0; i < 50; i++) {
  await pause();
  if (await ev("typeof mountChantFixture === 'function'")) break;
}
await ev(
  `mountChantFixture({title:'Stage 1',clef:{type:'c',staffLine:3},syllables:[],neumes:[]})`,
);
await pause();
const button = (text) =>
  ev(
    `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(${JSON.stringify(text)}))?.click()`,
  );
await button('Insert Punctum');
await pause();
assert.equal(await ev("document.querySelectorAll('.score__note').length"), 1);
await ev(
  "document.querySelector('.score__note').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
);
await pause();
await ev("document.querySelector('#new-syllable').focus()");
await send('Input.insertText', { text: 'Ky' });
await button('Add');
await pause();
assert.equal(
  await ev("document.querySelector('.score__lyric').textContent"),
  'Ky',
);
await ev(
  "document.querySelector('.score__note').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
);
await pause();
assert.equal(
  await ev(
    "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Add').disabled",
  ),
  true,
);
await button('Insert Punctum');
await pause();
assert.equal(await ev("document.querySelectorAll('.score__note').length"), 2);
await ev(
  "document.querySelector('.score__note').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
);
await pause();
await ev(
  "document.querySelector('.score__note').dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}))",
);
await pause();
assert.equal(await ev("document.querySelectorAll('.score__note').length"), 1);
assert.equal(await ev("document.querySelectorAll('.score__lyric').length"), 0);
await button('Undo');
await pause();
assert.equal(await ev("document.querySelectorAll('.score__note').length"), 2);
assert.equal(
  await ev("document.querySelector('.score__lyric').textContent"),
  'Ky',
);
await button('Redo');
await pause();
assert.equal(await ev("document.querySelectorAll('.score__lyric').length"), 0);
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
  'PASS: lyricless insertion, anchored creation, occupied protection, independent insertion, anchor deletion, undo/redo, 320px overflow',
);
ws.close();
