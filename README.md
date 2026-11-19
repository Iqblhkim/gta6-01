# Kota Seja — Halcyon Edition

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Iqblhkim/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/Iqblhkim/gta6-01/reward.svg)

An original open-world crime game built for the
[make.fun gta6-01 bounty](https://make.fun/competitions/gta6-01):
Rico Vega, $50,000 in debt to the Azura syndicate, one sunset island
city, and five story missions to take it back — rendered in Three.js
with a bright Halcyon look: palms, a yellow suspension bridge, black
asphalt, colourful buildings, neon at dusk and a full day/night cycle.

## The story

Rico Vega owes **$50,000** to the wrong people. One island, four
districts — Pelabuhan (harbour), Neon Strip, Marina and Bukit Halcyon —
five jobs, and a sunset that never quite ends. Steal cars, outrun the
police, and become free of the Azura syndicate before the sun sets for
the last time.

## The city

- A hand-built Three.js island city: colourful low-poly buildings with
  lit windows and neon signs, navy asphalt roads with thin zebra
  crossings, light-grey sidewalks with joint lines and clear kerbs, traffic lights, palm trees, parks, benches, a
  beach, a harbour and a yellow suspension bridge to the east.
- 14 traffic cars plus 3 police cruisers, 26 pedestrians who walk the
  sidewalks and flee gunfire, 2 decorative helicopters circling the
  skyline, drifting clouds and a gradient sky dome that runs from
  sunset orange through bright day to neon night.
- A day/night clock that starts at 11:30 in bright blue daylight, and keeps running:
  morning is bright and clear, noon is vivid, dusk is golden hour,
  night is dark with neon and stars.

## Playing

- **WASD / joystick** walk and drive (camera-relative) · **SHIFT / A**
  run and gas · **E** enter and exit cars, enter houses · **F** attack
- **Q** cycle owned weapons · **C** camera chase / top-down · **R**
  radio · **M** map (toggle) · **H** medkit · **T** nearest shop ·
  **Esc** pause · **Space** handbrake / drift
- **Y** or the 🚕 button: Taksi Seja — pick up passengers and drive
  them across town for fares and time bonuses. **P** or the 📸 button:
  photo mode — hides every HUD element so you can frame a clean shot,
  then save it as a PNG.
- **Touch (phone):** virtual joystick to walk and drive, drag the right
  side of the screen to orbit the camera 360°, big **A / B buttons**
  bottom right, **KELUAR** to leave a car, **MUNDUR** to reverse, plus
  floating **TOKO** and **MASUK RUMAH** buttons when you are near a
  shop or a house door.
- Five story missions with checkpoints, a 90-second delivery timer,
  a 3-star escape, an informant dialogue and a boss fight against
  Azura (6 henchmen, then the boss himself). Three repeatable side
  missions — courier, checkpoint race, bounty hunt — unlock after
  mission 2 and pay cash every time.
- Stealing a car, shooting, or hitting a pedestrian raises your wanted
  level (1–5 stars). Patrol cars chase you through the streets, foot
  police join at 2 stars, and at 4–5 stars there are roadblocks and a
  police helicopter whose spotlight keeps you visible. Hide behind
  buildings and the heat cools down; get caught and you pay a $200
  fine and retry from the checkpoint.
- **Toko Seja** sells weapons, ammo, medkits, cars (they wait in the
  garage south of spawn) and outfits. **Bengkel** repairs cars and
  **SPBU** refills fuel — cars have their own health and fuel, and a
  car at 0 health explodes. **Rumah Rico** and two neighbours' houses
  can be entered: walk to the green door marker and step inside.
- Autosave every 5 seconds and on pause, fail, mission complete and
  page hide; **CONTINUE** restores money, mission, position, inventory,
  the in-game clock, the radio station and even mid-boss-fight progress
  in mission 5.

## Tech

- Three.js r160 vendored in `game/vendor/three.min.js`, zero network
  requests, zero external fonts or assets: the whole game works
  offline from `game/index.html`.
- `game/src/game.js` is the game (single IIFE), `game/src/shots.js`
  holds the staged screenshot scenes (`?shot=start|drive|chase|boss`),
  `game/src/hint.js` drives the HOW TO PLAY scroll hint.
- Play it locally: `node serve.ts`, then open http://localhost:8080
- Hand it in: `MAKEFUN_OUTPUT_DIR=out node main.ts`

## Round 9 (2026-11-19) — Halcyon Edition resubmission

- **The Halcyon look, finally submitted:** the prettier Three.js city
  (palms, yellow bridge, black roads, colourful buildings, neon) that
  was never the submitted entry replaces the plain raw-WebGL round 8
  entry, whose screenshots looked empty — green ground and boxy
  buildings — at rank #3,119/6,062.
- **Golden-hour first impression:** the leaderboard's #1 entry wins on
  sunset light + neon and the most complete HUD, so screenshot 1 is
  staged at golden hour (clock 18.15, sunset + neon, full HUD) and
  shots 2–4 are bright daylight showing palms, the yellow bridge,
  black asphalt and colourful buildings.
- **Taksi Seja (new):** a fourth side activity — pick up passengers
  at cyan markers, drive them across town against the clock, earn
  fares plus a time bonus. Repeatable, with its own HUD line.
- **Photo mode (new):** **P** hides every HUD and touch element for a
  clean frame and saves the canvas as a PNG.
- **Ambient life (new):** seagulls circling the harbour and marina,
  and bobbing boats on the ocean south of the city.
- **Visual spec 12:33 WIB (user, menggantikan instruksi langit 12:30 yang dibatalkan):**
  New Game mulai 11:30 (siang biru, bukan senja jingga); langit siang BIRU + awan lembut
  (sprite radial, bukan kotak), kabut tipis biru-putih mulai jauh (200+); kamera awal
  lebih rendah (pitch 0,15) & yaw 0 menghadap utara menyusuri jalan utama x=0 yang
  diapit gedung warna-warni, palem, mobil & zebra (bukan ke pantai/lapangan kosong);
  FOV potret 72; jalan navy #232833 butiran halus (anisotropy max, repeat persegi)
  + trotoar abu terang bergaris sambungan & kerb jelas; plakat toko gelap (Toko Seja
  & SPBU, teks kuning/putih besar, fog:false, tekstur 512×192 SRGB, halo LED menguat
  sore/malam) sementara Bengkel & plakat rumah tetap cerah; 8 payung kafe warna-warni
  + kursi + 4 tenda toko di strip pantai selatan dan etalase toko berpendar (kaca
  cyan muda) di lantai dasar gedung.
- **Screenshot staging (new):** `?shot=start|drive|chase|boss` stages
  a composed scene after boot — mission start on foot at golden hour,
  driving in daylight, a 3-star police chase, and the mission 5 boss
  fight at the harbour.
- **Round 9 verified (2026-11-19):** `node main.ts` exit 0 on a fresh
  empty dir, a dir with old output, and a bind mount; `serve.ts`
  smoke test HTTP 200; headless playtest with 0 console errors;
  `makefun check` reproduces reported in the round-9 report.

## License

MIT — see [LICENSE](LICENSE).
