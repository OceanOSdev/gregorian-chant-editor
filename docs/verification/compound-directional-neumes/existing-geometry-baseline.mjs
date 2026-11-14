// Compare the geometry of every pre-existing neume kind between a baseline
// commit (default: Maintenance C master 5c24857) and the working tree.
//
// Usage (from the repository root, after `npm ci`):
//   node docs/verification/compound-directional-neumes/existing-geometry-baseline.mjs [ref]
//
// Same mechanism as ../extended-scandicus-climacus/three-note-baseline.mjs:
// a detached temporary worktree for the baseline, one temporary Vitest dump
// copied into both trees, hashed per case and removed. Valid contours are
// enumerated by the tree's own isValidNeume (steps of ±1..3 and unisons), with
// every supported mora scope, authored form and a bounded episema matrix.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ref = process.argv[2] ?? '5c24857';
const root = resolve('.');
const testName = 'src/existing-geometry-baseline.tmp.test.ts';
const dump = `import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { staffPosition, type Neume, type NoteAppearance } from './editor/domain/chant-document';
import { buildNeumeGeometry } from './editor/layout/neume-geometry';
import { moraChoices, moraIndexes } from './editor/domain/mora';
import { allowedNoteForms } from './editor/domain/note-forms';
import { isValidNeume } from './editor/domain/neume';

const families: [Neume['kind'], number[]][] = [
  ['punctum', [1]], ['podatus', [2]], ['clivis', [2]], ['bistropha', [2]],
  ['tristropha', [3]], ['scandicus', [3, 4, 5]], ['climacus', [3, 4, 5]],
  ['torculus', [3]], ['porrectus', [3]], ['pes-subpunctis', [4, 5]],
];
const steps = [-3, -2, -1, 0, 1, 2, 3];
function* contours(length: number): Generator<number[]> {
  if (length === 1) { yield [0]; return; }
  for (const rest of contours(length - 1))
    for (const step of steps) yield [...rest, rest[rest.length - 1] + step];
}
function masks(length: number): number[] {
  const all = (1 << length) - 1;
  return length <= 3
    ? Array.from({ length: all + 1 }, (_, i) => i)
    : [0, all, ...Array.from({ length }, (_, i) => 1 << i)];
}

it('dumps existing geometry', () => {
  const lines: string[] = [];
  for (const [kind, lengths] of families)
    for (const length of lengths)
      for (const offsets of contours(length))
        for (const first of [-2, 0, 1, 3, 6]) {
          const pitches = offsets.map((o) => staffPosition(first + o));
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
      env: { ...process.env, BASELINE_OUT: out },
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
  execFileSync('git', ['worktree', 'add', '--detach', baseline, ref], {
    stdio: 'ignore',
  });
  await symlink(join(root, 'node_modules'), join(baseline, 'node_modules'));
  const before = await dumpTree(baseline, join(scratch, 'before.txt'));
  const after = await dumpTree(root, join(scratch, 'after.txt'));
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  const outcomes = (text) => {
    const lines = text.split('\n');
    const ok = lines.filter((l) => / ok [0-9a-f]{64}$/.test(l)).length;
    const thrown = lines.filter((l) => / throw [0-9a-f]{64}$/.test(l)).length;
    if (ok + thrown !== lines.length) throw Error('Unmarked dump line');
    return { cases: lines.length, exceptions: thrown };
  };
  const b = outcomes(before);
  const c = outcomes(after);
  const result = {
    ref,
    cases: b.cases,
    currentCases: c.cases,
    baselineExceptions: b.exceptions,
    currentExceptions: c.exceptions,
    baselineSha256: hash(before),
    currentSha256: hash(after),
    identical: before === after,
  };
  console.log(JSON.stringify(result));
  if (!result.identical) process.exitCode = 1;
} finally {
  execFileSync('git', ['worktree', 'remove', '--force', baseline], {
    stdio: 'ignore',
  });
  await rm(scratch, { recursive: true, force: true });
}
