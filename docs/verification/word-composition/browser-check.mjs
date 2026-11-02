import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const screenshotDirectory = await mkdtemp(
  join(tmpdir(), 'chant-word-composition-'),
);
console.log(`Screenshots: ${screenshotDirectory}`);
const editorUrl = process.env.CHANT_EDITOR_URL ?? 'http://127.0.0.1:5173';
const firefox = Boolean(process.env.CHANT_FIREFOX_URL);
let socketUrl = process.env.CHANT_FIREFOX_URL;
if (!firefox) {
  const pages = await (await fetch('http://127.0.0.1:9230/json')).json();
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

  if (process.env.CHANT_CORPUS) {
    const { runCorpusReview } = await import('./corpus-browser.mjs');
    await runCorpusReview({
      ev,
      send,
      viewport,
      mount,
      shot,
      screenshotDirectory,
    });
  } else {
    const fixture = {
      title: 'Stage 4C — Al ... leluia ah',
      divisions: [],
      lyricLanguage: 'la',
      clef: { type: 'c', staffLine: 3 },
      neumes: Array.from({ length: 8 }, (_, i) => ({
        id: `n${i}`,
        kind: 'punctum',
        notes: [{ id: `note${i}`, staffPosition: 2 }],
      })),
      syllables: ['Al', 'le', 'lu', 'ia', 'ah'].map((text, i) => ({
        id: `s${i}`,
        text,
        startsAtNeumeId: `n${[0, 3, 4, 5, 6][i]}`,
        boundaryBefore: i === 0 || i === 4 ? 'word' : 'continuation',
      })),
    };
    for (const [name, doc] of [
      ['alleluia', fixture],
      [
        'kyrie',
        {
          ...fixture,
          title: 'Kyrie eleison',
          syllables: ['Ky', 'ri', 'e', 'e', 'lei', 'son'].map((text, i) => ({
            id: `s${i}`,
            text,
            startsAtNeumeId: `n${i}`,
            boundaryBefore: i === 0 || i === 3 ? 'word' : 'continuation',
          })),
        },
      ],
      [
        'conditional',
        {
          ...fixture,
          title: 'Wide music — conditional continuation',
          neumes: fixture.neumes.map((n, i) =>
            i === 3
              ? {
                  ...n,
                  kind: 'porrectus',
                  notes: [4, 0, 3].map((p, j) => ({
                    id: `note${i}-${j}`,
                    staffPosition: p,
                  })),
                }
              : n,
          ),
        },
      ],
      [
        'outgoing',
        {
          ...fixture,
          title: 'Word across systems',
          neumes: Array.from({ length: 16 }, (_, i) => ({
            id: `n${i}`,
            kind: 'punctum',
            notes: [{ id: `note${i}`, staffPosition: 2 }],
          })),
          syllables: fixture.syllables.map((s, i) => ({
            ...s,
            startsAtNeumeId: `n${[0, 11, 12, 13, 14][i]}`,
          })),
        },
      ],
    ]) {
      await mount(doc);
      await ev('(window.scrollTo(0,0),true)');
      await shot((process.env.CHANT_BASELINE ? 'before-' : 'after-') + name);
      if (!process.env.CHANT_BASELINE) {
        const marks = await ev(
          `Array.from(document.querySelectorAll('.score__hyphens text')).map(t=>{const b=t.getBBox();return {outgoing:t.dataset.outgoing==='true',left:b.x,right:b.x+b.width}})`,
        );
        if (name === 'alleluia') assert.equal(marks.length, 1);
        if (name === 'kyrie') assert(marks.every((mark) => !mark.outgoing));
        if (name === 'conditional') assert.equal(marks.length, 2);
        if (name === 'outgoing') {
          assert.equal(marks.length, 1);
          assert(marks[0].outgoing);
          assert(marks[0].right <= 656);
        }
        assert(
          await ev(
            `Array.from(document.querySelectorAll('[data-system-index]')).every(s=>{const texts=Array.from(s.querySelectorAll('.score__lyric'));return Array.from(s.querySelectorAll('.score__hyphens text')).every(t=>{const h=t.getBBox();return texts.every(x=>{const b=x.getBBox();return h.x+h.width<=b.x||h.x>=b.x+b.width})})})`,
          ),
          'hyphens clear lyric ink',
        );
      }
      console.log(
        name,
        await ev(
          `Array.from(document.querySelectorAll('.score__lyric')).map(t=>({text:t.textContent,x:t.getBBox().x,right:t.getBBox().x+t.getBBox().width}))`,
        ),
      );
    }
    if (!process.env.CHANT_BASELINE) {
      await ev(
        `(async()=>{const l=await import('/src/editor/layout/layout-chant.ts');const m=await import('/src/editor/rendering/use-lyric-measurement.ts');window.compositionLayout=doc=>l.layoutChant(doc,m.createSvgLyricMeasurer());return true})()`,
      );
      await mount(fixture);
      const marks = await ev(
        `Array.from(document.querySelectorAll('.score__hyphens text')).map(t=>({outgoing:t.dataset.outgoing,hidden:t.parentElement.getAttribute('aria-hidden'),pointer:getComputedStyle(t).pointerEvents}))`,
      );
      assert.equal(marks.length, 1);
      assert.equal(marks[0].hidden, 'true');
      assert.equal(marks[0].pointer, 'none');
      for (const width of [1440, 320]) {
        await viewport(width);
        await pause();
        const kinds = [
          'punctum',
          'podatus',
          'clivis',
          'scandicus',
          'torculus',
          'climacus',
          'porrectus',
        ];
        const contours = [
          [2],
          [2, 4],
          [4, 2],
          [1, 2, 4],
          [2, 4, 3],
          [4, 3, 2],
          [4, 2, 3],
        ];
        for (let k = 0; k < 7; k++) {
          const doc = {
            ...fixture,
            neumes: [0, 1].map((i) => ({
              id: `n${i}`,
              kind: kinds[k],
              notes: contours[k].map((p, j) => ({
                id: `note${i}-${j}`,
                staffPosition: p,
              })),
            })),
            syllables: fixture.syllables.slice(0, 2).map((s, i) => ({
              ...s,
              text: ['le', 'lu'][i],
              startsAtNeumeId: `n${i}`,
            })),
          };
          await mount(doc);
          const points = await ev(
            `(()=>{const l=compositionLayout(${JSON.stringify(doc)});return l.systems[0].neumes.flatMap(n=>n.notes.map(note=>({id:note.noteId,x:Math.max(n.hitClip?.left??-Infinity,Math.min(n.hitClip?.right??Infinity,note.hitBounds.x+note.hitBounds.width/2)),y:note.hitBounds.y+note.hitBounds.height/2})))})()`,
          );
          for (const point of points) {
            const client = await ev(
              `(()=>{const svg=document.querySelector('.score');const p=new DOMPoint(${point.x},${point.y}).matrixTransform(svg.getScreenCTM());window.scrollBy(0,p.y-innerHeight/2);const q=new DOMPoint(${point.x},${point.y}).matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y}})()`,
            );
            for (const type of ['mousePressed', 'mouseReleased'])
              await send('Input.dispatchMouseEvent', {
                type,
                ...client,
                button: 'left',
                clickCount: 1,
              });
            await pause();
            assert.equal(
              await ev(
                `document.querySelector('[data-note-id="${point.id}"]').getAttribute('aria-pressed')`,
              ),
              'true',
              `${kinds[k]} ${point.id} at ${width}`,
            );
          }
          // Shift-select the following whole neume using native pointer input.
          const target = points.at(-1);
          const client = await ev(
            `(()=>{const svg=document.querySelector('.score');const p=new DOMPoint(${target.x},${target.y}).matrixTransform(svg.getScreenCTM());window.scrollBy(0,p.y-innerHeight/2);const q=new DOMPoint(${target.x},${target.y}).matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y}})()`,
          );
          if (firefox)
            await rawSend('input.performActions', {
              context,
              actions: [
                {
                  type: 'key',
                  id: 'shift',
                  actions: [{ type: 'keyDown', value: '\uE008' }],
                },
              ],
            });
          for (const type of ['mousePressed', 'mouseReleased'])
            await send('Input.dispatchMouseEvent', {
              type,
              ...client,
              button: 'left',
              clickCount: 1,
              modifiers: 8,
            });
          if (firefox)
            await rawSend('input.performActions', {
              context,
              actions: [
                {
                  type: 'key',
                  id: 'shift',
                  actions: [{ type: 'keyUp', value: '\uE008' }],
                },
              ],
            });
          await pause();
          const inspectCue = async (selector) =>
            ev(
              `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;const url=el.closest('[clip-path]')?.getAttribute('clip-path');if(!url)return false;const rect=document.querySelector(url.slice(4,-1)+' rect');const owner=el.closest('[data-neume-id]'),ink=owner.querySelector('.score__ink').getBBox(),previous=owner.previousElementSibling?.querySelector('.score__ink')?.getBBox();return Number(rect.getAttribute('x'))<=ink.x&&(!previous||Number(rect.getAttribute('x'))>=previous.x+previous.width)})()`,
            );
          assert(
            await inspectCue('.score__neume-selection'),
            `${kinds[k]} selected whole-neume cue must be clipped`,
          );
          if (k === 0) {
            await ev('(window.scrollTo(0,0),true)');
            await shot(`compact-whole-selection-${width}`);
          }
          await ev(
            `(document.querySelector('[data-tool="punctum"]').click(),true)`,
          );
          await pause();
          assert(
            await inspectCue('.score__placement-context'),
            'placement cue must be clipped',
          );
          await ev(
            `(document.querySelector('[data-tool="select"]').click(),true)`,
          );
          await pause();
          await ev(
            `(document.querySelector('.score__lyric').dispatchEvent(new MouseEvent('click',{bubbles:true})),true)`,
          );
          await pause();
          await ev(
            `(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('Move syllable:'));if(!b)throw Error('missing move control');b.click();return true})()`,
          );
          await pause();
          assert(
            await inspectCue('.score__move-target'),
            'lyric-move decoration must be clipped',
          );
        }
      }
      const edgeSource = {
        ...fixture,
        title: 'First source lyric and outgoing reservation',
        neumes: fixture.neumes.slice(0, 2),
        syllables: [
          {
            ...fixture.syllables[0],
            text: 'a' + 'b'.repeat(42),
            startsAtNeumeId: 'n0',
          },
          { ...fixture.syllables[1], text: 'le', startsAtNeumeId: 'n1' },
        ],
      };
      await viewport(1440);
      await mount(edgeSource);
      const edge = await ev(
        `(()=>{const groups=document.querySelectorAll('[data-system-index]'),mark=groups[0].querySelector('.score__hyphens text');if(!mark)return null;const b=mark.getBBox(),line=groups[0].querySelector('.score__staff-line');return {systems:groups.length,right:b.x+b.width,staffRight:Number(line.getAttribute('x2')),width:document.querySelector('.score').viewBox.baseVal.width}})()`,
      );
      assert(
        edge &&
          edge.systems === 2 &&
          edge.right <= edge.staffRight + 0.05 &&
          edge.width === 720,
        'near-edge first source must reserve its displayed outgoing mark',
      );
      console.log(
        'PASS: native pointer ownership for every constituent of all seven compact neume pairs at desktop and 320px; clipped selection/placement/move cues and inert measured hyphens.',
      );
    }
  }
} finally {
  try {
    if (ownsSession) await rawSend('session.end');
  } finally {
    ws.close();
  }
}
