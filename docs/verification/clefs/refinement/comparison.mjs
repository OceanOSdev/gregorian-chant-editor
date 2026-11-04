import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Explicit review-artifact generator; never part of tests or automatic saves.
// Baselines are explicit review commits. Both builders use the documented s=12.
function loadGeometry(source) {
  const compiled = ts.transpileModule(
    source.replace(
      "import { staffStep } from './staff-metrics';",
      'const staffStep = 12;',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  new Function('exports', compiled)(exports);
  return exports.buildClefGeometry;
}
const fOnly = process.argv.includes('--f-only');
const baseline = fOnly ? '964788d' : '4b23fe2';
const beforeOrigin = fOnly ? 150 : 230;
const outputName = fOnly ? 'f-actual-size' : 'actual-size';
const before = loadGeometry(
  execFileSync(
    'git',
    ['show', `${baseline}:src/editor/layout/clef-geometry.ts`],
    {
      encoding: 'utf8',
    },
  ),
);
const after = loadGeometry(
  readFileSync(
    new URL('../../../../src/editor/layout/clef-geometry.ts', import.meta.url),
    'utf8',
  ),
);
const root = new URL('./', import.meta.url);
if (fOnly) {
  assert.equal(
    readFileSync(
      new URL(
        '../../../../src/editor/layout/staff-metrics.ts',
        import.meta.url,
      ),
      'utf8',
    ),
    execFileSync(
      'git',
      ['show', '964788d:src/editor/layout/staff-metrics.ts'],
      { encoding: 'utf8' },
    ),
    'Leading-origin and staff metrics must remain exact',
  );
  for (const staffLine of [1, 2, 3, 4]) {
    const c = { type: 'c', staffLine };
    assert.deepEqual(
      after(c, 100, 124 - 24 * (staffLine - 1)),
      before(c, 100, 124 - 24 * (staffLine - 1)),
      'C geometry must remain exact',
    );
    const f = { type: 'f', staffLine };
    assert.deepEqual(
      { ...after(f, 100, 124 - 24 * (staffLine - 1)), path: undefined },
      { ...before(f, 100, 124 - 24 * (staffLine - 1)), path: undefined },
      'F bounds and registration must remain exact',
    );
  }
}

function staff(clef, geometry, origin) {
  const y = 104 - 24 * (clef.staffLine - 1);
  const ink = geometry(clef, 100, y);
  return `<svg width="360" height="144" viewBox="0 0 360 144" aria-label="${clef.type}${clef.staffLine}">
    ${[32, 56, 80, 104].map((y) => `<path d="M64 ${y} H348" stroke="#222" stroke-width="1.2"/>`).join('')}
    <path d="${ink.path}"/>
    ${[0, 1, 2]
      .map((i) => {
        const x = origin + 45 * i - 6,
          y = [80, 56, 68][i];
        return `<path d="M${x} ${y - 4} C${x} ${y - 5.4} ${x + 3} ${y - 6} ${x + 6} ${y - 6} C${x + 9} ${y - 6} ${x + 12} ${y - 5.4} ${x + 12} ${y - 4} V${y + 5.6} Q${x + 12} ${y + 6} ${x + 11.6} ${y + 6} C${x + 9.8} ${y + 6} ${x + 8} ${y + 4.8} ${x + 6} ${y + 4.8} C${x + 4} ${y + 4.8} ${x + 2.2} ${y + 6} ${x + 0.4} ${y + 6} Q${x} ${y + 6} ${x} ${y + 5.6} Z"/>`;
      })
      .join('')}
  </svg>`;
}
// Crop reference-line coordinates and measured staff spaces in 500-dpi excerpts.
const references = {
  c3: {
    line: 75,
    space: 44,
    x: 70,
    width: 400,
    height: 230,
    source: 'p. 16, Sicut erat',
  },
  c4: {
    line: 67,
    space: 44,
    x: 83,
    width: 400,
    height: 230,
    source: 'p. 16, Gloria Patri VIII',
  },
  f3: {
    line: 81,
    space: 42,
    x: 68,
    width: 430,
    height: 230,
    source: 'Rules for Interpretation, clef diagram',
  },
  f4: {
    line: 87,
    space: 44,
    x: 62,
    width: 400,
    height: 230,
    source: 'p. 1203, Veritas mea',
  },
};
const rows = Object.entries(references)
  .filter(([name]) => !fOnly || name.startsWith('f'))
  .map(([name, ref]) => {
    const clef = { type: name[0], staffLine: Number(name[1]) };
    const scale = 24 / ref.space,
      lineY = 104 - 24 * (clef.staffLine - 1);
    const revised = after(clef, 100, lineY),
      original = before(clef, 100, lineY);
    const gap = (origin, g) =>
      (origin - 6 - g.bounds.x - g.bounds.width).toFixed(1);
    return `<h2>${name.toUpperCase()}</h2><div class="row">
    <section><svg width="360" height="144" viewBox="0 0 360 144"><image href="reference-${name}.png" x="${ref.x}" y="${lineY - ref.line * scale}" width="${ref.width * scale}" height="${ref.height * scale}"/></svg><p>${ref.source}</p></section>
    <section>${staff(clef, before, beforeOrigin)}<p>Leading ink gap ${gap(beforeOrigin, original)} px</p></section>
    <section>${staff(clef, after, 150)}<p>Leading ink gap ${gap(150, revised)} px</p></section>
  </div>`;
  })
  .join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${fOnly ? 'F-clef refinement' : 'Clef engraving revision'} — actual-size comparison</title>
<style>body{margin:24px;background:#fff;color:#222;font:14px Georgia,serif}h1{font-size:23px}h2{font-size:17px;margin:16px 0 0}.row,.head{display:grid;grid-template-columns:repeat(3,360px);gap:12px}section{border:1px solid #ddd}svg{display:block}p{margin:8px 12px}body>p{margin:12px 0;max-width:1050px}.head{margin-top:22px;font-weight:bold}.head span{padding-left:12px}</style>
<h1>${fOnly ? 'Printed Solesmes F3/F4 · Previous revision · F-only refinement' : 'Printed Solesmes · PR before review · Revised engraving'}</h1>
<p>Actual-size view: 1 SVG unit = 1 CSS pixel; four-line staff spacing is 24 px (the editor at a 720 px score width). Keep browser zoom at 100%. The scanned excerpts are uniformly scaled to the same staff spacing and reference line; aspect ratios are preserved. They retain scan skew and printing irregularities.</p>
<p>The two application columns use identical neutral punctum context, not a transcription of the printed melody. ${fOnly ? 'Only the F contour differs. C geometry, F bounds, reference-line registration and leading spacing are checked against 964788d and remain exact.' : 'Only the clef contours and leading origin differ. Reference-line registration is unchanged.'}</p>
<div class="head"><span>Printed Liber Usualis (source crops)</span><span>Before: ${baseline}, first note x=${beforeOrigin}</span><span>Revised: first note x=150</span></div>${rows}
<p>Reference: <a href="https://archive.org/download/TheLiberUsualis1961/liberusualis.pdf">Liber Usualis scan</a>, PDF pages ${fOnly ? '17 and 1397' : '17, 128 and 1397'}. Small excerpts retained for comparative engraving review; no scanned outline is used as an application glyph. See <a href="${fOnly ? 'f-review.md' : 'review.md'}">review notes</a> for measurements, reproduction and remaining visual acceptance.</p></html>`;
writeFileSync(fileURLToPath(new URL(`${outputName}.html`, root)), html);
console.log(
  `Wrote ${outputName}.html; inspect in Chromium at 100% zoom before retaining a screenshot.${fOnly ? ' C geometry and F registration/bounds match 964788d exactly.' : ''}`,
);
