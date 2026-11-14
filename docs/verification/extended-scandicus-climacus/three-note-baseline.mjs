// Compare three-note Scandicus/Climacus geometry between a baseline commit
// (default: Stage 9B-1 master a2111bf) and the current working tree.
//
// Usage (from the repository root, after `npm ci`):
//   node docs/verification/extended-scandicus-climacus/three-note-baseline.mjs [ref]
//
// A detached temporary worktree is created for the baseline; the same
// temporary Vitest dump is copied into both trees, run, hashed and removed.
// Both trees use this checkout's node_modules. Nothing is committed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ref = process.argv[2] ?? 'a2111bf';
const root = resolve('.');
const testName = 'src/three-note-baseline.tmp.test.ts';
const dump = `import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { staffPosition, type NoteAppearance } from './editor/domain/chant-document';
import { buildNeumeGeometry } from './editor/layout/neume-geometry';
import { moraIndexes } from './editor/domain/mora';

it('dumps three-note scandicus/climacus geometry', () => {
  const lines: string[] = [];
  for (const kind of ['scandicus', 'climacus'] as const)
    for (let first = -4; first <= 8; first++)
      for (let a = 1; a <= 4; a++)
        for (let b = 1; b <= 4; b++) {
          const sign = kind === 'scandicus' ? 1 : -1;
          const pitches = [first, first + sign * a, first + sign * (a + b)].map(staffPosition);
          const forms: NoteAppearance[][] = [[{}, {}, {}]];
          if (kind === 'scandicus') forms.push([{}, { form: 'quilisma' }, {}]);
          for (const form of forms)
            for (const scope of ['none', 'final', 'final-two'] as const)
              for (let h = 0; h < 8; h++)
                for (let v = 0; v < 8; v++) {
                  const mods = form.map((f, i): NoteAppearance => ({
                    ...f,
                    ...(moraIndexes(scope, 3).includes(i) ? { mora: 1 } : {}),
                    ...(h & (1 << i) ? { episema: true } : {}),
                    ...(v & (1 << i) ? { verticalEpisema: true } : {}),
                  }));
                  let out: string;
                  try {
                    out = JSON.stringify(buildNeumeGeometry(kind, pitches, 50, 140, mods));
                  } catch (e) {
                    out = 'throw:' + String(e);
                  }
                  lines.push(\`\${kind} \${pitches} \${JSON.stringify(mods)} \${createHash('sha256').update(out).digest('hex')}\`);
                }
        }
  writeFileSync(process.env.BASELINE_OUT ?? '/dev/null', lines.join('\\n'));
});
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

const scratch = await mkdtemp(join(tmpdir(), 'chant-three-note-baseline-'));
const baseline = join(scratch, 'baseline');
try {
  execFileSync('git', ['worktree', 'add', '--detach', baseline, ref], {
    stdio: 'ignore',
  });
  await symlink(join(root, 'node_modules'), join(baseline, 'node_modules'));
  const before = await dumpTree(baseline, join(scratch, 'before.txt'));
  const after = await dumpTree(root, join(scratch, 'after.txt'));
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  const cases = before.split('\n').length;
  const throws = before.split('\n').filter((l) => l.includes('throw:')).length;
  const result = {
    ref,
    cases,
    throwsInBaseline: throws,
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
