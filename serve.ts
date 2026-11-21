// Kota Seja — tiny static file server for game/ (used by capture).
// Node 22, standard library only. Serves the directory named by
// GAME_DIR (default: ./game next to this file) on PORT (default 8130).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.GAME_DIR || join(dirname(fileURLToPath(import.meta.url)), 'game');
const port = Number(process.env.PORT || 8130);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const path = join(root, url === '/' ? 'index.html' : url);
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(path));
});
server.listen(port, '127.0.0.1', () => {
  console.log(`kota-seja serve: http://127.0.0.1:${port}/ serving ${root}`);
});
