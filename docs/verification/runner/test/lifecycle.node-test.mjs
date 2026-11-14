// Runner orchestration and lifecycle with stub processes and a fake Chromium.
// No real browser is needed; one test starts the real Vite helper.
// Run with: npm run test:verify-runner
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ProcessRegistry, startProcess } from '../processes.mjs';
import {
  findBrowserExecutable,
  startChromium,
  startViteServer,
} from '../resources.mjs';
import {
  exitCodeFor,
  failureExcerpt,
  removeOwned,
  runVerification,
} from '../run.mjs';
import { selectJobs } from '../selection.mjs';

const HERE = import.meta.dirname;
const STUB = join(HERE, 'fixtures/stub-process.mjs');
const FAKE_CHROMIUM = join(HERE, 'fixtures/fake-chromium.mjs');
const REPO = resolve(HERE, '../../../..');
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Test drivers: `script` selects the stub driver's behaviour.
const driver = (id, script, server = 'dev', browsers = ['chromium']) => ({
  id,
  script,
  server,
  browsers,
});
const BEHAVIOUR = {
  pass: ['--sleep-ms', '300'],
  fail: ['--print', 'AssertionError: stub failed', '--exit', '3'],
  hang: ['--ignore-term'],
};

let root;
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'chant-runner-test-'));
});
after(async () => {
  await rm(root, { recursive: true, force: true });
});

async function newRunDir() {
  const dir = await mkdtemp(join(root, 'run-'));
  await mkdir(join(dir, 'records'));
  return dir;
}

function stubLaunchers(runDir, overrides = {}) {
  const calls = { build: 0, servers: 0, browsers: 0 };
  const stubService = async (registry, name, logPath, timeoutMs) => {
    const managed = startProcess(registry, {
      name,
      command: process.execPath,
      args: [STUB, '--print', 'READY'],
      stdoutPath: logPath,
    });
    await managed.waitForOutput(/READY/, timeoutMs);
    return managed;
  };
  return {
    calls,
    launchers: {
      findBrowser: async (browser) => `/stub/${browser}`,
      browserVersion: async () => 'Stub 1.0',
      build: async () => {
        calls.build++;
      },
      startServer: async (registry, { mode, logPath, startupTimeoutMs }) => {
        calls.servers++;
        const managed = await stubService(
          registry,
          'server',
          logPath,
          startupTimeoutMs,
        );
        const origin = `http://127.0.0.1:${10000 + managed.pid}`;
        return {
          process: managed,
          origin,
          env:
            mode === 'dev'
              ? { CHANT_EDITOR_URL: origin }
              : { CHANT_PREVIEW_URL: `${origin}/` },
        };
      },
      startBrowser: async (
        registry,
        { browser, logPath, startupTimeoutMs },
      ) => {
        calls.browsers++;
        const managed = await stubService(
          registry,
          'browser',
          logPath,
          startupTimeoutMs,
        );
        const endpoint = `http://127.0.0.1:${20000 + managed.pid}/json`;
        return {
          process: managed,
          endpoint,
          version: null,
          env:
            browser === 'chromium'
              ? { CHANT_CHROMIUM_URL: endpoint }
              : { CHANT_FIREFOX_URL: endpoint },
        };
      },
      driverCommand: ({ job }) => ({
        command: process.execPath,
        args: [
          STUB,
          ...BEHAVIOUR[job.script],
          '--record',
          join(runDir, 'records', `${job.key}.json`),
          '--child-pid-file',
          join(runDir, 'records', `${job.key}.child`),
        ],
      }),
      ...overrides,
    },
  };
}

const run = (runDir, drivers, launchers, options = {}) =>
  runVerification({
    selection: selectJobs(
      {
        driverIds: drivers.map((d) => d.id),
        preset: null,
        browsers: options.browsers ?? ['chromium'],
      },
      drivers,
      {},
    ),
    runDir,
    repoRoot: REPO,
    concurrency: options.concurrency ?? 2,
    startupTimeoutMs: options.startupTimeoutMs ?? 5000,
    jobTimeoutMs: options.jobTimeoutMs ?? 10000,
    launchers,
    signal: options.signal,
    baseEnv: options.baseEnv ?? process.env,
  });

const records = (runDir) =>
  readdir(join(runDir, 'records')).then((names) =>
    names
      .filter((name) => name.endsWith('.json'))
      .map((name) =>
        JSON.parse(readFileSync(join(runDir, 'records', name), 'utf8')),
      ),
  );
const childPids = (runDir) =>
  readdir(join(runDir, 'records')).then((names) =>
    names
      .filter((name) => name.endsWith('.child'))
      .map((name) =>
        Number(readFileSync(join(runDir, 'records', name), 'utf8')),
      ),
  );

