// Default launchers: browser discovery, headless browser and Vite server
// startup with ownership-checked readiness, and the one production build.
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';
import {
  SetupError,
  fetchWithTimeout,
  pollUntil,
  startProcess,
} from './processes.mjs';

const execFileAsync = promisify(execFile);
const HERE = import.meta.dirname;
const READY_PREFIX = 'CHANT_RUNNER_SERVER_READY ';
const FIXTURE_PATH = '/docs/verification/placement/browser-fixture.html';
const FIXTURE_TITLE = 'Placement verification fixture';

// Discovery order is fixed and documented in README.md. Explicit overrides
// (--chromium-binary/--firefox-binary or CHANT_RUNNER_*_BINARY) always win.
export const BROWSER_CANDIDATES = {
  chromium: {
    path: [
      'chromium',
      'chromium-browser',
      'google-chrome-stable',
      'google-chrome',
    ],
    darwin: [
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ],
  },
  firefox: {
    path: ['firefox', 'firefox-esr'],
    darwin: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
  },
};

const isExecutable = async (file) => {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** Find a browser executable without installing or downloading anything. */
export async function findBrowserExecutable(
  browser,
  override,
  { env = process.env, platform = process.platform } = {},
) {
  if (override) {
    if (await isExecutable(override)) return override;
    throw new SetupError(
      `${browser} executable override '${override}' is missing or not executable`,
    );
  }
  const candidates = BROWSER_CANDIDATES[browser];
  const dirs = (env.PATH ?? '').split(delimiter).filter(Boolean);
  for (const name of candidates.path) {
    for (const dir of dirs) {
      const file = join(dir, name);
      if (await isExecutable(file)) return file;
    }
  }
  if (platform === 'darwin') {
    for (const file of candidates.darwin) {
      if (await isExecutable(file)) return file;
    }
  }
  throw new SetupError(
    `No ${browser} executable found (tried ${candidates.path.join(', ')} on PATH). ` +
      `Pass --${browser}-binary <path>. The runner never downloads browsers.`,
  );
}

export async function browserVersion(executable) {
  const { stdout } = await execFileAsync(executable, ['--version'], {
    timeout: 30_000,
  });
  return stdout.trim();
}

/** Inherited environment without any CHANT_* overrides or mode flags. */
export function cleanEnv(base, prefix = 'CHANT_') {
  return Object.fromEntries(
    Object.entries(base).filter(([key]) => !key.startsWith(prefix)),
  );
}

export async function startChromium(
  registry,
  { executable, profileDir, logPath, startupTimeoutMs, env },
) {
  const browser = startProcess(registry, {
    name: 'chromium',
    command: executable,
    args: [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profileDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    env,
    stdoutPath: logPath,
  });
  // The browser we spawned prints its own randomly chosen DevTools port and
  // unique browser ID; requiring /json/version to echo that same ID proves the
  // endpoint belongs to this process, not to some pre-existing service.
  const [, browserWs, port] = await browser.waitForOutput(
    /DevTools listening on (ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/[\w-]+)/,
    startupTimeoutMs,
    'DevTools listening line',
  );
  const base = `http://127.0.0.1:${port}/json`;
  const deadline = { timeoutMs: startupTimeoutMs, watch: [browser] };
  const version = await pollUntil(
    async () => {
      const info = await (await fetchWithTimeout(`${base}/version`)).json();
      if (info.webSocketDebuggerUrl !== browserWs) {
        throw new SetupError(
          `DevTools port ${port} answered for a different browser (${info.webSocketDebuggerUrl})`,
        );
      }
      return info;
    },
    { ...deadline, description: 'owned Chromium DevTools endpoint' },
  );
  await pollUntil(
    async () =>
      (await (await fetchWithTimeout(`${base}/list`)).json()).some(
        (target) => target.type === 'page',
      ),
    { ...deadline, description: 'Chromium page target' },
  );
  return {
    process: browser,
    env: { CHANT_CHROMIUM_URL: base },
    endpoint: base,
    version: version.Browser,
  };
}

function bidiStatus(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(Error('session.status timed out'));
    }, timeoutMs);
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(Error(`cannot connect to ${url}`));
    });
    socket.addEventListener('open', () =>
      socket.send(
        JSON.stringify({ id: 1, method: 'session.status', params: {} }),
      ),
    );
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timer);
      socket.close();
      resolve(message.result);
    });
  });
}

