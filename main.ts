// KOTA SEJA 3D — a working gta6-01 entry (Node 22+, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, Three.js vendored
// under game/vendor/, no CDN and no network request at runtime). This program
// hands it in: it copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with
// the vendored make.fun library.
//
// The game itself: a 3D open-world crime game in the sunset city of Kota Seja.
// Rico Vega owes $50,000. Third-person camera, low-poly Miami-Vice streets,
// 4 districts, 8 two-stage missions, 40+ stealable cars, side quests
// (10 hidden packages, 3 stunt jumps, taxi fares), wanted levels 1-5 with
// foot and car police, 4 weapons (fists / pistol / SMG / shotgun), health +
// armour + respect, a round minimap, a mission tracker, day/night clock,
// save/continue via localStorage, and title / pause / map / busted / wasted
// screens. Everything procedural and deterministic (seeded RNG).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Pre-flight: the judge refuses an entry with a missing or oversized
// screenshot, so fail loudly here instead of handing in a dead dossier.
const shotNames = ['1-start.jpg', '2-drive.jpg', '3-chase.jpg', '4-mission.jpg'];
for (const name of shotNames) {
  const p = join(here, 'screenshots', name);
  if (!existsSync(p)) throw new Error(`missing screenshot: screenshots/${name} (run node tools/shots.mjs first)`);
  const { size } = statSync(p);
  if (size > 262144) throw new Error(`screenshot over 256 KiB: screenshots/${name} is ${size} B`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Build summary on stdout so the hand-in log shows exactly what was sent.
{
  const sizes = shotNames.map((n) => `${n}=${(statSync(join(out, 'screenshots', n)).size / 1024).toFixed(1)} KiB`).join(' ');
  console.log(`KOTA SEJA 3D handed in: ${sizes}`);
}
