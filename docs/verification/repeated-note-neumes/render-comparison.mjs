import { execFileSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Compose actual screenshot crops and sourced music excerpts; draw no notation.
const captured = process.argv[2];
if (!captured)
  throw Error('Supply the focused browser driver output directory.');
const root = fileURLToPath(new URL('.', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'chant9a-board-'));
const convert = (...args) => execFileSync('convert', args);
convert(
  join(captured, 'engraving-1440.png'),
  '-crop',
  '750x145+340+640',
  '+repage',
  join(root, 'editor-engraving.png'),
);
const rows = [
  [
    'Printed p.70: Bistropha between Clives (staff spacing about 24px)',
    'demetria-p70-clives.png',
    '135%',
  ],
  [
    'Printed p.70: square Tristropha and excluded Trivirga',
    'demetria-p70-tristropha.png',
    '135%',
  ],
  [
    'Printed p.71, Ex.115: repeated groups, adjacent neumes and ictus',
    'demetria-p71-ex115.png',
    '135%',
  ],
  [
    'Editor: line / space pairs, triples and independent episemata (staff spacing 30px)',
    'editor-engraving.png',
    '100%',
  ],
  [
    'Gregorio 6.0.0 / Greciliae: square-head comparison, then excluded stropha alternate',
    'gregorio-comparison.png',
    '100%',
  ],
];
const images = rows.map(([label, name, scale], index) => {
  const path = join(temporary, index + '.png');
  convert(
    join(root, name),
    '-resize',
    scale,
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
