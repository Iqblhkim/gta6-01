# Kota Seja — Open-World Crime

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Iqblhkim/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/Iqblhkim/gta6-01/reward.svg)

An original open-world crime game built for the
[make.fun gta6-01 bounty](https://make.fun/competitions/gta6-01):
a sun-soaked island city at sunset, a hero in debt, cars to steal,
police to outrun, and eight story missions to take the city back.

## The story

Rico Vega owes **$50,000** to the wrong people. One island, four
districts — Downtown, Old Quarter, Beachfront and Harbour — eight jobs,
and a sunset that never quite ends. Steal cars, outrun the police, and
become the King of Solano.

## The city

- A deterministic procedural island city on a 9×7 block grid: ~100
  low-poly pastel buildings, sidewalks, crosswalks, traffic lights,
  palm trees, a beach and a working harbour — the same city every load.
- 40+ cars (sedans, taxis, vans, sports cars, trucks) parked and in
  traffic, 48 pedestrians crossing at the crosswalks and fleeing
  gunfire, and a full day/night clock that starts at sunset, 17:40
  and keeps running through morning, noon, dusk and night.

## Playing

- **WASD** walk / drive · **Mouse** look (click to lock) · **SHIFT** run
- **SPACE** jump · **E = A** context action: MASUK car · KELUAR car ·
  AMBIL package · MULAI mission · SERANG enemy — the label on the big
  A button always shows what it will do right now
- **F = B** TEMBAK on foot · KLAKSON in a car · **H** horn (in a car) ·
  **C** camera chase / top-down · **L** headlights auto / on / off
- **Left click** shoot · **Right click** aim · **1–4** weapons · **R** reload
- **M** full map (click to set a waypoint) · **N** radio station
  (Seja FM → Seja Pop → Seja Malam → off) · **ESC** pause
- **Touch (phone):** virtual joystick to walk / drive, drag the screen to
  look, two **big A / B buttons** bottom right, **SENJATA** to cycle
  weapons (owned only), **MISI** for the mission objective + distance +
  waypoint, **LARI** toggle (tap = run, tap again = walk, active lights
  up green), **REM** handbrake (only while driving), **LAMPU** headlights
  (only while driving, same slot as LARI), **PETA** map, **JEDA** pause,
  **SUARA** sound, **STASIUN** radio station, **KAMERA** top-down view.
  Every button answers with a sound and a HUD message, even when the
  action itself cannot run. No two buttons do the same job, and nothing
  overlaps on a phone in landscape or portrait.
- Stealing a car, shooting, or hitting a pedestrian raises your wanted
  level (1–5 stars). Foot police and patrol cars chase you; hide out
  and the heat cools down. Get caught and you are **BUSTED**; get shot
  down and you are **WASTED**.
- Four weapons (fists, pistol, SMG, shotgun), health and armour bars,
  a respect level, health/armour pickups, 10 hidden packages, 3 stunt
  jumps, and taxi fares for extra cash.
- Eight story missions with two stages each, briefings and radio
  dialogue, autosave after every mission, and save/continue from the
  title screen.

## Tech

- Pure ES modules, zero libraries, zero network requests: a hand-written
  raw WebGL renderer (vertex-coloured low-poly boxes, gradient sunset
  sky, sun lighting, fog), procedural WebAudio sound effects and a
  procedural music loop.
- Play it locally: `node serve.ts`, then open http://localhost:8080
- Hand it in: `MAKEFUN_OUTPUT_DIR=out node main.ts`

## Round 7 (2026-11-19) — Halcyon upgrade + buildings + roads

- **Cinematic menu:** the title camera now sweeps the city on a slow
  48-second loop — busy intersection, landmark tower, beachfront,
  harbour — while the logo fades and rises in over the living city
  (traffic, pedestrians, swaying trees). NEW GAME / CONTINUE / CONTROLS
  stay, and entering the game fades through black.
- **Halcyon A/B controls:** two big buttons bottom right. **A** is the
  context action — MASUK near a car, KELUAR in a car, AMBIL near a
  package, MULAI near the hideout, SERANG near an enemy — and **B** is
  TEMBAK on foot / KLAKSON in a car. Keyboard: **E = A, F = B, H**
  horn, **C** camera, **L** lights. The old MOBIL and TEMBAK buttons
  are gone, LARI + JALAN are one toggle, and MUSIK became STASIUN.
  SENJATA, MISI, PETA and JEDA stay as small utility buttons; REM and
  LAMPU only appear while driving.
- **Top-down camera:** a high north-up view following the player or
  the car — **KAMERA** button (HUD + touch) or **C**. Saved with the
  game; the 360° chase camera stays the default.
- **Full day/night cycle:** the clock runs through morning (bright),
  noon, sunset (orange, 17:40 start) and night (dark + neon + stars +
  moon). Sky gradient, sun and moon, fog and ambient light change per
  phase; street lamps and windows light up automatically at night; the
  hour is saved and restored on Continue.
- **Three radio stations** (all procedural WebAudio, original patterns,
  no licensed music, no audio files): **Seja FM** (the round-6 funk,
  92 BPM), **Seja Pop** (118 BPM) and **Seja Malam** (slow, mellow,
  68 BPM). STASIUN button or **N** cycles 1→2→3→off→1; the station
  name shows in the HUD.
- **Horn & headlights:** **B** / **H** sounds a synthetic two-tone horn
  and pedestrians ahead step aside; **LAMPU** / **L** cycles auto → on
  → off, and auto switches the headlights (bright beams + light pools
  on the road) on at night.
- **Buildings per district:** Downtown apartments + blue-glass offices,
  Old Quarter ruko/shophouses with awnings, Beachfront hotels, Harbour
  warehouses, outskirts houses — each with its own silhouette, width,
  height and colour range, and a bolder skyline that steps down from
  the centre to the edges.
- **Roof details:** parapets, AC units, water tanks, antennas and
  chimneys vary per building; one landmark tower (Menara Seja, 58 m)
  with a helipad and a red beacon, marked with a gold star on the
  minimap and the full map.
- **Road markings + correct zebra:** dashed centre lines (yellow on
  avenues), edge lines, lane arrows and stop lines at intersections —
  and zebra crossings as the user asked: **many thin white parallel
  lines, close and even, spanning the full road width** (16 per
  crossing), not wide bars and not diagonal. All 80 crossings.
- **Sidewalks:** raised curbs along every road, paving a different
  colour from the asphalt, corner ramps at intersections; pedestrians
  walk on them, cars are not blocked.
- **Street props:** hydrants, traffic signs, bins, bus stops and 14
  benches (parks, wide sidewalks, beach edge), all placed on free
  spots only — never on a road, a zebra or through a building.
- **Grass & parks:** Taman Senja upgraded with lawn, flower patches,
  benches and trees; park ground is a distinct green from sidewalk
  and asphalt; trees and palms keep the road/zebra/building guards.
- **Shadows:** soft blob shadows under cars, pedestrians and Rico,
  plus sun shading that follows the sun through the day. No heavy
  shadow maps — phone performance stays.
- **Fog & sky per phase:** thin morning haze, clear noon, warm dusk,
  slightly dense night; a gradient sky with a moving sun and moon,
  stars at night and slow drifting clouds. Visibility stays playable.
- **Varied NPCs:** 48 pedestrians now mix skin colour, hair style and
  colour, tops, bottoms, glasses and bags, so they no longer look
  identical; a police officer (head + cap) is visible inside each
  police car. Animation and `userData` structure untouched.
- **Round 7 verified (2026-11-19):** unit tests 87/87, headless
  play-test 83/83, portrait 10/10, 0 console/page errors.

## Round 6 (2026-11-19) — phone feel + city life + shooting feel

- **Joystick steering fixed:** pushing the stick right steered LEFT
  (the stick's X fed straight into `car.steer`, whose sign is the
  keyboard's LEFT). The sign is flipped at the stick only — keyboard
  A/D and on-foot strafing are untouched and verified by play-test.
- **Camera turns a full 360°:** `cameraYaw` was never clamped, but the
  chase camera yanked the view back to the car's heading 1.2 s after
  any look. It now waits 5 s and only re-engages while the car moves.
- **Radio Kota Seja:** a procedural West-Coast hip-hop/funk groove
  (kick, snare, hats, funk bass riff, synth stabs — all original, no
  samples, no licensed music). Starts on the first gesture, MUSIK
  button (HUD + touch) and **N** toggle it. (M stays the map.)
- **Red enterable-car marker:** a pulsing red beam + spinning diamond
  above the nearest car within 5 m on foot; gone when you drive away
  or get in.
- **Rico Vega rebuilt:** slimmer two-segment limbs with knee/elbow
  bends, Hawaiian shirt with flower print, shorts, shoes, hair, eyes,
  breathing at idle, lean into a run, shooting arm snaps out on recoil.
- **LARI / JALAN buttons** (touch): tap to run or walk; the active
  mode lights up green. Joystick still steers.
- **Facades:** every building has individual windows (about half lit
  warm at dusk), a ground-floor door, canopies and balconies on some —
  still one merged static buffer, no extra draw calls.
- **Trees:** round-crowned street trees (trunk + lumpy 3-box crown,
  varied height/size/shade) next to the Miami palms, whose fronds now
  fan out 5–7 ways from a curved trunk.
- **Shooting FX:** recoil pose, muzzle flash, a visible tracer per
  pellet to the impact point, impact sparks, and a small camera shake.
- **Palms off the road (bug fix):** 19 of 46 palms used to stand ON
  roads — worst on the beachfront road and its zebra crossings.
  Palms (like the street trees) are now only planted off every road
  and crosswalk, re-rolling rejected spots, so all 46 still stand —
  on sand, sidewalk, park or plaza, never on asphalt.
- **Billboards:** 7 big GTA-style ad boards on the main avenues
  (SEJA FM, SOLANO COLA, VEGA TACOS, SUNSET HOTEL, PALM SURF, NEON
  NIGHTS, KOTA SEJA) — all fictional brands, two posts + a bright
  panel facing traffic, merged into the static buffer.
- **Living title screen:** traffic rolls, pedestrians stroll, palm
  fronds and tree crowns sway in a shader breeze, and the camera
  orbits a busy intersection behind the menu — same city systems,
  no duplicated code, no police/missions on the menu. The sunset
  stays at 17:40 until you press NEW GAME. Menu unchanged.
- **Vegas neon (visual style only — no gambling):** hot pink / cyan /
  gold roof strips, corner tubes and glowing sign panels on many
  buildings (fictional venues: SEJA LIVE, PALM STAGE, DISCO SOL,
  CINE SEJA…), plus brighter street lamps. Still merged static
  geometry — no post-processing, no extra draw calls.
- **Title footer is phone-first:** "Touch controls on phone ·
  joystick + buttons · sound on for the full sunset vibe" — no more
  "Best on desktop Chrome · keyboard + mouse".
- **Round 6 verified (2026-11-19):** unit tests 48/48, headless
  play-test 44/44, portrait 5/5, 0 console/page errors.

## Round 5 (2026-11-19) — touch + driving fixes

- **Touch controls added** (the game shipped with none — on a phone only
  tap-to-shoot worked): joystick, look-drag, TEMBAK, SENJATA, MISI,
  MOBIL, REM handbrake, PETA, JEDA. The touch layer only shows while
  playing, never on the title screen.
- **SENJATA** cycles owned weapons only (locked SMG/Shotgun are skipped),
  with a HUD message, a sound and a weapon-line flash on every tap.
- **MISI** always answers: near the hideout it starts the mission, far
  away it shows the objective, the distance and sets a waypoint.
- **Spin bug fixed:** look deltas used to be re-applied every frame, so
  one drag spun the camera/character in circles forever. Each delta now
  turns the camera exactly once.
- **Driving:** analog steering with smoothing, punchy launch tapering to
  top speed, speed-sensitive turn rate, handbrake drift turns, and a
  chase camera that swings behind the car, pulls back and widens the FOV
  with speed. Traffic lights added at intersections.

## License

MIT — see [LICENSE](LICENSE).
