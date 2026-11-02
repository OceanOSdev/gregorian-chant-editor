import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertRenderedContinuations } from './assert-rendered-corpus.ts';

export async function runCorpusReview({
  ev,
  send,
  viewport,
  mount,
  shot,
  screenshotDirectory,
}) {
  const measurementWidth = Number(process.env.CHANT_CORPUS_WIDTH ?? 1440);
  await viewport(measurementWidth);
  const alternateFont = process.env.CHANT_CORPUS_FONT === 'sans';
  if (alternateFont)
    await ev(
      `(async()=>{const face=new FontFace('CorpusSans','local("DejaVu Sans")');await face.load();document.fonts.add(face);const style=document.createElement('style');style.textContent='text{font-family:CorpusSans,sans-serif!important}';document.head.append(style);return true})()`,
    );
  const diagnostic = process.env.CHANT_CORPUS === 'diagnostic';
  const corpus = await ev(
    `(async()=>{const c=await import('/docs/verification/word-composition/corpus.ts');const v=await import('/docs/verification/word-composition/inspect-corpus.ts');const l=await import('/src/editor/layout/layout-chant.ts');const m=await import('/src/editor/rendering/use-lyric-measurement.ts');window.corpusInspect=sample=>v.inspectCorpusCase(sample,l.layoutChant(sample.document,m.createSvgLyricMeasurer()),m.createSvgLyricMeasurer());window.corpusFontSize=(await import('/src/editor/layout/lyric-text-metrics.ts')).lyricFontSize;const a=await import('/docs/verification/word-composition/auditione.ts');return [...c.compositionCorpus,...a.auditioneCorpus]})()`,
  );
  const results = [],
    specimens = [];
  for (const sample of corpus) {
    await mount(sample.document);
    const result = await ev(`corpusInspect(${JSON.stringify(sample)})`);
    const wordSpaceMinimum = await ev('corpusFontSize/4');
    const rendered = await ev(`(()=>{
      const systems=Array.from(document.querySelectorAll('[data-system-index]'));
      return systems.map(s=>({index:Number(s.dataset.systemIndex),lyrics:Array.from(s.querySelectorAll('.score__lyric')).map(t=>{const b=t.getBBox();return {id:t.dataset.syllableId,left:b.x,right:b.x+b.width,advance:t.getComputedTextLength()}}),marks:Array.from(s.querySelectorAll('.score__hyphens text')).map(t=>{const b=t.getBBox();return {left:b.x,right:b.x+b.width,outgoing:t.dataset.outgoing==='true',pointer:getComputedStyle(t).pointerEvents,hidden:t.parentElement.getAttribute('aria-hidden')}})}))
    })()`);
    if (!diagnostic) assertRenderedContinuations(result.boundaries, rendered);
    for (const system of rendered) {
      for (let i = 1; i < system.lyrics.length; i++)
        assert(
          system.lyrics[i].left >= system.lyrics[i - 1].right - 0.05,
          `${sample.id}: painted lyric overlap ${JSON.stringify(system.lyrics)}`,
        );
      for (const mark of system.marks) {
        assert.equal(mark.pointer, 'none');
        assert.equal(mark.hidden, 'true');
        assert(
          system.lyrics.every(
            (t) => mark.right <= t.left + 0.05 || mark.left >= t.right - 0.05,
          ),
          `${sample.id}: painted hyphen overlap`,
        );
      }
    }
    const paintedById = new Map(
      rendered.flatMap((s) => s.lyrics).map((t) => [t.id, t]),
    );
    for (const boundary of result.boundaries) {
      const before = paintedById.get(boundary.beforeId),
        after = paintedById.get(boundary.afterId);
      boundary.paintedGap =
        boundary.gap === null ? null : after.left - before.right;
      if (!diagnostic && boundary.kind === 'join')
        assert(
          boundary.paintedGap < wordSpaceMinimum,
          `${sample.id}: unmarked painted word-space gap`,
        );
    }
    results.push({
      measurementWidth,
      alternateFont,
      id: sample.id,
      name: sample.name,
      arrangement: sample.arrangement,
      ...result,
      rendered,
    });
    if (!diagnostic)
      assert.deepEqual(
        result.errors,
        [],
        `${sample.id}: ${result.errors.join(', ')}`,
      );
    const svg =
      await ev(`(()=>{const source=document.querySelector('.score'),svg=source.cloneNode(true);
      const originalTexts=source.querySelectorAll('text');svg.querySelectorAll('text').forEach((text,i)=>text.style.fontFamily=getComputedStyle(originalTexts[i]).fontFamily);
      // getBBox needs connected SVG; use source nodes to crop the actual score.
      const bounds=Array.from(document.querySelector('.score').querySelectorAll('.score__ink,.score__lyric,.score__hyphens text')).map(t=>t.getBBox());
      const left=Math.min(...bounds.map(b=>b.x))-12,right=Math.max(...bounds.map(b=>b.x+b.width))+12;
      const top=36,bottom=Math.max(...bounds.map(b=>b.y+b.height))+16;
      svg.setAttribute('viewBox',[left,top,right-left,bottom-top].join(' '));svg.setAttribute('width',right-left);svg.setAttribute('height',bottom-top);svg.removeAttribute('style');svg.classList.remove('score');
      svg.querySelectorAll('.score__note,defs,.score__lyric-selection,.score__lyric-focus-cue').forEach(n=>n.remove());
      return svg.outerHTML})()`);
    specimens.push({
      sample,
      svg,
      summary: result.boundaries
        .map((b) =>
          b.kind === 'word'
            ? 'word space'
            : `${b.before}/${b.after}: ${b.kind}${b.gap === null ? '' : ` (${b.gap.toFixed(1)})`}`,
        )
        .join(' · '),
    });
  }
  await writeFile(
    join(screenshotDirectory, 'corpus-results.json'),
    JSON.stringify(results, null, 2),
  );
  // Screenshots are review evidence only: no image comparisons or coordinate goldens.
  for (const [name, items, columns] of [
    [
      'auditione',
      specimens.filter((s) => s.sample.arrangement === 'reference'),
      2,
    ],
    [
      'corpus-words',
      specimens.filter((s) => s.sample.arrangement === 'puncta'),
      2,
    ],
    [
      'corpus-arrangements',
      specimens.filter(
        (s) =>
          ['Alleluia', 'Gregario', 'Gloria', 'Deo'].includes(s.sample.name) &&
          s.sample.arrangement !== 'puncta',
      ),
      4,
    ],
  ]) {
    const html = `<!doctype html><meta charset="UTF-8"><style>body{margin:20px;background:#f4f0e8;color:#211c16;font:15px Georgia,serif}h1{font-size:24px;margin:0 0 8px}p{margin:4px 0 16px}.grid{display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:12px}article{background:#fffdf7;border:1px solid #cfc4b3;padding:10px;overflow:hidden}h2{font:18px Georgia;margin:0 0 4px}small{display:block;font:12px system-ui;color:#5c5449;margin-bottom:8px}svg{display:block;max-width:100%;height:auto;max-height:310px;overflow:hidden;margin:8px auto}.score__staff-line{stroke:#342e26;stroke-width:1}.score__ink{fill:currentColor}text{fill:currentColor}.score__lyric-group{outline:none}.score__lyric-focus-cue{display:none}.summary{font:12px system-ui;line-height:1.5;border-top:1px solid #ddd;padding-top:5px}</style><h1>${name === 'auditione' ? 'Auditione — reference assignment and controls' : name === 'corpus-words' ? 'Word composition — all eight corpus entries' : 'Musical constraints — representative arrangements'}</h1><p>Actual editor SVG; occupied advance/ink gaps in score units. Join / hyphen / outgoing follow measured geometry; screenshots are review evidence.</p><div class="grid">${items.map((s) => `<article><h2>${s.sample.name}</h2><small>${s.sample.arrangement === 'reference' ? s.sample.id : s.sample.arrangement} · ${s.sample.words.map((w) => w.join('/')).join(' + ')}</small>${s.svg}<div class="summary">${s.summary}</div></article>`).join('')}</div>`;
    await writeFile(join(screenshotDirectory, `${name}.html`), html);
    await viewport(name === 'corpus-words' ? 1200 : 1800);
    await send('Page.navigate', {
      url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    });
    await new Promise((r) => setTimeout(r, 200));
    // Capture enough height for a compact complete contact sheet.
    const height = await ev(
      "Math.ceil(document.querySelector('.grid').getBoundingClientRect().bottom+20)",
    );
    await send('Emulation.setDeviceMetricsOverride', {
      width: name === 'corpus-words' ? 1200 : 1800,
      height: Math.max(height, 600),
      deviceScaleFactor: 1,
      mobile: false,
    });
    await shot(name);
  }
  console.log(
    JSON.stringify(
      {
        cases: results.length,
        errors: results
          .filter((r) => r.errors.length)
          .map((r) => ({
            name: r.name,
            arrangement: r.arrangement,
            errors: r.errors,
          })),
        classes: results
          .flatMap((r) => r.boundaries)
          .reduce((a, b) => ((a[b.kind] = (a[b.kind] ?? 0) + 1), a), {}),
      },
      null,
      2,
    ),
  );
}
