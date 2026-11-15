// Render the editor's actual shared liquescent geometry (ADR 0027) to SVG.
//
// Usage (from the repository root, after `npm ci`):
//   node docs/verification/liquescent-notation/render-editor-geometry.mjs <out.svg>
//
// Same mechanism as ../compound-directional-neumes/existing-geometry-baseline.mjs:
// a temporary Vitest file calls buildNeumeGeometry (the builder used by both
// the ghost preview and committed layout), writes one SVG, and is removed.
// Rows: ordinary Podatus, Epiphonus, Augmentative pes (Dominican), ordinary
// Clivis, Cephalicus. Columns: intervals Δ1–Δ5 from a line and from a space.
import { execFileSync } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'liquescent-editor-geometry.svg');
const testName = 'src/liquescent-geometry-sheet.tmp.test.ts';
const source = `import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { staffPosition } from './editor/domain/chant-document';
import { buildNeumeGeometry, type GeometryKind } from './editor/layout/neume-geometry';

const rows: [string, GeometryKind, 1 | -1][] = [
  ['Podatus', 'podatus', 1],
  ['Epiphonus', 'epiphonus', 1],
  ['Augmentative pes (Dominican)', 'augmentative-pes', 1],
  ['Clivis', 'clivis', -1],
  ['Cephalicus', 'cephalicus', -1],
];
const columns = [1, 2, 3, 4, 5].flatMap((d) => [[d, 0], [d, 1]] as const);
const cellW = 64, rowH = 150, left = 210, staff = 24;
let body = '';
rows.forEach(([label, kind, dir], r) => {
  const bottom = 40 + r * rowH + 4 * staff;
  body += '<text x="8" y="' + (bottom - 30) + '" font-size="13">' + label + '</text>';
  for (let line = 0; line < 4; line++)
    body += '<line x1="' + left + '" x2="' + (left + columns.length * cellW) + '" y1="' + (bottom - line * staff) + '" y2="' + (bottom - line * staff) + '" stroke="#999" stroke-width="1"/>';
  columns.forEach(([d, space], c) => {
    const start = dir > 0 ? space + 0 : space + 6;
    const positions = [staffPosition(start), staffPosition(start + dir * d)];
    const g = buildNeumeGeometry(kind, positions, left + 16 + c * cellW, bottom);
    for (const part of g.ink)
      body += part.kind === 'path'
        ? '<path d="' + part.d + '" fill="#111"/>'
        : '<rect x="' + part.bounds.x + '" y="' + part.bounds.y + '" width="' + part.bounds.width + '" height="' + part.bounds.height + '" fill="#111"/>';
    for (const n of g.notes)
      body += '<circle cx="' + n.anchorX + '" cy="' + n.anchorY + '" r="1.4" fill="#d22"/>';
    if (r === 0)
      body += '<text x="' + (left + 10 + c * cellW) + '" y="22" font-size="11">Δ' + d + (space ? ' space' : ' line') + '</text>';
  });
});
const width = left + columns.length * cellW + 20, height = 40 + rows.length * rowH;
writeFileSync(${JSON.stringify(out)}, '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><rect width="100%" height="100%" fill="white"/>' + body + '</svg>');
it('writes the liquescent geometry sheet', () => {});
`;
await writeFile(testName, source);
try {
  execFileSync('npx', ['vitest', 'run', testName], { stdio: 'inherit' });
} finally {
  await rm(testName, { force: true });
}
console.log(`Wrote ${out}`);
