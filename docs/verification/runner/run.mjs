// Orchestration: one optional build, then a bounded pool of fully isolated
// jobs (own server, browser process, profile, endpoints, temp directory).
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { TRANSPORTS } from './manifest.mjs';
import {
  ProcessRegistry,
  SetupError,
  TimeoutError,
  startProcess,
} from './processes.mjs';
import {
  browserVersion,
  cleanEnv,
  findBrowserExecutable,
  runViteBuild,
  startChromium,
  startFirefox,
  startViteServer,
} from './resources.mjs';

export const STATUSES = [
  'passed',
  'failed',
  'timed_out',
  'setup_failed',
  'interrupted',
  'not_run',
  'unsupported',
];

export const defaultLaunchers = {
  findBrowser: (browser, override) => findBrowserExecutable(browser, override),
  browserVersion,
  build: runViteBuild,
  startServer: startViteServer,
  startBrowser: (registry, options) =>
    (options.browser === 'chromium' ? startChromium : startFirefox)(
      registry,
      options,
    ),
  driverCommand: ({ scriptPath }) => ({
    command: process.execPath,
    args: [scriptPath],
  }),
};

const elapsed = (start) => Date.now() - start;
const iso = (ms) => new Date(ms).toISOString();

/**
 * Remove a directory the runner created, refusing anything outside the run
 * directory so cleanup can never reach a user profile or unrelated files.
 */
async function removeOwned(runDir, dir) {
  const rel = relative(runDir, resolve(dir));
  if (!rel || rel.startsWith('..') || resolve(runDir, rel) !== resolve(dir)) {
    throw Error(`Refusing to remove ${dir}: outside run directory ${runDir}`);
  }
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

function waitOrTimeout(managed, timeoutMs, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish({ kind: 'timeout' }), timeoutMs);
    const onAbort = () => finish({ kind: 'interrupted' });
    const finish = (value) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    if (signal?.aborted) return finish({ kind: 'interrupted' });
    signal?.addEventListener('abort', onAbort, { once: true });
    managed.exited.then((info) => finish({ kind: 'exit', info }));
  });
}

/** Reject if the signal aborts first; otherwise settle with `promise`. */
function abortable(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new InterruptedError());
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

class InterruptedError extends Error {
  name = 'InterruptedError';
  message = 'Interrupted';
}

