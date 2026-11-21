[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iqblhkim/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iqblhkim/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Kota Seja — Golden Hour Pursuit

An open-world crime game in the spirit of GTA 6, built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). One island, four
districts, eight jobs. Rico Vega owes $50,000 to the Azura syndicate — steal
cars, outrun the SBPD, and take back Kota Seja before the sun sets for the
last time.

The game is a plain 2D-canvas game with no build step and no network
requests: every script, image and sound it needs is a file under `game/`.
Open `game/index.html` in desktop Chrome and play with keyboard and mouse.

## What is in the game

- **A city to explore** — Palmera Strand, Pelabuhan, Neon Strip, Marina,
  Bukit Halcyon and Taman Senja, with a beach road, shopfronts, palms,
  pedestrians and traffic.
- **Driving and carjacking** — walk up to a car, press E, drive; the camera,
  speedometer, car condition and radio follow.
- **Police who respond** — a wanted level from 1 to 5 stars, an SBPD dispatch
  list with named units and roles, pursuit cars, roadblocks and a helicopter
  with a spotlight.
- **Missions and a story** — five story chapters with stages, progress bars
  and next objectives, plus side jobs, cash, ranks and RP.
- **Combat and crew** — five weapon slots, three crew abilities on Z/X/V,
  and the Azura crew to fight on foot.
- **Systems** — a full map screen with career stats, district standings and
  a garage, save slots, pause, radio stations and dialogue.
- **HUD** — cash and clock, mission header, dispatch list, toasts, rank and
  wanted stars, weapons, crew, district name, round minimap, health and
  armor, dialogue box and a big speedometer.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| E | Enter or exit a car |
| Space | Attack / fire |
| 1–5 | Switch weapon |
| Z / X / V | Crew abilities |
| M | Map and garage |
| S | Save game (from map or pause) |
| P / Esc | Pause |

## Play it

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. `serve.ts` is a small
static server for `game/` only; any static server works the same way.

## Screenshots

Four deterministic captures live in `screenshots/` — a beach chase with the
helicopter, an on-foot fight with the Azura crew, the map and career screen,
and the title screen. Their staging is described in `shots.json`.

Regenerate them (headless Chrome, deterministic — two runs produce identical
bytes):

```sh
node main.ts --capture
```

## Handing the entry in

`main.ts` is the entry program: it copies `game/` and `screenshots/` into
the output directory and writes `dossier.json` there with the kit's
`buildDossier` from `vendor/makefun-game.ts`.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The output holds exactly `game/`, `screenshots/` and `dossier.json`. The
dossier is byte for byte what `buildDossier` writes from those two
directories, so any rebuild of the same files produces the same dossier.

## Layout

```text
main.ts            entry program: capture (with --capture) + package to output
serve.ts           static server for game/
shots.json         metadata for the four screenshots
game/index.html    page, HUD chrome and screens
game/src/hint.js   static data: missions, crew, weapons, radio, dialogue
game/src/shots.js  deterministic staging for ?shot=1..4
game/src/game.js   renderer, world, HUD, input and live play
game/vendor/       vendored libraries (three.min.js, unused by this build)
screenshots/       1-chase.jpg, 2-onfoot.jpg, 3-map.jpg, 4-title.jpg
vendor/            the kit's makefun-game.ts (unchanged)
```

## License

MIT — see `LICENSE`.
