// Kota Seja — Halcyon Edition (round 9): a tiny static file server for game/.
// Run `node serve.ts` (or `node serve.ts --port 9000`) and open the printed
// address. Node 22 standard library only — no dependencies, no build step.
// It only ever serves files under game/, refuses anything outside that
// directory, and answers 404 for anything that is not a plain file.
// This is a local development convenience, not a production web server.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The directory served: game/ next to this file, resolved once at startup.
const GAME_ROOT = resolve(fileURLToPath(new URL('./game', import.meta.url)));

// A --port <n> argument overrides the default; anything invalid falls
// back to 8080 instead of crashing the server.
function pickPort(argv) {
  const at = argv.indexOf('--port');
  const wanted = at === -1 ? NaN : Number(argv[at + 1]);
  return Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;
}

// Content types a browser game needs. Anything unlisted is served as a
// generic byte stream rather than refused — the game has no such files,
// but a stray asset should still download instead of erroring.
const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.bin', 'application/octet-stream'],
  ['.wasm', 'application/wasm'],
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function contentTypeFor(file) {
  return CONTENT_TYPES.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
}

// Maps a request path to a file under GAME_ROOT, or null when the path
// would escape the game directory (directory traversal attempt).
function fileForRequest(requestPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const resolved = resolve(join(GAME_ROOT, normalize(pathname)));
  if (resolved !== GAME_ROOT && !resolved.startsWith(GAME_ROOT + sep)) return null;
  return resolved;
}

const port = pickPort(process.argv.slice(2));

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const file = fileForRequest(url.pathname);
  if (file === null) {
    response.writeHead(400).end('bad request');
    return;
  }
  let bytes;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    bytes = info.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': contentTypeFor(file),
    'content-length': bytes,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Kota Seja (Halcyon) is on http://localhost:${port}`);
});
