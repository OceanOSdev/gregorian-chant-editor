// Focused five-note Scandicus comparison against the merged Stage 9B-3 base.
// node docs/verification/extended-scandicus-climacus/five-note-baseline.mjs [ref]
// Recover the 18 throwing contours from steps 1..3, starts -2/0/1/3/6;
// compare all 32 x 32 episema masks and both mora scopes on those plus four
// representative contours. Temporary archive/dumps are removed on completion.
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ref = process.argv[2] ?? '15ca4ca';
const root = resolve('.');
const testName = 'src/five-note-baseline.tmp.test.ts';
const dump = `import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { staffPosition, type Neume, type NoteAppearance } from './editor/domain/chant-document';
import { buildNeumeGeometry } from './editor/layout/neume-geometry';
import { moraChoices, moraIndexes } from './editor/domain/mora';
import { allowedNoteForms } from './editor/domain/note-forms';
import { isValidNeume } from './editor/domain/neume';

const steps = [-3, -2, -1, 0, 1, 2, 3];
function* contours(length: number): Generator<number[]> {
  if (length === 1) { yield [0]; return; }
  for (const rest of contours(length - 1))
    for (const step of steps) yield [...rest, rest[rest.length - 1] + step];
}
function masks(length: number): number[] {
  const all = (1 << length) - 1;
  return length === 5
    ? Array.from({ length: all + 1 }, (_, i) => i)
    : [0, all, ...Array.from({ length }, (_, i) => 1 << i)];
}

it('dumps existing geometry', () => {
  const lines: string[] = [];
  const selected = new Set<string>();
  for (const offsets of contours(5)) for (const first of [-2,0,1,3,6]) {
    const pitches = offsets.map(o => staffPosition(first + o));
    if (!isValidNeume({id:'x',kind:'scandicus',notes:pitches.map((staffPosition,i)=>({id:'n'+i,staffPosition}))} as Neume)) continue;
    try { buildNeumeGeometry('scandicus',pitches,50,140,pitches.map((_,i)=>({episema:true,...(i===1?{verticalEpisema:true}: {})}))); }
    catch { selected.add(pitches.join(',')); }
  }
  // Fixed discovery result is shared with the repaired tree via environment.
  const chosen: string[] = process.env.CONTOURS ? JSON.parse(process.env.CONTOURS) : [...selected];
  writeFileSync(process.env.CONTOURS_OUT ?? '/dev/null', JSON.stringify(chosen));
  for (const p of ['2,3,4,5,6','1,2,3,4,6','-2,0,1,4,5','4,5,7,8,10']) if (!chosen.includes(p)) chosen.push(p);

  const kind = 'scandicus';
  const length = 5;
  for (const contour of chosen) {
          const pitches = contour.split(',').map(Number).map(staffPosition);
          const notes = pitches.map((staffPosition, i) => ({ id: 'n' + i, staffPosition }));
          if (!isValidNeume({ id: 'x', kind, notes } as Neume)) continue;
          const formSets: NoteAppearance[][] = [pitches.map(() => ({}))];
          pitches.forEach((_, i) => {
            for (const form of allowedNoteForms(kind, i, length))
              formSets.push(pitches.map((_, j) => (i === j ? { form } : {})));
          });
          for (const forms of formSets)
            for (const { value } of moraChoices(kind, length))
              for (const h of masks(length))
                for (const v of masks(length)) {
                  const mods = forms.map((f, i): NoteAppearance => ({
                    ...f,
                    ...(moraIndexes(value, length).includes(i) ? { mora: 1 } : {}),
                    ...(h & (1 << i) ? { episema: true } : {}),
                    ...(v & (1 << i) ? { verticalEpisema: true } : {}),
                  }));
                  let out: string;
                  let outcome = 'ok';
                  try {
                    out = JSON.stringify(buildNeumeGeometry(kind, pitches, 50, 140, mods));
                  } catch (e) {
                    outcome = 'throw';
                    out = String(e);
                  }
                  lines.push(\`\${kind} \${pitches} \${JSON.stringify(mods)} \${outcome} \${createHash('sha256').update(out).digest('hex')}\`);
                }
        }
  writeFileSync(process.env.BASELINE_OUT ?? '/dev/null', lines.join('\\n'));
}, 600_000);
`;

async function dumpTree(tree, out) {
  const file = join(tree, testName);
  await writeFile(file, dump);
  try {
    execFileSync('npx', ['vitest', 'run', testName], {
      cwd: tree,
      env: {
        ...process.env,
        BASELINE_OUT: out,
        CONTOURS_OUT: join(scratch, 'contours.json'),
        ...(tree === root
          ? { CONTOURS: await readFile(join(scratch, 'contours.json'), 'utf8') }
          : {}),
      },
      stdio: 'ignore',
    });
  } finally {
    await rm(file, { force: true });
  }
  return readFile(out, 'utf8');
}

const scratch = await mkdtemp(join(tmpdir(), 'chant-existing-geometry-'));
const baseline = join(scratch, 'baseline');
try {
  await mkdir(baseline);
  const archive = execFileSync('git', ['archive', ref], {
    maxBuffer: 64 * 1024 * 1024,
  });
  execFileSync('tar', ['-x', '-C', baseline], {
    input: archive,
    maxBuffer: 64 * 1024 * 1024,
  });
  await symlink(join(root, 'node_modules'), join(baseline, 'node_modules'));
  const before = await dumpTree(baseline, join(scratch, 'before.txt'));
  const after = await dumpTree(root, join(scratch, 'after.txt'));

  const outcomes = (text) => {
    const lines = text.split('\n');
    const ok = lines.filter((l) => / ok [0-9a-f]{64}$/.test(l)).length;
    const thrown = lines.filter((l) => / throw [0-9a-f]{64}$/.test(l)).length;
    if (ok + thrown !== lines.length) throw Error('Unmarked dump line');
    return { cases: lines.length, exceptions: thrown };
  };
  const b = outcomes(before);
  const c = outcomes(after);
  const oldLines = before.split('\n'),
    newLines = after.split('\n');
  let unchanged = 0,
    repaired = 0,
    changed = 0,
    errors = 0;
  oldLines.forEach((line, i) => {
    if (line.includes(' ok ')) {
      if (line === newLines[i]) unchanged++;
      else changed++;
    } else if (newLines[i].includes(' ok ')) repaired++;
    else errors++;
  });
  console.log(
    JSON.stringify({
      ref,
      contours: JSON.parse(
        await readFile(join(scratch, 'contours.json'), 'utf8'),
      ),
      cases: b.cases,
      currentCases: c.cases,
      baselineExceptions: b.exceptions,
      currentExceptions: c.exceptions,
      unchanged,
      repaired,
      changed,
      errors,
    }),
  );
  if (b.cases !== c.cases || b.cases !== 22 * 2048 || changed || errors)
    process.exitCode = 1;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
