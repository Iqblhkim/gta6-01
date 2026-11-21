// Kota Seja — Golden Hour Pursuit (make.fun gta6-01, entry r19).
// main.ts: packages game/ + screenshots/ into the output directory and
// writes dossier.json with buildDossier from vendor/makefun-game.ts.
// With --capture it first takes the 4 screenshots with headless Chrome
// over CDP (a minimal WebSocket client, standard library only).
// Without --capture it packages what is already in screenshots/.
// Node 22, standard library only. No network beyond localhost.
import { buildDossier } from './vendor/makefun-game.ts';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const SHOTS = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8')).shots;
const CHROME = process.env.CHROME_PATH || join(process.env.HOME || '', '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const HTTP_PORT = 8130;
const CDP_PORT = 9333;

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, e.name), d = join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.isFile()) copyFileSync(s, d);
    else throw new Error(`refusing non-file entry: ${s}`);
  }
}
function sha256(p) { return createHash('sha256').update(readFileSync(p)).digest('hex'); }

function packageEntry() {
  const shotsDir = join(ROOT, 'screenshots');
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((f) => !f.startsWith('.') && statSync(join(shotsDir, f)).isFile()).sort()
    : [];
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`screenshots/: holds ${shots.length} images, need 3 or 4 (packageEntry refuses)`);
  }
  for (const f of shots) {
    const b = statSync(join(shotsDir, f)).size;
    if (b > 262144) throw new Error(`screenshots/${f}: ${b} bytes, over the 262144 cap`);
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  copyDir(join(ROOT, 'game'), join(OUT, 'game'));
  copyDir(shotsDir, join(OUT, 'screenshots'));
  writeFileSync(join(OUT, 'dossier.json'), buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }));
  console.log(`packaged ${shots.length} screenshots + game/ into ${OUT}`);
  for (const f of shots) console.log(`  ${f} ${statSync(join(shotsDir, f)).size} B sha256 ${sha256(join(shotsDir, f))}`);
  console.log(`  dossier.json ${statSync(join(OUT, 'dossier.json')).size} B sha256 ${sha256(join(OUT, 'dossier.json'))}`);
}

