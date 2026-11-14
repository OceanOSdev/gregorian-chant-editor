#!/usr/bin/env node
// Entry point for `npm run verify:browser`. See README.md in this directory.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { ProcessRegistry } from './processes.mjs';
import { exitCodeFor, runVerification } from './run.mjs';
import {
  HELP,
  UsageError,
  formatList,
  parseCliArgs,
  selectJobs,
} from './selection.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, '../../..');

async function gitState() {
  try {
    const run = async (...args) =>
      (await execFileAsync('git', args, { cwd: repoRoot })).stdout.trim();
    const revision = await run('rev-parse', 'HEAD');
    const status = await run('status', '--porcelain');
    return {
      revision,
      dirty: status.length > 0,
      dirtyFiles: status ? status.split('\n') : [],
    };
  } catch (error) {
    return { revision: null, dirty: null, error: error.message };
  }
}

const seconds = (ms) =>
  ms === null || ms === undefined ? '-' : `${(ms / 1000).toFixed(1)}s`;
const show = (path) => relative(process.cwd(), path) || '.';

function formatSummary(summary, runDir) {
  const rows = [...summary.jobs, ...summary.unsupported];
  const width = Math.max(
    ...rows.map((row) => `${row.driver} [${row.browser}]`.length),
  );
  const lines = ['', 'Results:'];
  for (const row of rows) {
    const label = `${row.driver} [${row.browser}]`.padEnd(width);
    const timing =
      row.status === 'unsupported' || row.status === 'not_run'
        ? ''
        : ` ${seconds(row.durationMs)} (setup ${seconds(row.setupMs)}, driver ${seconds(row.driverMs)})`;
    lines.push(`  ${row.status.toUpperCase().padEnd(12)} ${label}${timing}`);
    if (row.status !== 'passed' && row.error) {
      for (const line of row.error.split('\n').slice(-6))
        lines.push(`      ${line}`);
      if (row.logs) lines.push(`      logs: ${show(row.jobDir)}/`);
    }
    if (
      row.knownIssue &&
      row.browser === 'firefox' &&
      row.status === 'failed'
    ) {
      lines.push(`      known issue (not waived): ${row.knownIssue}`);
    }
  }
  const counts = Object.entries(summary.counts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
  lines.push(
    '',
    `Build: ${summary.build.status}${summary.build.durationMs !== null ? ` (${seconds(summary.build.durationMs)})` : ''}`,
    `Totals: ${counts}; wall clock ${seconds(summary.durationMs)} at concurrency ${summary.concurrency}`,
    `Run directory: ${runDir}`,
    `Summary: ${join(runDir, 'summary.json')}`,
  );
  return lines.join('\n');
}

async function main() {
  let options;
  let selection;
  try {
    options = parseCliArgs(process.argv.slice(2), process.env);
    if (options.help) {
      console.log(HELP);
      return 0;
    }
    if (options.list) {
      console.log(formatList());
      return 0;
    }
    selection = selectJobs(options);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(
        `verify:browser: ${error.message}\n\nRun with --help for usage.`,
      );
      return 2;
    }
    throw error;
  }
  if (process.platform === 'win32') {
    console.error(
      'verify:browser: Windows is not supported (POSIX process groups are required).',
    );
    return 2;
  }

  const parent = resolve(
    options.outputDir ?? join(repoRoot, '.verification-runs'),
  );
  await mkdir(parent, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = await mkdtemp(join(parent, `run-${stamp}-`));
  const git = await gitState();

  const controller = new AbortController();
  const registry = new ProcessRegistry();
  let interrupts = 0;
  const onSignal = (name) => {
    interrupts++;
    if (interrupts === 1) {
      console.error(
        `\n${name}: interrupting; stopping only runner-owned processes...`,
      );
      controller.abort();
    } else {
      console.error(`${name}: forcing shutdown of runner-owned processes.`);
      registry
        .stopAll({ graceMs: 0, killMs: 2000 })
        .finally(() => process.exit(130));
    }
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  process.on('SIGHUP', onSignal);

  const pairs = selection.runnable.map(
    ({ driver, browser }) => `${driver.id}[${browser}]`,
  );
  console.log(
    `verify:browser: ${pairs.length} job(s) at concurrency ${options.concurrency}` +
      ` (${options.preset ? `preset ${options.preset}` : 'explicit drivers'}; ${options.browsers.join(', ')})`,
  );
  if (selection.unsupported.length > 0) {
    console.log(
      `  unsupported, not run: ${selection.unsupported.map(({ driver, browser }) => `${driver.id}[${browser}]`).join(', ')}`,
    );
  }
  console.log(
    `  revision ${git.revision ?? 'unknown'}${git.dirty ? ' (dirty working tree)' : ''}`,
  );
  console.log(`  run directory ${runDir}`);

  const summary = await runVerification({
    selection,
    runDir,
    repoRoot,
    concurrency: options.concurrency,
    startupTimeoutMs: options.startupTimeoutMs,
    jobTimeoutMs: options.jobTimeoutMs,
    binaries: options.binaries,
    keepProfiles: options.keepProfiles,
    signal: controller.signal,
    registry,
    onEvent: (event) => {
      if (event.type === 'build-start')
        console.log('  building production bundle once...');
      if (event.type === 'build-end')
        console.log(
          `  build ${event.build.status} in ${seconds(event.build.durationMs)}`,
        );
      if (event.type === 'job-start') console.log(`  start  ${event.job.key}`);
      if (event.type === 'job-end')
        console.log(
          `  ${event.job.status.padEnd(6)} ${event.job.key} ${seconds(event.job.durationMs)}`,
        );
    },
  });
  const record = {
    schema: 1,
    runDir,
    repoRoot,
    git,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    selection: {
      argv: process.argv.slice(2),
      preset: options.preset,
      driverIds: options.driverIds,
      browsers: options.browsers,
    },
    ...summary,
  };
  await writeFile(
    join(runDir, 'summary.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  console.log(formatSummary(summary, runDir));
  return exitCodeFor(summary);
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error?.stack ?? String(error));
    process.exit(1);
  },
);
