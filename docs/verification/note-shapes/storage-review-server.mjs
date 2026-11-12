import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

// Test-only same-origin server: an actual baseline v2 build and current v3 can
// share one disposable profile's cache without modifying either build or data.
const oldDist = process.argv[2];
if (!oldDist) throw Error('Supply the baseline v2 dist directory');
const port = Number(process.argv[3] ?? 4255);
const roots = [resolve('dist'), resolve(oldDist)];
const prefix = '/gregorian-chant-editor/';
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  try {
    let file, content;
    if (url.pathname === prefix) {
      file = 'index.html';
      content = await readFile(
        join(
          roots[
            ['v2', 'legacy'].includes(url.searchParams.get('build')) ? 1 : 0
          ],
          file,
        ),
      );
    } else if (
      url.pathname.startsWith(prefix + 'assets/') ||
      url.pathname.startsWith('/assets/')
    ) {
      file = basename(url.pathname);
      for (const root of roots) {
        try {
          content = await readFile(join(root, 'assets', file));
          break;
        } catch {
          /* Try the other read-only build. */
        }
      }
      if (!content) throw Error('Unknown asset');
    } else throw Error('Unknown path');
    response.setHeader(
      'Content-Type',
      file.endsWith('.html')
        ? 'text/html'
        : file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : 'application/octet-stream',
    );
    response.setHeader('Cache-Control', 'no-store');
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () =>
  process.stdout.write(
    `Disposable old/current comparison: http://127.0.0.1:${port}/gregorian-chant-editor/?build=current\n`,
  ),
);