// ---- minimal WebSocket client for Chrome DevTools Protocol ----
function wsConnect(url) {
  return new Promise((resolveWs, reject) => {
    const m = /^ws:\/\/([^:/]+):(\d+)(\/.*)$/.exec(url);
    if (!m) return reject(new Error(`bad ws url ${url}`));
    const key = Buffer.from(createHash('sha256').update(String(Date.now())).digest()).toString('base64').slice(0, 24);
    const sock = createConnection(Number(m[2]), m[1], () => {
      sock.write(`GET ${m[3]} HTTP/1.1\r\nHost: ${m[1]}:${m[2]}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let buf = Buffer.alloc(0);
    let handshook = false;
    const handlers = new Map();
    let msgId = 0;
    const events = [];
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshook) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        handshook = true; buf = buf.subarray(idx + 4);
        resolveWs(api);
        return;
      }
      for (;;) {
        if (buf.length < 2) return;
        const op = buf[0] & 0x0f;
        let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) return;
        const payload = buf.subarray(off, off + len);
        buf = buf.subarray(off + len);
        if (op === 9) { // ping -> pong
          const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
          const head = Buffer.from([0x8a, 0x80 | payload.length]);
          const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
          sock.write(Buffer.concat([head, mask, masked]));
          continue;
        }
        if (op !== 1) continue;
        let msg;
        try { msg = JSON.parse(payload.toString('utf8')); } catch { continue; }
        if (msg.id !== undefined && handlers.has(msg.id)) {
          const h = handlers.get(msg.id); handlers.delete(msg.id);
          if (msg.error) h.reject(new Error(`CDP ${msg.method || ''}: ${JSON.stringify(msg.error)}`));
          else h.resolve(msg.result);
        } else if (msg.method) events.push(msg);
      }
    });
    sock.on('error', reject);
    function send(method, params = {}) {
      return new Promise((res, rej) => {
        const id = ++msgId;
        handlers.set(id, { resolve: res, reject: rej });
        const data = Buffer.from(JSON.stringify({ id, method, params }), 'utf8');
        const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
        let head;
        if (data.length < 126) head = Buffer.from([0x81, 0x80 | data.length]);
        else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0xfe; head.writeUInt16BE(data.length, 2); }
        else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 0xff; head.writeBigUInt64BE(BigInt(data.length), 2); }
        const masked = Buffer.from(data.map((b, i) => b ^ mask[i % 4]));
        sock.write(Buffer.concat([head, mask, masked]));
      });
    }
    const api = { send, events, close: () => sock.destroy() };
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
import { get as httpGet } from 'node:http';
async function httpJson(path, port) {
  return new Promise((resolveJson, reject) => {
    httpGet({ host: '127.0.0.1', port, path }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { try { resolveJson(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
async function waitFor(pred, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    try { if (await pred()) return; } catch { /* retry */ }
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await sleep(200);
  }
}

async function capture() {
  const shotsDir = join(ROOT, 'screenshots');
  mkdirSync(shotsDir, { recursive: true });
  // 1. Static server for game/.
  const server = spawn(process.execPath, [join(ROOT, 'serve.ts')], {
    env: { ...process.env, PORT: String(HTTP_PORT), GAME_DIR: join(ROOT, 'game') },
    stdio: 'inherit',
  });
  let chrome = null;
  try {
    await waitFor(async () => {
      const r = await fetch(`http://127.0.0.1:${HTTP_PORT}/index.html`);
      return r.ok;
    }, 10000, 'static server');
    // 2. Headless Chrome with CDP.
    chrome = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu',
      `--remote-debugging-port=${CDP_PORT}`,
      `--window-size=1280,720`, '--hide-scrollbars', 'about:blank',
    ], { stdio: 'ignore' });
    const targets = await new Promise((res, rej) => {
      const tryList = async () => {
        try {
          const list = await httpJson('/json/list', CDP_PORT);
          if (Array.isArray(list) && list.length) return res(list);
        } catch { /* not up yet */ }
        setTimeout(tryList, 300);
      };
      setTimeout(() => rej(new Error('chrome CDP never came up')), 20000);
      tryList();
    });
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target from chrome');
    const ws = await wsConnect(page.webSocketDebuggerUrl);
    try {
      await ws.send('Page.enable');
      await ws.send('Runtime.enable');
      await ws.send('Log.enable');
      await ws.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
      for (const [i, shotMeta] of SHOTS.entries()) {
        ws.events.length = 0;
        await ws.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.html?shot=${i + 1}` });
        await waitFor(async () => {
          const r = await ws.send('Runtime.evaluate', { expression: 'window.__sejaReady === true', returnByValue: true });
          return r.result && r.result.value === true;
        }, 15000, `__sejaReady for shot ${i + 1}`);
        await sleep(400);
        const bad = ws.events.filter((e) =>
          (e.method === 'Runtime.exceptionThrown') ||
          (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
          (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'));
        if (bad.length) throw new Error(`shot ${i + 1}: console/page errors: ${JSON.stringify(bad).slice(0, 600)}`);
        const shot = await ws.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
        const bytes = Buffer.from(shot.data, 'base64');
        if (bytes.length > 262144) throw new Error(`shot ${i + 1}: ${bytes.length} bytes, over the 262144 cap`);
        const file = join(shotsDir, shotMeta.file);
        writeFileSync(file, bytes);
        console.log(`shot ${i + 1} ${shotMeta.file} ${bytes.length} B sha256 ${createHash('sha256').update(bytes).digest('hex')}`);
      }
    } finally { ws.close(); }
  } finally {
    if (chrome) chrome.kill();
    server.kill();
  }
}

const args = process.argv.slice(2);
if (args.includes('--capture')) await capture();
packageEntry();