async function runJob(job, context) {
  const {
    registry,
    runDir,
    repoRoot,
    launchers,
    startupTimeoutMs,
    jobTimeoutMs,
    keepProfiles,
    browserInfo,
    preview,
    signal,
    baseEnv,
    onEvent,
  } = context;
  const jobDir = join(runDir, 'jobs', job.key);
  const profileDir = join(jobDir, 'profile');
  const tmpDir = join(jobDir, 'driver-tmp');
  const cacheDir = join(jobDir, 'vite-cache');
  await mkdir(profileDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });
  const logs = {
    driverStdout: join(jobDir, 'driver.stdout.log'),
    driverStderr: join(jobDir, 'driver.stderr.log'),
    server: join(jobDir, 'server.log'),
    browser: join(jobDir, 'browser.log'),
  };
  const result = {
    ...job.record,
    status: 'not_run',
    jobDir,
    profileDir,
    driverTmpDir: tmpDir,
    logs,
    startedAt: null,
    endedAt: null,
    durationMs: null,
    setupMs: null,
    driverMs: null,
    origin: null,
    driverEnv: null,
    browserEndpoint: null,
    exitCode: null,
    signal: null,
    error: null,
    driverOutputDirs: [],
  };
  const started = Date.now();
  result.startedAt = iso(started);
  onEvent?.({ type: 'job-start', job: result });
  const jobRegistry = registry.scope();
  try {
    const info = browserInfo[job.browser];
    if (info.error) throw new SetupError(info.error);
    if (job.server === 'preview' && preview.error) {
      throw new SetupError(`Production build unavailable: ${preview.error}`);
    }
    const env = cleanEnv(baseEnv);
    const startServer = launchers.startServer(jobRegistry, {
      mode: job.server,
      repoRoot,
      cacheDir: job.server === 'dev' ? cacheDir : null,
      outDir: job.server === 'preview' ? preview.outDir : null,
      logPath: logs.server,
      startupTimeoutMs,
      env,
    });
    const startBrowser = launchers.startBrowser(jobRegistry, {
      browser: job.browser,
      executable: info.executable,
      profileDir,
      logPath: logs.browser,
      startupTimeoutMs,
      env,
    });
    const settled = await abortable(
      Promise.allSettled([startServer, startBrowser]),
      signal,
    );
    const failure = settled.find((outcome) => outcome.status === 'rejected');
    if (failure) throw failure.reason;
    const [server, browser] = settled.map((outcome) => outcome.value);
    result.origin = server.origin;
    result.browserEndpoint = browser.endpoint;
    result.browserProtocolVersion = browser.version ?? null;
    const driverEnv = { ...server.env, ...browser.env };
    result.driverEnv = driverEnv;
    result.setupMs = elapsed(started);

    const { command, args } = launchers.driverCommand({
      scriptPath: join(repoRoot, 'docs/verification', job.script),
      job,
    });
    const driverStart = Date.now();
    const driver = startProcess(jobRegistry, {
      name: `driver ${job.key}`,
      command,
      args,
      cwd: repoRoot,
      env: { ...env, ...driverEnv, TMPDIR: tmpDir },
      stdoutPath: logs.driverStdout,
      stderrPath: logs.driverStderr,
    });
    const outcome = await waitOrTimeout(driver, jobTimeoutMs, signal);
    result.driverMs = elapsed(driverStart);
    if (outcome.kind === 'exit') {
      result.exitCode = outcome.info.code;
      result.signal = outcome.info.signal;
      if (outcome.info.error) {
        result.status = 'setup_failed';
        result.error = `Driver failed to start: ${outcome.info.error}`;
      } else {
        result.status = outcome.info.code === 0 ? 'passed' : 'failed';
        if (result.status === 'failed') {
          result.error = lastLines(driver.output, 12);
        }
      }
    } else if (outcome.kind === 'timeout') {
      result.status = 'timed_out';
      result.error = `Driver exceeded --job-timeout (${jobTimeoutMs} ms) and was stopped`;
    } else {
      result.status = 'interrupted';
      result.error = 'Interrupted while the driver was running';
    }
  } catch (error) {
    if (error instanceof InterruptedError || signal?.aborted) {
      result.status = 'interrupted';
      result.error = 'Interrupted during setup';
    } else {
      result.status = 'setup_failed';
      result.error =
        error instanceof TimeoutError || error instanceof SetupError
          ? error.message
          : (error?.stack ?? String(error));
    }
  } finally {
    // Stop everything this job may have started, including resources whose
    // startup was still pending when another one failed.
    await jobRegistry.stopAll();
    try {
      if (!keepProfiles) await removeOwned(runDir, profileDir);
      await removeOwned(runDir, cacheDir);
    } catch (error) {
      result.error = [result.error, `Cleanup: ${error.message}`]
        .filter(Boolean)
        .join('\n');
    }
    result.profileRemoved = !keepProfiles;
    try {
      result.driverOutputDirs = (await readdir(tmpDir)).map((name) =>
        join(tmpDir, name),
      );
    } catch {
      result.driverOutputDirs = [];
    }
    const ended = Date.now();
    result.endedAt = iso(ended);
    result.durationMs = ended - started;
    onEvent?.({ type: 'job-end', job: result });
  }
  return result;
}

const lastLines = (text, count) =>
  text.trimEnd().split('\n').slice(-count).join('\n');

/**
 * Run selected jobs. Returns the machine-readable summary (without writing
 * it). `launchers` is the test seam; production uses defaultLaunchers.
 */
