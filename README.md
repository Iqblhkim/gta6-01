[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iqblhkim/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iqblhkim/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Kota Seja — Golden Hour Pursuit

An original open-world crime game for make.fun gta6-01: Rico Vega takes back the island city of Kota Seja at golden hour. A hand-written software 3D renderer (perspective projection, painter's algorithm, flat dusk shading — no WebGL, no libraries) draws the beach boulevard, lit towers, palms, traffic, police chases and a searchlight heli. Drive, walk, steal cars, dodge the KSPD, run 12 story missions and side jobs, with a dense HUD, minimap, crew abilities and a full island map.

## Run

```sh
node serve.ts        # serves game/ at http://127.0.0.1:8130/
```

Open the page, click or press Enter to play. WASD drive/walk, mouse drag to look, E enter/steal a car, SPACE handbrake, Q/E/R crew abilities, M map, ESC pause. Progress auto-saves. Steal the blue coupe on Palm Row to start the crew missions; speeding with the KSPD on your tail raises your wanted level.

## Capture + package

```sh
MAKEFUN_OUTPUT_DIR=/tmp/gta-r19-out node main.ts --capture
```

Referral: https://make.fun/r/5qd1v7g7