describe('runVerification with stub processes', () => {
  it('reports passes and nonzero driver exits, continuing independent jobs', async () => {
    const runDir = await newRunDir();
    const { launchers } = stubLaunchers(runDir);
    const summary = await run(
      runDir,
      [driver('a', 'fail'), driver('b', 'pass')],
      launchers,
    );
    assert.deepEqual(
      summary.jobs.map((job) => [job.driver, job.status, job.exitCode]),
      [
        ['a', 'failed', 3],
        ['b', 'passed', 0],
      ],
    );
    assert.equal(summary.jobs[0].error, 'AssertionError: stub failed');
    assert.equal(exitCodeFor(summary), 1);
    assert.equal(summary.counts.failed, 1);
    assert.match(
      readFileSync(summary.jobs[0].logs.driverStdout, 'utf8'),
      /stub failed/,
    );
  });

  it('bounds concurrency and gives every job unique resources and a clean env', async () => {
    const runDir = await newRunDir();
    const { launchers, calls } = stubLaunchers(runDir);
    const drivers = ['a', 'b', 'c', 'd', 'e'].map((id) => driver(id, 'pass'));
    const summary = await run(runDir, drivers, launchers, {
      concurrency: 2,
      baseEnv: {
        ...process.env,
        CHANT_BASELINE: '1',
        CHANT_CORPUS: 'diagnostic',
        CHANT_LEGACY_URL: 'http://legacy',
        CHANT_FIREFOX_URL: 'ws://elsewhere/session',
      },
    });
    assert.equal(summary.counts.passed, 5);
    assert.equal(summary.maxObservedConcurrency, 2);
    assert.equal(calls.build, 0, 'dev-only selection must not build');
    const seen = await records(runDir);
    // Driver lifetimes never overlap more than the bound.
    for (const record of seen) {
      const overlapping = seen.filter(
        (other) => other.start < record.end && other.end > record.start,
      );
      assert.ok(overlapping.length <= 2);
    }
    for (const field of [
      'profileDir',
      'jobDir',
      'driverTmpDir',
      'origin',
      'browserEndpoint',
    ]) {
      const values = summary.jobs.map((job) => job[field]);
      assert.equal(new Set(values).size, values.length, field);
    }
    for (const record of seen) {
      assert.deepEqual(Object.keys(record.env).sort(), [
        'CHANT_CHROMIUM_URL',
        'CHANT_EDITOR_URL',
        'TMPDIR',
      ]);
    }
    for (const job of summary.jobs) {
      assert.equal(existsSync(job.profileDir), false, 'profile removed');
      assert.equal(existsSync(job.driverTmpDir), true, 'driver output kept');
    }
  });

  it('builds once only when a preview job can run; a failed build fails only preview jobs', async () => {
    const runDir = await newRunDir();
    const { launchers, calls } = stubLaunchers(runDir);
    const drivers = [
      driver('p1', 'pass', 'preview'),
      driver('p2', 'pass', 'preview'),
      driver('d', 'pass'),
    ];
    const ok = await run(runDir, drivers, launchers);
    assert.equal(calls.build, 1);
    assert.equal(ok.counts.passed, 3);

    const failedRun = await newRunDir();
    const failing = stubLaunchers(failedRun, {
      build: async () => {
        throw Error('build exploded');
      },
    });
    const summary = await run(failedRun, drivers, failing.launchers);
    assert.deepEqual(
      summary.jobs.map((job) => job.status),
      ['setup_failed', 'setup_failed', 'passed'],
    );
    assert.match(summary.jobs[0].error, /build exploded/);
  });

  it('stops a hung driver and its descendants at the job timeout', async () => {
    const runDir = await newRunDir();
    const { launchers } = stubLaunchers(runDir);
    const summary = await run(runDir, [driver('h', 'hang')], launchers, {
      jobTimeoutMs: 500,
    });
    assert.equal(summary.jobs[0].status, 'timed_out');
    assert.equal(exitCodeFor(summary), 1);
    const [child] = await childPids(runDir);
    assert.equal(
      alive(child),
      false,
      'grandchild reaped with its process group',
    );
  });

  it('interrupts running jobs, skips queued ones and leaves nothing running', async () => {
    const runDir = await newRunDir();
    const { launchers } = stubLaunchers(runDir);
    const controller = new AbortController();
    const pending = run(
      runDir,
      [driver('h1', 'hang'), driver('h2', 'hang')],
      launchers,
      { concurrency: 1, signal: controller.signal },
    );
    for (let i = 0; i < 100 && (await childPids(runDir)).length === 0; i++)
      await delay(50);
    controller.abort();
    const summary = await pending;
    assert.deepEqual(
      summary.jobs.map((job) => job.status),
      ['interrupted', 'not_run'],
    );
    assert.equal(exitCodeFor(summary), 130);
    for (const pid of await childPids(runDir)) assert.equal(alive(pid), false);
    assert.equal(existsSync(summary.jobs[0].profileDir), false);
  });

  it('reports a missing browser as setup failure without launching anything', async () => {
    const runDir = await newRunDir();
    const emptyPath = await mkdtemp(join(root, 'path-'));
    const { launchers, calls } = stubLaunchers(runDir, {
      findBrowser: (browser, override) =>
        findBrowserExecutable(browser, override, {
          env: { PATH: emptyPath },
          platform: 'linux',
        }),
    });
    const summary = await run(
      runDir,
      [driver('a', 'pass', 'preview', ['firefox'])],
      launchers,
      {
        browsers: ['firefox'],
      },
    );
    assert.equal(summary.jobs[0].status, 'setup_failed');
    assert.match(summary.jobs[0].error, /No firefox executable found/);
    assert.equal(calls.build + calls.servers + calls.browsers, 0);
    await assert.rejects(
      findBrowserExecutable('chromium', join(emptyPath, 'nope')),
      /missing or not executable/,
    );
  });
});

