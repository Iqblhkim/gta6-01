// main.ts — the entry program for Kota Seja (make.fun bounty gta6-01).
//
// Two jobs, in this order when asked:
//
//   1. --capture: play the game headless in desktop Chrome, take the four
//      deterministic screenshots into screenshots/ (see shots.json). This
//      is a local step only: it needs Chrome and a browser, which the
//      grading sandbox does not have, so it never runs there.
//   2. package (always): copy game/ and screenshots/ into the output
//      directory and write dossier.json there with the kit's buildDossier
//      from vendor/makefun-game.ts, byte for byte what the scorer rebuilds.
//
// Run it the way the kit shows:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   node main.ts --capture          (local only; then package as above)
//
// With no MAKEFUN_OUTPUT_DIR the output directory is /output, the grader's
// writable directory. Standard library only; Node 22 or newer runs this
// file as-is, no flags, no build, no install.

import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const shotNames = ['chase', 'onfoot', 'map', 'title'];
const shotLimitBytes = 262144;

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

const sha256 = (bytes: Buffer | Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

// ---------------------------------------------------------------- packaging

function copyTree(from: string, to: string): number {
  // Plain files and directories only: a link is refused rather than followed.
  let files = 0;
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).sort()) {
    const src = join(from, name);
    const dst = join(to, name);
    const st = lstatSync(src);
    if (st.isSymbolicLink()) throw new Error(`refusing to copy a link: ${src}`);
    if (st.isDirectory()) {
      files += copyTree(src, dst);
    } else if (st.isFile()) {
      copyFileSync(src, dst);
      files += 1;
    } else {
      throw new Error(`refusing a special file: ${src}`);
    }
  }
  return files;
}

function packageEntry(): void {
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    throw new Error(`no game/ directory at ${gameDir}`);
  }
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort()
    : [];
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
  }
  rmSync(outDir, { recursive: true, force: true });
  const gameFiles = copyTree(gameDir, join(outDir, 'game'));
  const shotFiles = copyTree(shotsDir, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, dossierCaps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(
    `packaged: game/ ${gameFiles} files, screenshots/ ${shotFiles} files, ` +
      `dossier.json ${dossier.length} bytes sha256 ${sha256(dossier).slice(0, 16)}…`,
  );
  console.log(`output: ${outDir}`);
}

// ------------------------------------------------------------------ capturing

const httpPort = 8130;
const cdpPort = 9333;
const chromePath =
  process.env.CHROME_PATH ??
  join(homedir(), '.cache', 'ms-playwright', 'chromium-1255', 'chrome-linux64', 'chrome');
const chromeProfile = join(tmpdir(), 'seja-r16-chrome');

type CdpEvent = { method: string; params?: Record<string, any> };

class Cdp {
  private ws: WebSocket;
  private nextId = 0;
  private waiting = new Map<number, (msg: any) => void>();
  readonly events: CdpEvent[] = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (typeof msg.id === 'number' && this.waiting.has(msg.id)) {
        this.waiting.get(msg.id)!(msg);
        this.waiting.delete(msg.id);
      } else if (typeof msg.method === 'string') {
        this.events.push(msg as CdpEvent);
      }
    });
  }

  static async open(url: string): Promise<Cdp> {
    const ws = new WebSocket(url);
    await new Promise<void>((done, fail) => {
      ws.addEventListener('open', () => done());
      ws.addEventListener('error', () => fail(new Error('CDP websocket failed to open')));
    });
    return new Cdp(ws);
  }

  call(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.nextId;
    return new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`CDP ${method} timed out`)), 30000);
      this.waiting.set(id, (msg) => {
        clearTimeout(timer);
        if (msg.error) fail(new Error(`CDP ${method}: ${JSON.stringify(msg.error)}`));
        else done(msg.result ?? {});
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression: string): Promise<unknown> {
    const r = await this.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(`evaluate failed: ${JSON.stringify(r.exceptionDetails)}`);
    return r.result?.value;
  }

  consoleErrors(): string[] {
    return this.events
      .filter(
        (e) =>
          e.method === 'Runtime.exceptionThrown' ||
          (e.method === 'Runtime.consoleAPICalled' && e.params?.type === 'error'),
      )
      .map((e) => JSON.stringify(e).slice(0, 300));
  }

  close(): void {
    this.ws.close();
  }
}

async function waitForHttp(url: string, tries = 50): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error(`server never answered at ${url}`);
}

async function waitForCdp(url: string, tries = 50): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      const info = (await r.json()) as { webSocketDebuggerUrl?: string };
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error(`Chrome devtools never answered at ${url}`);
}

async function captureAll(): Promise<void> {
  if (!existsSync(chromePath)) throw new Error(`no Chrome at ${chromePath}`);
  let server: ChildProcess | null = null;
  let chrome: ChildProcess | null = null;
  try {
    server = spawn(process.execPath, [join(repoRoot, 'serve.ts'), String(httpPort)], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    await waitForHttp(`http://127.0.0.1:${httpPort}/index.html`);
    chrome = spawn(chromePath, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${chromeProfile}`,
      'about:blank',
    ], { stdio: 'ignore' });
    await waitForCdp(`http://127.0.0.1:${cdpPort}/json/version`);
    const list = (await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()) as Array<{
      type?: string;
      webSocketDebuggerUrl?: string;
    }>;
    const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page?.webSocketDebuggerUrl) throw new Error('no page target in Chrome');
    const cdp = await Cdp.open(page.webSocketDebuggerUrl);
    try {
      await cdp.call('Runtime.enable');
      await cdp.call('Page.enable');
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false,
      });
      mkdirSync(shotsDir, { recursive: true });
      for (let n = 1; n <= 4; n++) {
        cdp.events.length = 0;
        await cdp.call('Page.navigate', {
          url: `http://127.0.0.1:${httpPort}/index.html?shot=${n}`,
        });
        let ready = false;
        for (let i = 0; i < 60; i++) {
          await sleep(150);
          try {
            ready = (await cdp.evaluate('window.__sejaReady === true')) === true;
          } catch {
            // page still loading
          }
          if (ready) break;
        }
        if (!ready) throw new Error(`shot ${n}: __sejaReady never became true`);
        await sleep(400);
        const problems = cdp.consoleErrors();
        if (problems.length > 0) {
          throw new Error(`shot ${n}: console errors:\n${problems.join('\n')}`);
        }
        const shot = await cdp.call('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 80,
        });
        const bytes = Buffer.from(String(shot.data), 'base64');
        if (bytes.length > shotLimitBytes) {
          throw new Error(`shot ${n}: ${bytes.length} bytes, over the ${shotLimitBytes} limit`);
        }
        const file = join(shotsDir, `${n}-${shotNames[n - 1]}.jpg`);
        writeFileSync(file, bytes);
        console.log(`shot ${n}: ${basename(file)} ${bytes.length} bytes sha256 ${sha256(bytes)}`);
      }
    } finally {
      cdp.close();
    }
  } finally {
    chrome?.kill();
    server?.kill();
  }
}

// ------------------------------------------------------------------------ run

const capture = process.argv.includes('--capture');
try {
  if (capture) await captureAll();
  packageEntry();
} catch (err) {
  console.error(`main.ts: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
