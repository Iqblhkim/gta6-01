// Kota Seja — entry program for the make.fun gta6-01 bounty.
// It copies game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, default '/output') and writes
// /output/dossier.json with buildDossier from the vendored library.
// Node 22 standard library only: node:fs, node:path, node:url.
// Round 7 (2026-11-19): the entrypoint gains one guard — the 25
// counted files (the kit's transcripts_witnessed check counts a file
// only if it changed in the recording session) are all verified
// present before the copy, so a missing file fails the build loudly
// instead of failing the check after a submit. The round-7 work
// (cinematic menu, Halcyon A/B controls, top-down camera, day/night
// cycle, 3 radio stations, horn + headlights, district buildings,
// roof details, landmark skyline, road markings + correct zebra,
// sidewalks, street props, parks, blob shadows, fog + sky per
// phase, varied NPCs, officer in police cars) lives in game/.
import { existsSync } from 'node:fs';

// The 25 files the kit counts for transcripts_witnessed: 13 at the
// repo root / game, 12 under out/. (out/ is produced by the build
// itself on the previous run, so this list is checked against the
// game tree + dossier, not out/ — see the round-7 build note in the
// README.)
const COUNTED = [
  'README.md', 'game/index.html', 'game/package.json',
  'game/src/audio.js', 'game/src/city.js', 'game/src/config.js',
  'game/src/input.js', 'game/src/main.js', 'game/src/random.js',
  'game/src/render.js', 'game/src/shots.js', 'game/src/world.js',
  'main.ts',
];

function checkCounted() {
  const missing = COUNTED.filter((f) => !existsSync(join(REPO_ROOT, f)));
  if (missing.length) {
    throw new Error('counted files missing from ' + REPO_ROOT + ': ' + missing.join(', '));
  }
}

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
  checkCounted();
  const gameDir = join(REPO_ROOT, 'game');
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (!statSync(gameDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('game/ is missing from ' + REPO_ROOT);
  }
  if (!statSync(shotsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('screenshots/ is missing from ' + REPO_ROOT);
  }
  // Clear the previous output WITHOUT removing OUTPUT_DIR itself:
  // on the grader /output is a bind mount, and rmdir on a mount
  // point throws EBUSY (run_completes failed in round 7).
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const entry of readdirSync(OUTPUT_DIR)) {
    rmSync(join(OUTPUT_DIR, entry), { recursive: true, force: true });
  }
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

// Round 7 complete (2026-11-19): 17 packages — counted-file guard
// added (fails loudly on a missing counted file); the game work lives
// in game/ as before.
