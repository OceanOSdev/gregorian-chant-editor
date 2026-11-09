// Research-output inspection, not a production codec or semantic migration.
// Run after gregorio -o cases.gtex cases.gabc in this directory.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('cases.gabc', import.meta.url), 'utf8');
const output = await readFile(new URL('cases.gtex', import.meta.url), 'utf8');
const inputs = [...source.matchAll(/([A-Za-z]+)\(([^)]*)\)/g)].map((m) => ({
  label: m[1],
  gabc: m[2],
}));
const sections = output.split('\\GreSyllableNoteCount{').slice(1);
assert.equal(sections.length, inputs.length);
const rows = inputs.map((input, i) => ({
  ...input,
  glyphs: [...sections[i].matchAll(/\\GreGlyph\{\\GreCP([^}]+)\}/g)].map(
    (m) => m[1],
  ),
  moras: [
    ...sections[i].matchAll(
      /\\GrePunctumMora\{(\d+)\}\{(\d+)\}\{(\d+)\}\{(\d+)\}/g,
    ),
  ].map((m) => ({
    height: Number(m[1]),
    widthMode: Number(m[2]),
    positionCase: Number(m[3]),
    inclinatum: Number(m[4]),
  })),
  duplexes: [
    ...sections[i].matchAll(/\\GreAugmentumDuplex\{(\d+)\}\{(\d+)\}\{(\d+)\}/g),
  ].map((m) => ({
    lowerHeight: Number(m[1]),
    upperHeight: Number(m[2]),
    positionCase: Number(m[3]),
  })),
}));
assert.equal(rows.length, 35);
for (const row of rows) {
  if (row.label === 'Pair') {
    assert.equal(row.moras.length, 2);
    assert.equal(row.duplexes.length, 0);
  }
  if (row.label === 'Duplex' || row.label === 'Double') {
    assert.equal(row.duplexes.length, 1);
    assert.equal(row.moras.length, 0);
  }
}
const single = rows.find((r) => r.label === 'Double');
assert.deepEqual(
  single.duplexes.map((d) => [d.lowerHeight, d.upperHeight]),
  [[9, 10]],
);
const efg = rows.filter((r) => r.gabc === 'ef.g' || r.gabc === 'efg.');
assert.equal(efg.length, 2);
await writeFile(
  new URL('probe-summary.json', import.meta.url),
  JSON.stringify(
    {
      generatedBy: 'Gregorio 6.0.0; TeX 6.0.0/Greciliae',
      scope:
        'Permissive software-output probes, not historical authorization or editor policy',
      checks:
        '35 cases; pair emits two mora calls; double syntax emits one duplex call; singleton double uses different fallback heights',
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Inspected 35 Gregorio probes; paired-sign and singleton-fallback checks passed.',
);
