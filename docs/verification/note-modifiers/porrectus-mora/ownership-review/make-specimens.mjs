// Review specimens only. Bundles the unchanged production geometry in a temporary
// directory; no app imports this file and no candidate is a production policy.
import { build } from 'vite';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const output = dirname(fileURLToPath(import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'chant-ownership-geometry-'));
await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    lib: {
      entry: fileURLToPath(
        new URL(
          '../../../../../src/editor/layout/neume-geometry.ts',
          import.meta.url,
        ),
      ),
      formats: ['es'],
      fileName: () => 'geometry.mjs',
    },
    outDir: temporary,
    emptyOutDir: true,
    minify: false,
  },
});
const { buildNeumeGeometry } = await import(
  pathToFileURL(join(temporary, 'geometry.mjs')).href
);
const cases = [
  { label: 'First only', mora: [1, 0, 0] },
  { label: 'Second only', mora: [0, 1, 0] },
  { label: 'Third only', mora: [0, 0, 1] },
  { label: 'First + third', mora: [1, 0, 1] },
  { label: 'All three', mora: [1, 1, 1] },
  { label: 'Double on first', mora: [2, 0, 0] },
  { label: 'Double on second', mora: [0, 2, 0] },
  { label: 'Double on third', mora: [0, 0, 2] },
  { label: 'Second + third', mora: [0, 1, 1] },
  { label: 'Mixed + episema', mora: [2, 1, 2], episema: true },
];
const patterns = [
  {
    name: 'equal-line',
    pitches: [4, 2, 4],
    caption: 'Equal outer pitches; first/third on a line',
  },
  {
    name: 'equal-space',
    pitches: [3, 1, 3],
    caption: 'Equal outer pitches; first/third in a space',
  },
  {
    name: 'adjacent',
    pitches: [5, 4, 5],
    caption: 'Equal outer pitches; adjacent final ascent',
  },
  {
    name: 'unequal',
    pitches: [3, 0, 4],
    caption: 'Unequal outer pitches; control',
  },
  {
    name: 'equal-line-native',
    pitches: [4, 2, 4],
    caption: 'Equal outer pitches at native glyph scale',
    scale: 1,
  },
];
const esc = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
const text = (x, y, value, size = 12, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${esc(value)}</text>`;
const line = (x1, y1, x2, y2, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
const paint = (shape) =>
  shape.kind === 'path'
    ? `<path d="${shape.d}"/>`
    : `<rect x="${shape.bounds.x}" y="${shape.bounds.y}" width="${shape.bounds.width}" height="${shape.bounds.height}" rx="${shape.radius}"/>`;
const dots = (x, y, count, direction = 1) =>
  Array.from(
    { length: count },
    (_, i) => `<circle cx="${x}" cy="${y + direction * i * 24}" r="2"/>`,
  ).join('');
const mods = (item) =>
  item.mora.map((mora) => ({
    ...(mora ? { mora } : {}),
    ...(item.episema ? { episema: true } : {}),
  }));
const geometry = (pitches, item) =>
  buildNeumeGeometry('porrectus', pitches, 0, 72, mods(item));
// Unannotated conventional forms: no initial-note mora and at most one per
// note on the final pair. First-note/double assignments require editorial help.
const ordinary = (item) =>
  item.mora[0] === 0 && item.mora.every((count) => count <= 1);
const signature = (g) =>
  JSON.stringify(
    g.ink
      .map((shape) =>
        shape.kind === 'path'
          ? shape.d
          : [
              shape.bounds.x,
              shape.bounds.y,
              shape.bounds.width,
              shape.bounds.height,
              shape.radius,
            ],
      )
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
const stats = [];
for (const pattern of patterns) {
  const plain = buildNeumeGeometry('porrectus', pattern.pitches, 0, 72);
  const right = plain.bounds.x + plain.bounds.width;
  const rows = [];
  for (const [row, item] of cases.entries()) {
    const committed = geometry(pattern.pitches, item);
    const epi = item.episema
      ? buildNeumeGeometry('porrectus', pattern.pitches, 0, 72, [
          { episema: true },
          { episema: true },
          { episema: true },
        ])
          .ink.slice(1)
          .map(paint)
          .join('')
      : '';
    const base = plain.ink.map(paint).join('');
    const result = [];
    result.push(committed.ink.map(paint).join(''));
    // A: endpoint-local groups. First-note groups move above its left endpoint;
    // each nonordinary group is explicitly tied to an endpoint with an angled
    // editorial hairline. Doubles are grouped by a small brace at the leader.
    let a = base + epi;
    if (ordinary(item)) a = committed.ink.map(paint).join('');
    else
      for (const [i, count] of item.mora.entries()) {
        if (!count) continue;
        const note = plain.notes[i];
        const onLine = pattern.pitches[i] % 2 === 0;
        const cx = i === 0 ? note.anchorX + 10 : right + 12 + i * 7;
        const cy =
          i === 0
            ? note.anchorY - (onLine ? 12 : 24)
            : note.anchorY +
              (onLine
                ? i === 1 && pattern.pitches[2] - pattern.pitches[1] === 1
                  ? 12
                  : -12
                : 0);
        const end = cy + (i === 0 ? -1 : 1) * (count - 1) * 24;
        a += dots(cx, cy, count, i === 0 ? -1 : 1);
        const top = Math.min(cy, end),
          bottom = Math.max(cy, end);
        const startX = i === 0 ? note.anchorX : note.anchorX + 7;
        const startY =
          i === 0 ? note.anchorY - 10 : note.anchorY + (i === 1 ? 10 : -10);
        a += `<path d="M${startX},${startY} L${cx + 6},${(top + bottom) / 2} M${cx + 4},${top - 3} H${cx + 6} V${bottom + 3} H${cx + 4}" fill="none" stroke="#525b63" stroke-width="0.65"/>`;
      }
    result.push(a);
    // B: fixed trailing groups with literal editorial note indexes; never rely
    // on an unlabeled horizontal offset to communicate ownership.
    let b = base + epi;
    if (ordinary(item)) b = committed.ink.map(paint).join('');
    else
      for (const [i, count] of item.mora.entries()) {
        if (!count) continue;
        const cx = right + 10 + i * 20;
        const note = plain.notes[i];
        const cy =
          note.anchorY +
          (pattern.pitches[i] % 2 === 0
            ? i === 1 && pattern.pitches[2] - pattern.pitches[1] === 1
              ? 12
              : -12
            : 0);
        b += dots(cx, cy, count);
        b += text(cx - 5, -16, 'n' + (i + 1), 7);
        b += line(cx, -11, cx, -5, 'stroke="#525b63" stroke-width="0.6"');
      }
    result.push(b);
    // C: keep exact production rhythmic ink, supplement nonordinary assignments
    // with one permanently visible editorial ownership line below the staff.
    let c = committed.ink.map(paint).join('');
    if (!ordinary(item)) {
      const label = 'm[' + item.mora.join(',') + ']';
      c += text(0, 100, label, 9, 'fill="#38414b" data-editorial="ownership"');
    }
    result.push(c);
    if (ordinary(item))
      result
        .slice(1)
        .forEach((candidate) => assert.equal(candidate, result[0]));
    // The body path for every candidate is byte-for-byte the approved one.
    result.forEach((candidate) => assert.ok(candidate.includes(base)));
    stats.push({
      pattern: pattern.name,
      case: item.label,
      mora: item.mora,
      episema: !!item.episema,
      baselineSignature: signature(committed),
    });
    const cellY = 145 + row * 185;
    let rendered =
      text(16, cellY + 42, item.label, 14) +
      text(16, cellY + 63, 'mora [' + item.mora.join(',') + ']', 11);
    for (const [column, ink] of result.entries()) {
      const cellX = 190 + column * 260;
      rendered += `<g data-approach="${column}" data-case="${row}" transform="translate(${cellX + 15} ${cellY + 16}) scale(${pattern.scale ?? 1.5})">`;
      for (const y of [0, 24, 48, 72])
        rendered += line(-8, y, 145, y, 'stroke="#b6aaa0" stroke-width="0.55"');
      rendered += `<g fill="#171717" data-candidate-ink="true">${ink}</g></g>`;
    }
    rows.push(rendered);
  }
  const width = 1240,
    height = 145 + cases.length * 185 + 45;
  const header = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>Porrectus ownership candidates — ${pattern.caption}</title>`,
    `<rect width="${width}" height="${height}" fill="#fffdf8"/>`,
    '<g font-family="Arial, sans-serif" fill="#252525">',
    text(16, 30, 'REVIEW ONLY — no new convention implemented', 21),
    text(
      16,
      55,
      pattern.caption +
        '; positions [' +
        pattern.pitches.join(', ') +
        ']; symbols at ' +
        (pattern.scale ?? 1.5) +
        '×',
      14,
    ),
    text(
      16,
      77,
      'n1 = left ribbon start; n2 = low endpoint; n3 = upper terminal. Gray additions are editorial, not rhythmic signs.',
      12,
    ),
    text(
      16,
      95,
      'All candidates preserve conventional final-pair singles. C: m[a,b,c] gives dot counts on notes 1, 2, 3; 0 means none.',
      11,
    ),
    ...[
      'Current trailing',
      'A · local groups + leaders',
      'B · indexed trailing groups',
      'C · trailing + ownership line',
    ].map((label, i) => text(205 + i * 260, 115, label, 13)),
  ];
  await writeFile(
    join(output, pattern.name + '.svg'),
    header.join('\n') + '\n' + rows.join('\n') + '\n</g></svg>\n',
  );
  if (pattern.name === 'equal-line') {
    const focused = header
      .join('\n')
      .replace('height="' + height + '"', 'height="560"')
      .replace(
        'viewBox="0 0 ' + width + ' ' + height + '"',
        'viewBox="0 0 ' + width + ' 560"',
      );
    await writeFile(
      join(output, 'first-versus-third.svg'),
      focused +
        '\n' +
        rows[0] +
        '\n<g transform="translate(0 -185)">' +
        rows[2] +
        '</g>\n</g></svg>\n',
    );
  }
}
// Demonstrate the known collisions using exact shared production ink, independent
// of source order or semantic IDs. No candidate is assumed to fix these by x alone.
for (const name of ['equal-line', 'equal-space', 'adjacent']) {
  const entries = stats.filter((s) => s.pattern === name);
  assert.equal(entries[0].baselineSignature, entries[2].baselineSignature);
}
const equal = stats.filter((s) => s.pattern === 'equal-line');
assert.equal(equal[7].baselineSignature, equal[8].baselineSignature);
// C's editorial text must not leave a semantic alias in the represented mora
// counts. Check all 27 combinations for each fixed episema assignment, rather
// than infer this from the handful of pictured rows. This checks an encoding,
// not reader comprehension or production collision handling.
let checked = 0;
for (const pattern of patterns.filter((p) => p.name !== 'equal-line-native'))
  for (let mask = 0; mask < 8; mask++) {
    const encodings = new Set();
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 3; c++) {
          const counts = [a, b, c];
          const g = buildNeumeGeometry(
            'porrectus',
            pattern.pitches,
            0,
            72,
            counts.map((mora, i) => ({
              ...(mora ? { mora } : {}),
              ...(mask & (1 << i) ? { episema: true } : {}),
            })),
          );
          const label = ordinary({ mora: counts })
            ? ''
            : 'm[' + counts.join(',') + ']';
          const key = signature(g) + '|' + label;
          assert.ok(
            !encodings.has(key),
            'C encoding must distinguish ' + pattern.name + ' ' + counts,
          );
          encodings.add(key);
          checked++;
        }
    assert.equal(encodings.size, 27);
  }
await writeFile(
  join(output, 'specimens.json'),
  JSON.stringify(
    {
      reviewOnly: true,
      patterns,
      cases,
      productionAmbiguities: [
        'First only = Third only for equal outer pitches',
        'Double on third = Second + third for [4,2,4]',
      ],
      checks: {
        body: 'Shared original body paths preserved',
        baseline: 'Ambiguity assertions passed',
        candidateC:
          '27 distinct ink + editorial text encodings per fixed episema mask',
        count: checked,
        limitation:
          'Encoding checks are not collision or reader-comprehension acceptance',
      },
    },
    null,
    2,
  ) + '\n',
);
await rm(temporary, { recursive: true, force: true });
console.log(
  'Generated five review sheets; production silhouette and baseline ambiguity checks passed.',
);