describe('browser and server readiness', () => {
  const chromium = async (mode, startupTimeoutMs = 5000) => {
    const registry = new ProcessRegistry();
    const profileDir = await mkdtemp(join(root, 'profile-'));
    try {
      return await startChromium(registry, {
        executable: FAKE_CHROMIUM,
        profileDir,
        logPath: join(profileDir, 'log'),
        startupTimeoutMs,
        env: { ...process.env, FAKE_CHROMIUM_MODE: mode },
      });
    } finally {
      await registry.stopAll();
      assert.equal(registry.active.length, 0);
    }
  };

  it('accepts only the DevTools endpoint owned by the spawned browser', async () => {
    const browser = await chromium('ok');
    assert.match(
      browser.env.CHANT_CHROMIUM_URL,
      /^http:\/\/127\.0\.0\.1:\d+\/json$/,
    );
    assert.equal(browser.version, 'FakeChrome/1.0');
  });

  it('rejects a pre-existing service on the claimed port and leaves it running', async () => {
    const foreign = spawn(process.execPath, [FAKE_CHROMIUM], {
      env: { ...process.env, FAKE_CHROMIUM_MODE: 'ok' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const port = await new Promise((resolveLine) =>
      foreign.stderr.on('data', (chunk) =>
        resolveLine(String(chunk).match(/:(\d+)\/devtools/)[1]),
      ),
    );
    try {
      await assert.rejects(
        chromium(`foreign:${port}`, 1500),
        /different browser|within/,
      );
      assert.equal(alive(foreign.pid), true, 'unrelated process untouched');
    } finally {
      foreign.kill();
    }
  });

  it('fails fast on early exit and times out on a silent browser', async () => {
    await assert.rejects(chromium('exit'), /exited early \(code 7/);
    const start = Date.now();
    await assert.rejects(chromium('silent', 400), /within 400 ms/);
    assert.ok(Date.now() - start < 3000);
  });

  it('starts the real dev fixture on a dynamic port and refuses an occupied one', async () => {
    const registry = new ProcessRegistry();
    const dir = await mkdtemp(join(root, 'vite-'));
    try {
      const server = await startViteServer(registry, {
        mode: 'dev',
        repoRoot: REPO,
        cacheDir: join(dir, 'cache'),
        outDir: null,
        logPath: join(dir, 'server.log'),
        startupTimeoutMs: 20000,
        env: process.env,
      });
      assert.match(server.env.CHANT_EDITOR_URL, /^http:\/\/127\.0\.0\.1:\d+$/);
    } finally {
      await registry.stopAll();
    }
    // An explicitly requested occupied port fails under strictPort, and the
    // test-owned listener holding it is not disturbed.
    const holder = createServer();
    await new Promise((r) => holder.listen(0, '127.0.0.1', r));
    const { port } = holder.address();
    const helper = spawn(
      process.execPath,
      [
        join(HERE, '../vite-server.mjs'),
        '--mode',
        'dev',
        '--root',
        REPO,
        '--port',
        String(port),
        '--cache-dir',
        join(dir, 'cache2'),
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let stderr = '';
    helper.stderr.on('data', (chunk) => (stderr += chunk));
    const code = await new Promise((r) => helper.on('exit', r));
    assert.notEqual(code, 0);
    assert.match(stderr, /already in use|EADDRINUSE/);
    assert.equal(holder.listening, true);
    holder.close();
  });
});

describe('helpers', () => {
  it('refuses to remove anything outside the run directory', async () => {
    const runDir = await newRunDir();
    await assert.rejects(removeOwned(runDir, root), /Refusing/);
    await assert.rejects(removeOwned(runDir, runDir), /Refusing/);
    await assert.rejects(
      removeOwned(runDir, join(runDir, '..', 'x')),
      /Refusing/,
    );
  });

  it('extracts the assertion and failing frame from driver output', () => {
    const output = [
      'Screenshots: /tmp/x',
      'node:internal/modules/run_main:107',
      'AssertionError [ERR_ASSERTION]: podatus note0-1 at 1440',
      '',
      '    at file:///repo/docs/verification/w/browser-check.mjs:327:20 {',
      'Node.js v24.12.0',
    ].join('\n');
    assert.equal(
      failureExcerpt(output),
      'AssertionError [ERR_ASSERTION]: podatus note0-1 at 1440\nat file:///repo/docs/verification/w/browser-check.mjs:327:20 {',
    );
  });
});