export async function runVerification({
  selection,
  runDir,
  repoRoot,
  concurrency,
  startupTimeoutMs,
  jobTimeoutMs,
  binaries = {},
  keepProfiles = false,
  launchers = defaultLaunchers,
  signal,
  baseEnv = process.env,
  onEvent,
  registry = new ProcessRegistry(),
}) {
  const runStart = Date.now();
  const jobs = selection.runnable.map(({ driver, browser }, index) => {
    const key = `${String(index + 1).padStart(2, '0')}-${driver.id}-${browser}`;
    return {
      key,
      script: driver.script,
      server: driver.server,
      browser,
      record: {
        key,
        driver: driver.id,
        browser,
        transport: TRANSPORTS[browser],
        server: driver.server,
        script: `docs/verification/${driver.script}`,
        knownIssue: driver.knownIssue ?? null,
      },
    };
  });

  // Browser discovery: a missing requested browser is a setup failure for its
  // jobs, never a silent skip.
  const browserInfo = {};
  for (const browser of new Set(jobs.map((job) => job.browser))) {
    try {
      const executable = await launchers.findBrowser(
        browser,
        binaries[browser],
      );
      let version = null;
      try {
        version = await launchers.browserVersion(executable);
      } catch (error) {
        version = `unknown (${error.message})`;
      }
      browserInfo[browser] = { executable, version, error: null };
    } catch (error) {
      browserInfo[browser] = {
        executable: null,
        version: null,
        error: error.message,
      };
    }
  }

  // One production build per invocation, before any preview server, only if
  // a preview job can actually run.
  const preview = {
    status: 'not_needed',
    outDir: null,
    durationMs: null,
    error: null,
  };
  const previewJobs = jobs.filter(
    (job) => job.server === 'preview' && !browserInfo[job.browser].error,
  );
  if (previewJobs.length > 0 && !signal?.aborted) {
    preview.outDir = join(runDir, 'build', 'dist');
    preview.log = join(runDir, 'build', 'build.log');
    await mkdir(join(runDir, 'build'), { recursive: true });
    const buildStart = Date.now();
    onEvent?.({ type: 'build-start' });
    try {
      await abortable(
        launchers.build(registry, {
          repoRoot,
          outDir: preview.outDir,
          logPath: preview.log,
          timeoutMs: Math.max(startupTimeoutMs, 300_000),
          env: cleanEnv(baseEnv),
        }),
        signal,
      );
      preview.status = 'passed';
    } catch (error) {
      preview.status = signal?.aborted ? 'interrupted' : 'failed';
      preview.error = error.message;
    }
    preview.durationMs = elapsed(buildStart);
    onEvent?.({ type: 'build-end', build: preview });
  }

  const results = new Array(jobs.length);
  let next = 0;
  let maxActive = 0;
  let active = 0;
  const context = {
    registry,
    runDir,
    repoRoot,
    launchers,
    startupTimeoutMs,
    jobTimeoutMs,
    keepProfiles,
    browserInfo,
    preview,
    signal,
    baseEnv,
    onEvent,
  };
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++;
      const job = jobs[index];
      if (signal?.aborted) {
        results[index] = {
          ...job.record,
          status: 'not_run',
          error: 'Interrupted before this job started',
        };
        continue;
      }
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        results[index] = await runJob(job, context);
      } finally {
        active--;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, worker),
  );
  // Defensive: nothing started for this run may outlive it.
  await registry.stopAll();

  for (const result of results) {
    const info = browserInfo[result.browser];
    result.browserExecutable = info.executable;
    result.browserVersion ??= info.version;
  }
  const unsupported = selection.unsupported.map(
    ({ driver, browser, reason }) => ({
      driver: driver.id,
      browser,
      transport: TRANSPORTS[browser],
      server: driver.server,
      status: 'unsupported',
      error: reason,
    }),
  );
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const result of [...results, ...unsupported]) counts[result.status]++;
  const runEnd = Date.now();
  return {
    startedAt: iso(runStart),
    endedAt: iso(runEnd),
    durationMs: runEnd - runStart,
    concurrency,
    maxObservedConcurrency: maxActive,
    startupTimeoutMs,
    jobTimeoutMs,
    interrupted: Boolean(signal?.aborted),
    browsers: browserInfo,
    build: preview,
    counts,
    jobs: results,
    unsupported,
  };
}

export function exitCodeFor(summary) {
  if (summary.interrupted) return 130;
  const bad = summary.jobs.some((job) => job.status !== 'passed');
  return bad ? 1 : 0;
}
