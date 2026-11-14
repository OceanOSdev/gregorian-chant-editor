import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Called by the existing word-composition driver in both supported transports.
export async function runIntraSyllableReview({
  ev,
  send,
  viewport,
  mount,
  shot,
  key,
  shift,
  screenshotDirectory,
}) {
  const pause = () => new Promise((r) => setTimeout(r, 100));
  const data = await ev(`(async()=>{
    const f=await import('/docs/verification/intra-syllable-grouping/fixtures.ts');
    const p=await import('/src/editor/interaction/resolve-graphical-neume-placement.ts');
    const c=await import('/src/editor/persistence/native-document.ts');
    window.intraPlacement=p.resolveGraphicalNeumePlacement;
    window.intraDecode=c.decodeDocument;
    return {specimens:f.spacingSpecimens,ownership:f.ownershipSpecimen};
  })()`);
  const results = [];
  const cache = () =>
    ev(
      `JSON.parse(localStorage.getItem('gregorian-chant-editor:active-document:v1'))`,
    );
  const closePanel = async () => {
    await ev(
      `(()=>{document.querySelector('[aria-label="Close note properties"]')?.click();return true})()`,
    );
    await pause();
  };
  const point = async (x, y) =>
    ev(`(()=>{
    const svg=document.querySelector('.score');let p=new DOMPoint(${x},${y}).matrixTransform(svg.getScreenCTM());
    window.scrollBy(0,p.y-innerHeight/2);p=new DOMPoint(${x},${y}).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};
  })()`);
  const click = async (client, whole = false) => {
    if (whole) await shift(true);
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', {
        type,
        ...client,
        button: 'left',
        clickCount: 1,
        modifiers: whole ? 8 : 0,
      });
    if (whole) await shift(false);
    await pause();
  };
  const selectNote = async (id) => {
    await closePanel();
    const client = await ev(`(()=>{
      const el=document.querySelector('[data-note-id="${id}"]');el.scrollIntoView({block:'center',behavior:'instant'});
      const b=el.querySelector('.score__note-hit-target').getBoundingClientRect();
      for(const fy of [.5,.3,.7,.1,.9])for(const fx of [.5,.3,.7,.1,.9]){
        const x=b.x+b.width*fx,y=b.y+b.height*fy;
        if(document.elementFromPoint(x,y)?.closest('[data-note-id]')?.dataset.noteId==='${id}')return {x,y};
      }throw Error('No painted pointer region for ${id}');
    })()`);
    await click(client);
    assert.equal(
      await ev(
        `document.querySelector('[data-note-id="${id}"]').getAttribute('aria-pressed')`,
      ),
      'true',
      `native selection ${id}`,
    );
    assert.equal(
      await ev(`document.activeElement.dataset.noteId`),
      id,
      `native focus ${id}`,
    );
    return client;
  };
  const inspect = async (doc) =>
    ev(`(()=>{
    const doc=${JSON.stringify(doc)},l=compositionLayout(doc),owners=new Map();
    // Independent interval oracle, not the production membership classifier.
    doc.syllables.forEach((s,i)=>{const a=doc.neumes.findIndex(n=>n.id===s.startsAtNeumeId),next=doc.syllables[i+1],b=next?doc.neumes.findIndex(n=>n.id===next.startsAtNeumeId):doc.neumes.length;for(const n of doc.neumes.slice(a,b))owners.set(n.id,s.id)});
    const errors=[],gaps=[];const tol=.5/document.querySelector('.score').getScreenCTM().a+.05;
    for(const s of l.systems)for(let i=0;i<s.neumes.length;i++){
      const n=s.neumes[i],el=document.querySelector('[data-neume-id="'+n.neumeId+'"]');
      const boxes=Array.from(el.querySelectorAll('.score__ink,.score__accidental-ink')).map(e=>e.getBBox());
      const painted={left:Math.min(...boxes.map(b=>b.x)),right:Math.max(...boxes.map(b=>b.x+b.width))};
      if(painted.left<n.bounds.x-tol||painted.right>n.bounds.x+n.bounds.width+tol)errors.push('unmeasured ink '+n.neumeId);
      if(Number(el.closest('[data-system-index]').dataset.systemIndex)!==s.index)errors.push('system '+n.neumeId);
      const prev=s.neumes[i-1];if(!prev)continue;
      const a=prev.bounds.x+prev.bounds.width,gap=n.bounds.x-a;
      const blocked=doc.divisions.some(e=>e.beforeNeumeId===n.neumeId)||doc.clefChanges.some(e=>e.beforeNeumeId===n.neumeId)||!!prev.accidentals?.length||!!n.accidentals?.length;
      const eligible=owners.has(n.neumeId)&&owners.get(n.neumeId)===owners.get(prev.neumeId)&&!blocked;
      if(eligible&&Math.abs(gap-6)>1e-7)errors.push('eligible gap '+n.neumeId+': '+gap);
      if(owners.get(n.neumeId)===owners.get(prev.neumeId)&&blocked&&gap<33-1e-7)errors.push('barrier '+n.neumeId);
      if(gap<33){const clip=el.querySelector('clipPath rect');if(!clip||Math.abs(Number(clip.getAttribute('x'))-(a+n.bounds.x)/2)>1e-7)errors.push('clip '+n.neumeId);const prevClip=document.querySelector('[data-neume-id="'+prev.neumeId+'"] clipPath rect');if(!prevClip||Math.abs(Number(prevClip.getAttribute('x'))+Number(prevClip.getAttribute('width'))-(a+n.bounds.x)/2)>1e-7)errors.push('previous clip '+prev.neumeId)}
      gaps.push({before:prev.neumeId,after:n.neumeId,gap,eligible,blocked});
    }
    const lyrics=Array.from(document.querySelectorAll('.score__lyric'));
    for(const syl of doc.syllables){const t=lyrics.filter(e=>e.dataset.syllableId===syl.id);if(t.length!==1)errors.push('lyric count '+syl.id);else{const n=l.systems.flatMap(s=>s.neumes).find(n=>n.neumeId===syl.startsAtNeumeId),painted=l.systems.flatMap(s=>s.lyrics).find(t=>t.syllableId===syl.id);if(painted.anchorX!==n.lyricAnchorX)errors.push('anchor '+syl.id)}}
    const marks=Array.from(document.querySelectorAll('.score__hyphens text')).map(e=>({outgoing:e.dataset.outgoing==='true',system:Number(e.closest('[data-system-index]').dataset.systemIndex)}));
    return {errors,gaps,marks,systems:l.systems.length,notes:l.systems.flatMap(s=>s.neumes).reduce((v,n)=>v+n.notes.length,0)};
  })()`);
  for (const width of [1440, 320]) {
    await viewport(width);
    for (const sample of data.specimens) {
      await mount(sample.document);
      const result = await inspect(sample.document);
      assert.deepEqual(result.errors, [], `${sample.id} at ${width}`);
      if (sample.id === 'long-boundaries') {
        assert(result.systems >= 4, 'long melisma spans systems');
        assert.deepEqual(
          result.marks,
          [{ outgoing: true, system: 0 }],
          'only genuine next syllable creates the source-system mark',
        );
      }
      if (sample.id === 'et-lux-prefix') {
        assert.equal(result.gaps[0].gap, 6);
        assert.equal(result.gaps[1].gap, 33);
        assert.deepEqual(result.marks, []);
      }
      results.push({ width, id: sample.id, ...result });
      await ev(
        `(()=>{document.querySelector('.score').scrollIntoView({block:'start',behavior:'instant'});window.scrollBy(0,-90);return true})()`,
      );
      await shot(`intra-${sample.id}-${width}`);
    }
    // Paint-tested native pointer selection of every constituent, including
    // shapes whose padded polygons overlap before external hit clipping.
    await mount(data.ownership);
    const result = await inspect(data.ownership);
    assert.deepEqual(result.errors, []);
    for (const n of data.ownership.neumes)
      for (const q of n.notes) await selectNote(q.id);
    const target = data.ownership.neumes[1].notes[0].id;
    await selectNote(target);
    await closePanel();
    const client = await ev(
      `(()=>{const e=document.querySelector('[data-note-id="${target}"]'),b=e.querySelector('.score__note-hit-target').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
    );
    await click(client, true);
    assert.equal(
      await ev(
        `!!document.querySelector('[data-selected-neume-id="bistropha"][clip-path]')`,
      ),
      true,
      'whole-neume selection is clipped',
    );
    await ev(
      `(()=>{document.querySelector('.score').scrollIntoView({block:'start',behavior:'instant'});window.scrollBy(0,-90);return true})()`,
    );
    await shot(`intra-selection-${width}`);
    await ev(`(document.querySelector('[data-tool="punctum"]').click(),true)`);
    await pause();
    assert.equal(
      await ev(
        `!!document.querySelector('.score__placement-context[clip-path]')`,
      ),
      true,
    );
    await key('Escape');
    await ev(
      `(document.querySelector('.score__lyric').dispatchEvent(new MouseEvent('click',{bubbles:true})),true)`,
    );
    await pause();
    await ev(
      `(()=>{Array.from(document.querySelectorAll('button')).find(e=>e.textContent.startsWith('Move syllable:')).click();return true})()`,
    );
    await pause();
    assert.equal(
      await ev(
        `(()=>{const targets=Array.from(document.querySelectorAll('.score__move-target')).filter(e=>e.closest('[data-neume-id]').querySelector('clipPath'));return targets.length>0&&targets.every(e=>e.hasAttribute('clip-path'))})()`,
      ),
      true,
      'dense lyric-move cues use ownership clips',
    );
    await key('Escape');
    results.push({ width, id: 'all-fourteen-ownership', ...result });

    // Reparent the focused native control through real measurement fallback,
    // then dense measured reflow, without remounting the editor.
    const long = data.specimens.find(
      (s) => s.id === 'long-boundaries',
    ).document;
    await mount(long);
    const moving = await ev(
      `compositionLayout(${JSON.stringify(long)}).systems[0].neumes.at(-1).notes[0].noteId`,
    );
    await selectNote(moving);
    await closePanel();
    const before = await ev(
      `Number(document.activeElement.closest('[data-system-index]').dataset.systemIndex)`,
    );
    await ev(`(document.fonts.dispatchEvent(new Event('loading')),true)`);
    await pause();
    assert.equal(
      await ev(`document.activeElement.dataset.noteId`),
      moving,
      'focus survives provisional reparent',
    );
    const provisional = await ev(
      `Number(document.activeElement.closest('[data-system-index]').dataset.systemIndex)`,
    );
    assert(
      provisional > before,
      'fallback really moves the focused note to a later system',
    );
    await ev(`(document.fonts.dispatchEvent(new Event('loadingdone')),true)`);
    await pause();
    await pause();
    assert.equal(await ev(`document.activeElement.dataset.noteId`), moving);
    assert.equal(
      await ev(
        `Number(document.activeElement.closest('[data-system-index]').dataset.systemIndex)`,
      ),
      before,
    );
    // Deliberate focus outside the score must win over restoration.
    await ev(
      `(()=>{document.fonts.dispatchEvent(new Event('loading'));document.querySelector('[aria-label="Lyric language"]').focus();return true})()`,
    );
    await pause();
    await ev(`(document.fonts.dispatchEvent(new Event('loadingdone')),true)`);
    await pause();
    await pause();
    assert.equal(
      await ev(`document.activeElement.getAttribute('aria-label')`),
      'Lyric language',
      'reflow never steals focus from an editor control',
    );
    await selectNote(moving);
    await closePanel();
    await key('ArrowUp');
    const edited = await cache();
    assert.equal(edited.version, 9);
    assert.equal(
      edited.document.neumes.find((n) => n.notes.some((q) => q.id === moving))
        .notes[0].staffPosition,
      long.neumes.find((n) => n.notes.some((q) => q.id === moving)).notes[0]
        .staffPosition + 1,
    );
    await key('z', 2);
    assert.deepEqual(
      (await cache()).document,
      long,
      'native undo restores exact document',
    );
    await key('z', 10);
    assert.deepEqual(
      (await cache()).document,
      edited.document,
      'native redo restores edit',
    );
    await key('z', 2);
    // Native placement at an explicit committed slot. Hover must not reflow;
    // the displayed caret/ghost and committed insertion use the same boundary.
    await ev(`(document.querySelector('[data-tool="punctum"]').click(),true)`);
    await pause();
    const intent = await ev(
      `(()=>{const l=compositionLayout(${JSON.stringify(long)}),s=l.systems[1],slot=s.slots.find(v=>v.boundary.beforeNeumeId==='n30'&&v.boundary.beforeDivisionId==='division');if(!slot)throw Error('Missing intended n30 division slot');const p={x:slot.x,y:s.y+100},r=intraPlacement(l,'punctum',p);return {p,caret:r.preview.caret,insertionIndex:r.insertionIndex,boundary:r.boundary}})()`,
    );
    const stationary = await ev(
      `document.querySelector('.score').getAttribute('viewBox')+Array.from(document.querySelectorAll('[data-note-id]')).map(e=>e.closest('[data-system-index]').dataset.systemIndex).join(',')`,
    );
    const p = await point(intent.p.x, intent.p.y);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
    await pause();
    const preview = await ev(
      `(()=>{const e=document.querySelector('.score__placement-caret line'),g=document.querySelector('.score__placement-ghost');return e&&g?{x:Number(e.getAttribute('x1')),y:Number(e.getAttribute('y1')),ink:g.querySelectorAll('path,rect').length,hidden:g.parentElement.getAttribute('aria-hidden'),pointer:getComputedStyle(g.parentElement).pointerEvents}:null})()`,
    );
    assert(preview && preview.ink > 0, 'painted caret and ghost');
    assert.equal(preview.x, intent.caret.x);
    assert.equal(preview.y, intent.caret.top);
    assert.equal(preview.hidden, 'true');
    assert.equal(preview.pointer, 'none');
    assert.equal(
      await ev(
        `document.querySelector('.score').getAttribute('viewBox')+Array.from(document.querySelectorAll('[data-note-id]')).map(e=>e.closest('[data-system-index]').dataset.systemIndex).join(',')`,
      ),
      stationary,
      'hover does not reflow',
    );
    await click(p);
    const inserted = await cache();
    assert.equal(inserted.version, 9);
    assert.equal(inserted.document.neumes.length, long.neumes.length + 1);
    assert.deepEqual(
      inserted.document.syllables,
      long.syllables,
      'insertion never changes anchors',
    );
    const newNeume = inserted.document.neumes[intent.insertionIndex];
    assert(!long.neumes.some((n) => n.id === newNeume.id));
    assert.equal(
      await ev(`document.activeElement.classList.contains('score')`),
      true,
      'persistent placement focuses the surface after reflow',
    );
    await key('Escape');
    await key('z', 2);
    assert.deepEqual((await cache()).document, long);
    await key('z', 10);
    assert.deepEqual((await cache()).document, inserted.document);
    assert.deepEqual(
      await ev(
        `intraDecode(localStorage.getItem('gregorian-chant-editor:active-document:v1'))`,
      ),
      inserted.document,
      'native v9 cache decodes exactly',
    );
    // Refresh/hydration and file import/export run through local-persistence.
    results.push({
      width,
      id: 'dense-reflow-history-placement',
      moving,
      provisional,
      before,
      intent,
    });
  }
  await writeFile(
    join(screenshotDirectory, 'intra-syllable-results.json'),
    JSON.stringify(results, null, 2),
  );
  console.log(
    'PASS: intra-syllable specimens, all fourteen kinds native ownership, clipping, dense focus reflow, slots/ghost/insertion and v9 history at 1440/320.',
  );
}
