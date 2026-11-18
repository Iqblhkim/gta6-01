// Kota Seja — entry program for the make.fun gta6-01 bounty.
// It copies game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, default '/output') and writes
// /output/dossier.json with buildDossier from the vendored library.
// Node 22 standard library only: node:fs, node:path, node:url.
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const from = join(sourceDir, entry.name);
    const to = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    }
    // Anything else (symlinks, sockets) is skipped on purpose: the game
    // must be plain files and directories only.
  }
}

function dirBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) total += dirBytes(full);
    else if (entry.isFile()) total += statSync(full).size;
  }
  return total;
}

function main() {
  const gameDir = join(REPO_ROOT, 'game');
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (!statSync(gameDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('game/ is missing from ' + REPO_ROOT);
  }
  if (!statSync(shotsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('screenshots/ is missing from ' + REPO_ROOT);
  }
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  copyTree(gameDir, join(OUTPUT_DIR, 'game'));
  copyTree(shotsDir, join(OUTPUT_DIR, 'screenshots'));
  const dossier = buildDossier(OUTPUT_DIR, CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
  // Fail loudly here, before anyone submits, if a cap is breached:
  // the gate would refuse the entry anyway, and a silent oversize
  // dossier is worse than a failed build.
  const gameBytes = dirBytes(join(OUTPUT_DIR, 'game'));
  if (gameBytes > CAPS.game_max_bytes) {
    throw new Error('game/ is ' + gameBytes + ' bytes, over the ' + CAPS.game_max_bytes + ' cap');
  }
  if (dossier.length > 1572864) {
    throw new Error('dossier.json is ' + dossier.length + ' bytes, over the 1.5 MiB cap');
  }
  console.log('Kota Seja handed in: game ' + gameBytes + ' bytes, dossier ' + dossier.length + ' bytes -> ' + OUTPUT_DIR);
}

main();
