#!/usr/bin/env node
// Fake Chromium executable for runner tests; no real browser is involved.
// Behaviour comes from FAKE_CHROMIUM_MODE:
//   ok           serve /json/version and /json/list for its own browser ID
//   silent       print nothing and keep running (startup timeout)
//   exit         exit with code 7 immediately (early exit)
//   foreign:<p>  claim DevTools on port <p> owned by another process
// `--version` prints a version string like the real executable.
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

if (process.argv.includes('--version')) {
  console.log('Fake Chromium 1.0');
  process.exit(0);
}
const mode = process.env.FAKE_CHROMIUM_MODE ?? 'ok';
const id = randomUUID();
if (mode === 'exit') process.exit(7);
if (mode === 'silent') setInterval(() => {}, 1000);
else if (mode.startsWith('foreign:')) {
  const port = mode.slice('foreign:'.length);
  console.error(
    `DevTools listening on ws://127.0.0.1:${port}/devtools/browser/${id}`,
  );
  setInterval(() => {}, 1000);
} else {
  const server = createServer((request, response) => {
    const { port } = server.address();
    const body =
      request.url === '/json/version'
        ? {
            Browser: 'FakeChrome/1.0',
            webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/${id}`,
          }
        : [
            {
              type: 'page',
              webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/x`,
            },
          ];
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  });
  server.listen(0, '127.0.0.1', () => {
    console.error(
      `DevTools listening on ws://127.0.0.1:${server.address().port}/devtools/browser/${id}`,
    );
  });
}
