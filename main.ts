// Kota Seja — Halcyon Edition (round 9): entry program for the make.fun
// gta6-01 bounty. It copies game/ and screenshots/ from this repository
// into the output directory (MAKEFUN_OUTPUT_DIR, default '/output') and
// writes /output/dossier.json with buildDossier from the vendored
// library in vendor/makefun-game.ts. Node 22 standard library only:
// node:fs, node:path, node:url. No build step, no install.
//
// Round 9 (2026-11-19): the Halcyon Three.js city replaces the plain
// raw-WebGL round 8 entry. The entrypoint keeps the two hard lessons
// from rounds 7–8: (1) /output on the grader is a Docker bind mount,
// so the program must NEVER remove the output directory itself —
// mkdir it, then delete only its CONTENTS (rmdir on a mount point
// throws EBUSY and fails run_completes); (2) the files the kit counts
// for transcripts_witnessed are verified present before any copying,
// so a missing file fails the build loudly here instead of failing the
// check after a submit.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Every file this round-9 session wrote with the write/edit tools, and
// therefore the kit can count for transcripts_witnessed. Copied files
// (LICENSE, vendor/makefun-game.ts, game/vendor/three.min.js) are not
// listed: the license and the minified Three.js are excluded by the kit
// rules, and the vendored library is a kit file, not session work.
const COUNTED = [
  'README.md',
  'game/index.html',
  'game/package.json',
  'game/src/game.js',
  'game/src/hint.js',
  'game/src/shots.js',
  'main.ts',
  'serve.ts',
  'shots.json',
];

// The entry caps from the bounty kit: screenshots at most 4 files of at
// most 256 KiB each, the game at most 993 files / 48 MiB, text files at
// most 160 KiB, and the dossier itself at most 1.5 MiB.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function failIfCountedMissing() {
  const missing = COUNTED.filter((f) => !existsSync(join(REPO_ROOT, f)));
  if (missing.length > 0) {
    throw new Error('counted files missing from ' + REPO_ROOT + ': ' + missing.join(', '));
  }
}

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
    // Anything else (symlinks, sockets, devices) is skipped on purpose:
    // the game must be plain files and directories only.
  }
}

function totalBytes(dir) {
  let sum = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sum += totalBytes(full);
    else if (entry.isFile()) sum += statSync(full).size;
  }
  return sum;
}

// Empty the output directory WITHOUT removing the directory itself.
// See the header comment: on the grader /output is a bind mount and
// rmdir on a mount point throws EBUSY (round 7's run_completes failure).
function emptyOutputDir() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const entry of readdirSync(OUTPUT_DIR)) {
    rmSync(join(OUTPUT_DIR, entry), { recursive: true, force: true });
  }
}

function main() {
  failIfCountedMissing();
  const gameDir = join(REPO_ROOT, 'game');
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (!statSync(gameDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('game/ is missing from ' + REPO_ROOT);
  }
  if (!statSync(shotsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('screenshots/ is missing from ' + REPO_ROOT);
  }
  emptyOutputDir();
  copyTree(gameDir, join(OUTPUT_DIR, 'game'));
  copyTree(shotsDir, join(OUTPUT_DIR, 'screenshots'));
  const dossier = buildDossier(OUTPUT_DIR, CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
  // Fail loudly here, before anyone submits, if a cap is breached: the
  // gate would refuse the entry anyway, and a silent oversize dossier
  // is worse than a failed build.
  const gameBytes = totalBytes(join(OUTPUT_DIR, 'game'));
  if (gameBytes > CAPS.game_max_bytes) {
    throw new Error('game/ is ' + gameBytes + ' bytes, over the ' + CAPS.game_max_bytes + ' cap');
  }
  if (dossier.length > 1572864) {
    throw new Error('dossier.json is ' + dossier.length + ' bytes, over the 1.5 MiB cap');
  }
  console.log('Kota Seja — Halcyon Edition handed in: game ' + gameBytes + ' bytes, dossier ' + dossier.length + ' bytes -> ' + OUTPUT_DIR);
}

main();
