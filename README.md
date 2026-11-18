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
  gunfire, and a day clock that starts at sunset, 17:40.

## Playing

- **WASD** walk / drive · **Mouse** look (click to lock) · **SHIFT** run
- **SPACE** jump · **F** enter / exit car · **E** interact / start a mission
- **Left click** shoot · **Right click** aim · **1–4** weapons · **R** reload
- **M** full map (click to set a waypoint) · **ESC** pause
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

## License

MIT — see [LICENSE](LICENSE).
