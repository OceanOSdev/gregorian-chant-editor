import { execFileSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Compose actual screenshot crops and sourced music excerpts; draw no notation.
const captured = process.argv[2];
if (!captured)
  throw Error('Supply the pes-subpunctis browser driver output directory.');
const root = fileURLToPath(new URL('.', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'chant9b1-board-'));
const convert = (...args) => execFileSync('convert', args);
convert(
  join(captured, 'engraving-1440.png'),
  '-crop',
  '760x520+330+20',
  '+repage',
  join(root, 'editor-engraving.png'),
);
const rows = [
  [
    'Mocquereau, Fig. 37 no. 21: pes subbipunctis (2nd with final mora)',
    'mocquereau-fig37-21.png',
  ],
  ['Mocquereau, Fig. 38 no. 24: pes subtripunctis', 'mocquereau-fig38-24.png'],
  [
    'Demetria p. 57, Ex. 88 (In Monte Oliveti): subbi/subtripunctis',
    'demetria-p57-ex88.png',
  ],
  [
    'Demetria p. 57, Ex. 89 (Gloria I): subtripunctis with vertical episemata',
    'demetria-p57-ex89.png',
  ],
  [
    "Liber Usualis 1961 p. 46, Kyrie XI Christe: kv. jkJH'G h.",
    'liber-p46-christe.png',
  ],
  [
    "Liber Usualis 1961 p. 46, Kyrie XI last Kyrie: d. gv. fgFD'C d.",
    'liber-p46-last-kyrie.png',
  ],
  ['Gregorio 6.0.0 / Greciliae: cases.gabc a-n', 'gregorio-cases.png'],
  [
    'Gregorio: final mora (i, m) and final-two (j, n), episema cases (k, l)',
    'gregorio-mora-cases.png',
  ],
  [
    'Editor (Chromium 1440px): both counts, line/space, wide, Kyrie fragments, signs, flat, wrapping',
    'editor-engraving.png',
  ],
];
const images = rows.map(([label, name], index) => {
  const path = join(temporary, index + '.png');
  convert(
    join(root, name),
    '-resize',
    '900x>',
    '-background',
    'white',
    '-gravity',
    'northwest',
    '-splice',
    '0x32',
    '-font',
    'DejaVu-Sans',
    '-pointsize',
    '18',
    '-fill',
    'black',
    '-annotate',
    '+8+6',
    label,
    '-bordercolor',
    'white',
    '-border',
    '8',
    '+repage',
    path,
  );
  return path;
});
convert(
  ...images,
  '-background',
  'white',
  '-gravity',
  'west',
  '-append',
  '+repage',
  join(root, 'comparison.png'),
);
console.log(join(root, 'comparison.png'));