export async function startFirefox(
  registry,
  { executable, profileDir, logPath, startupTimeoutMs, env },
) {
  const browser = startProcess(registry, {
    name: 'firefox',
    command: executable,
    args: [
      '--headless',
      '--no-remote',
      '--profile',
      profileDir,
      '--remote-debugging-port',
      '0',
      'about:blank',
    ],
    env,
    stdoutPath: logPath,
  });
  const [, ws, port] = await browser.waitForOutput(
    /WebDriver BiDi listening on (ws:\/\/127\.0\.0\.1:(\d+))/,
    startupTimeoutMs,
    'WebDriver BiDi listening line',
  );
  // Firefox records the chosen port in this job's private profile; agreement
  // with the printed line proves the endpoint is ours.
  const recorded = await pollUntil(
    async () =>
      JSON.parse(
        await readFile(join(profileDir, 'WebDriverBiDiServer.json'), 'utf8'),
      ),
    {
      timeoutMs: startupTimeoutMs,
      watch: [browser],
      description: 'WebDriverBiDiServer.json in the job profile',
    },
  );
  if (String(recorded.ws_port) !== port) {
    throw new SetupError(
      `Firefox profile records BiDi port ${recorded.ws_port}, output said ${port}`,
    );
  }
  const session = `${ws}/session`;
  // session.status without session.new leaves the single BiDi session slot
  // free for the driver, which creates and ends its own session.
  await pollUntil(
    async () => (await bidiStatus(session, 2000))?.ready === true,
    {
      timeoutMs: startupTimeoutMs,
      watch: [browser],
      description: 'ready Firefox BiDi session endpoint',
    },
  );
  return {
    process: browser,
    env: { CHANT_FIREFOX_URL: session },
    endpoint: session,
    version: null,
  };
}

export async function startViteServer(
  registry,
  { mode, repoRoot, cacheDir, outDir, logPath, startupTimeoutMs, env },
) {
  const args = [
    join(HERE, 'vite-server.mjs'),
    '--mode',
    mode,
    '--root',
    repoRoot,
  ];
  if (cacheDir) args.push('--cache-dir', cacheDir);
  if (outDir) args.push('--out-dir', outDir);
  const server = startProcess(registry, {
    name: `vite ${mode}`,
    command: process.execPath,
    args,
    cwd: repoRoot,
    env,
    stdoutPath: logPath,
  });
  const [, json] = await server.waitForOutput(
    new RegExp(`${READY_PREFIX}(\\{.*\\})`),
    startupTimeoutMs,
    'Vite ready line',
  );
  const { url, pid } = JSON.parse(json);
  if (pid !== server.pid) {
    throw new SetupError(
      `Vite ready line came from pid ${pid}, expected ${server.pid}`,
    );
  }
  // The dev probe checks the fixture's own title: Vite's SPA fallback would
  // answer 200 with index.html for a missing fixture.
  const probe = mode === 'dev' ? `${url}${FIXTURE_PATH}` : `${url}/`;
  const marker = mode === 'dev' ? FIXTURE_TITLE : 'id="root"';
  await pollUntil(
    async () => {
      const response = await fetchWithTimeout(probe);
      const body = await response.text();
      if (!response.ok || !body.includes(marker)) {
        throw new SetupError(`HTTP ${response.status} without '${marker}'`);
      }
      return true;
    },
    {
      timeoutMs: startupTimeoutMs,
      watch: [server],
      description: `Vite ${mode} at ${probe}`,
    },
  );
  return mode === 'dev'
    ? { process: server, origin: url, env: { CHANT_EDITOR_URL: url } }
    : { process: server, origin: url, env: { CHANT_PREVIEW_URL: `${url}/` } };
}

export async function runViteBuild(
  registry,
  { repoRoot, outDir, logPath, timeoutMs, env },
) {
  const build = startProcess(registry, {
    name: 'vite build',
    command: process.execPath,
    args: [
      join(HERE, 'vite-server.mjs'),
      '--mode',
      'build',
      '--root',
      repoRoot,
      '--out-dir',
      outDir,
    ],
    cwd: repoRoot,
    env,
    stdoutPath: logPath,
  });
  const timer = new Promise((resolve) =>
    setTimeout(() => resolve('timeout'), timeoutMs).unref(),
  );
  const result = await Promise.race([build.exited, timer]);
  if (result === 'timeout') {
    await build.stop();
    throw new SetupError(`vite build exceeded ${timeoutMs} ms`);
  }
  await build.stop();
  if (result.code !== 0)
    throw new SetupError(build.describeExit().replace('early ', ''));
}
