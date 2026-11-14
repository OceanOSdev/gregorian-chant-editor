// Runner-owned Vite child: `dev`, `preview` or `build` using the repository's
// own vite.config.ts (unchanged base and plugins). Only the loopback host,
// a dedicated port, a job-private dependency cache and the run-private
// output directory are overridden.
//
// Usage (spawned by the runner with an argument array):
//   node vite-server.mjs --mode dev|preview|build --root <repo>
//        [--cache-dir <dir>] [--out-dir <dir>] [--port <n>]
//
// dev/preview print one line `CHANT_RUNNER_SERVER_READY {"url":...}` after
// this process itself has bound the port, then serve until SIGTERM/SIGINT.
import { createServer as createNetServer } from 'node:net';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { build, createServer, preview } from 'vite';

const READY_PREFIX = 'CHANT_RUNNER_SERVER_READY ';

// Ports Firefox (and Chromium) refuse to load over HTTP. Ephemeral ports never
// fall in this list on Linux, but check rather than assume.
const BROWSER_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6679, 6697, 10080,
]);

const isBrowserSafePort = (port) =>
  port >= 1024 && !BROWSER_BLOCKED_PORTS.has(port);

const HOST = '127.0.0.1';

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen({ host: HOST, port: 0, exclusive: true }, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function startServer(mode, { root, cacheDir, outDir, port }) {
  const configFile = join(root, 'vite.config.ts');
  const common = {
    configFile,
    root,
    clearScreen: false,
    logLevel: 'info',
  };
  if (mode === 'dev') {
    const server = await createServer({
      ...common,
      cacheDir,
      server: { host: HOST, port, strictPort: true, watch: null },
    });
    await server.listen();
    return {
      address: server.httpServer.address(),
      close: () => server.close(),
    };
  }
  const server = await preview({
    ...common,
    build: { outDir },
    preview: { host: HOST, port, strictPort: true, open: false },
  });
  return {
    address: server.httpServer.address(),
    close: () => server.close(),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string' },
      root: { type: 'string' },
      'cache-dir': { type: 'string' },
      'out-dir': { type: 'string' },
      port: { type: 'string' },
    },
    strict: true,
  });
  const { mode, root } = values;
  if (!['dev', 'preview', 'build'].includes(mode) || !root) {
    throw Error('Usage: --mode dev|preview|build --root <repo>');
  }
  if (mode === 'build') {
    await build({
      configFile: join(root, 'vite.config.ts'),
      root,
      clearScreen: false,
      build: { outDir: values['out-dir'], emptyOutDir: true },
    });
    return;
  }
  const requestedPort = values.port === undefined ? null : Number(values.port);
  if (requestedPort !== null && !isBrowserSafePort(requestedPort)) {
    throw Error(`Port ${requestedPort} is blocked by browsers or privileged`);
  }
  let server;
  for (let attempt = 1; !server; attempt++) {
    let port = requestedPort ?? (await freePort());
    while (!isBrowserSafePort(port)) port = await freePort();
    try {
      server = await startServer(mode, {
        root,
        cacheDir: values['cache-dir'],
        outDir: values['out-dir'],
        port,
      });
    } catch (error) {
      // strictPort: another process took the port. Retry only with a fresh
      // port the OS just reported free; an explicit --port never retries.
      const inUse = /already in use|EADDRINUSE/.test(String(error?.message));
      if (!inUse || requestedPort !== null || attempt >= 5) throw error;
      console.error(`Port ${port} was taken before Vite bound it; retrying`);
    }
  }
  const { address, port } = server.address;
  const url = `http://${address}:${port}`;
  console.log(
    READY_PREFIX + JSON.stringify({ mode, url, port, pid: process.pid }),
  );
  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exit(1);
});
