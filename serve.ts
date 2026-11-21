// serve.ts — a tiny static file server for the Kota Seja game.
//
// Serves the game/ directory next to this file so the game can be played in
// desktop Chrome exactly as the finalist review plays it: plain files over
// HTTP, nothing else. Standard library only; run it with plain `node`:
//
//   node serve.ts            serves on http://localhost:8080
//   PORT=8130 node serve.ts  serves on http://localhost:8130
//
// Pass the port as the first argument instead of the environment when that
// reads better: `node serve.ts 8130`.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const gameRoot = join(here, 'game');

const byExtension: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
};

function fileFor(requestPath: string): string | null {
  // Keep every answer inside game/, whatever the URL asks for.
  const cleaned = decodeURIComponent(requestPath).split('?')[0].split('#')[0];
  const rel = cleaned.replace(/^\/+/, '') || 'index.html';
  const full = resolve(join(gameRoot, rel));
  if (full !== gameRoot && !full.startsWith(gameRoot + sep)) return null;
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return full;
}

const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  console.error(`serve.ts: not a port: ${process.argv[2] ?? process.env.PORT}`);
  process.exit(2);
}

const server = createServer((req, res) => {
  const path = req.url ?? '/';
  const file = fileFor(path);
  if (file === null) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  const type = byExtension[extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Kota Seja served at http://localhost:${port}/`);
});
