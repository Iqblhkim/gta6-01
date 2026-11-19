// Kota Seja — configuration constants.
// Every number that tunes the game lives here so the rest of the code
// reads like a design document instead of a pile of magic literals.
export const CONFIG = {
  seed: 20261118,
  // City layout: a 9 by 7 grid of blocks. One block is 40 world units,
  // roads between blocks are 12 wide, so the street pitch is 52.
  blocksX: 9,
  blocksZ: 7,
  blockSize: 40,
  roadWidth: 12,
  get pitch() { return this.blockSize + this.roadWidth; },
  // World bounds are derived from the grid in city.js; these are fallbacks.
  worldHalfX: 250,
  worldHalfZ: 200,
  // Player on foot.
  walkSpeed: 6,
  runSpeed: 10,
  jumpSpeed: 9,
  gravity: 24,
  playerRadius: 0.7,
  playerHeight: 1.8,
  // Cars: GTA-V-style arcade handling. The launch is punchy and tapers
  // off near top speed, steering bites hard at low speed and softens
  // at the top end, and the handbrake (SPACE / REM) trades grip for a
  // sharp drift turn. Round 5 (2026-11-19) retuned all of this.
  carAccel: 22,
  carAccelLow: 30,
  carAccelHigh: 13,
  carBrake: 34,
  carMaxSpeed: 38,
  carMaxReverse: 10,
  carTurnLow: 2.7,
  carTurnHigh: 1.4,
  carSteerSmooth: 7,
  carHandbrakeTurn: 1.9,
  carHandbrakeDecel: 26,
  carRadius: 2.2,
  // Chase camera while driving: swings behind the car, pulls back and
  // widens the FOV with speed so the drive feels fast.
  camFollow: 2.4,
  // Round 6: after the player looks around by hand (mouse / touch
  // drag), the chase camera leaves the view alone for this long before
  // swinging back behind the car — a full 360° look must be possible.
  camLookGraceMs: 5000,
  camDistSpeed: 0.06,
  camHeightSpeed: 0.015,
  camFovBase: 62,
  camFovSpeed: 0.32,
  camFovMax: 74,
  // Touch controls (round 5): virtual joystick + action buttons.
  // Round 6: the radio (procedural hip-hop/funk, audio.js) is ON by
  // default after the first gesture; MUSIK button / N key toggles it.
  // Round 7: the MUSIK button became STASIUN (cycle 3 stations, N
  // key), the MOBIL button became contextual button A (E key), and
  // TEMBAK became contextual button B (F key / horn while driving).
  musicDefaultOn: true,
  // Round 7 — Halcyon contextual controls: two big action buttons.
  // A = the primary context action (enter/exit car, pick up a
  // package, start a mission, attack), B = shoot on foot, horn in a
  // car. Keyboard: E = A, F = B. See world.computeContext().
  touch: {
    stickRadius: 44,
    lookSensitivity: 1,
  },
  // Round 7 — camera modes: 'chase' (round 5/6 follow cam, default)
  // or 'top' (high top-down view, north up). C key / KAMERA button.
  camModes: ['chase', 'top'],
  camTopHeight: 92,
  camTopTilt: 14, // eye sits this far south of the target: a steep
  // ~81° top-down view that never degenerates the lookAt math.
  camTopFov: 55,
  // Round 7 — day/night: the clock now runs a full 24 h cycle and the
  // sky, fog, sun and street lights follow it. One game day is still
  // 12 real minutes; the day still starts at sunset, 17:40.
  // Keyframes are (hour, skyTop, skyMid, skyLow, fog, ambient, sunElev):
  // sky colours are linear RGB triples, fog is the fog colour, ambient
  // is the flat light floor (0.28 = deep night, 0.55 = noon), sunElev
  // is the sun's elevation in radians (negative = below the horizon,
  // then the moon takes its place).
  dayPhases: [
    { hour: 0,  top: [0.02, 0.03, 0.10], mid: [0.05, 0.07, 0.20], low: [0.10, 0.10, 0.26], fog: [0.06, 0.07, 0.16], ambient: 0.30, sunElev: -0.9, name: 'night' },
    { hour: 5,  top: [0.05, 0.07, 0.22], mid: [0.35, 0.22, 0.38], low: [0.85, 0.45, 0.35], fog: [0.45, 0.30, 0.34], ambient: 0.38, sunElev: -0.05, name: 'dawn' },
    { hour: 7,  top: [0.30, 0.55, 0.90], mid: [0.62, 0.78, 0.95], low: [0.85, 0.90, 0.98], fog: [0.70, 0.78, 0.88], ambient: 0.50, sunElev: 0.25, name: 'morning' },
    { hour: 11, top: [0.15, 0.45, 0.95], mid: [0.45, 0.70, 1.00], low: [0.75, 0.88, 1.00], fog: [0.72, 0.82, 0.95], ambient: 0.55, sunElev: 1.05, name: 'noon' },
    { hour: 15, top: [0.25, 0.50, 0.92], mid: [0.55, 0.72, 0.98], low: [0.90, 0.85, 0.75], fog: [0.78, 0.80, 0.88], ambient: 0.54, sunElev: 0.7, name: 'afternoon' },
    { hour: 17, top: [0.36, 0.16, 0.48], mid: [0.98, 0.45, 0.32], low: [1.00, 0.72, 0.42], fog: [0.94, 0.55, 0.42], ambient: 0.48, sunElev: 0.18, name: 'sunset' },
    { hour: 19, top: [0.10, 0.08, 0.28], mid: [0.45, 0.20, 0.38], low: [0.90, 0.45, 0.30], fog: [0.45, 0.28, 0.32], ambient: 0.40, sunElev: -0.1, name: 'dusk' },
    { hour: 21, top: [0.03, 0.04, 0.12], mid: [0.07, 0.09, 0.24], low: [0.14, 0.12, 0.30], fog: [0.08, 0.09, 0.18], ambient: 0.30, sunElev: -0.7, name: 'night' },
    { hour: 24, top: [0.02, 0.03, 0.10], mid: [0.05, 0.07, 0.20], low: [0.10, 0.10, 0.26], fog: [0.06, 0.07, 0.16], ambient: 0.30, sunElev: -0.9, name: 'night' },
  ],
  // Round 7 — radio stations (all procedural WebAudio, all original):
  // Seja FM keeps the round-6 funk groove; Seja Pop is faster and
  // brighter; Seja Malam is a slow mellow night groove. The scheduler
  // in audio.js reads these tables; N / STASIUN cycles 1→2→3→off→1.
  radioStations: [
    { name: 'SEJA FM',    bpm: 92,  roots: [110, 87.31, 130.81, 98], bass: { 0: 0, 2: 0, 3: 10, 5: 12, 7: 7, 10: 12, 11: 10, 14: 3, 15: 5 }, stabs: [2, 7, 11], lead: [220, 261.63, 329.63, 392, 440, 329.63], leadSteps: [6, 13], kick: [0, 4, 8, 12, 14], snare: [4, 12], pad: true },
    { name: 'SEJA POP',   bpm: 118, roots: [130.81, 98, 110, 146.83], bass: { 0: 0, 2: 7, 4: 0, 6: 12, 8: 0, 10: 10, 12: 7, 14: 12 }, stabs: [1, 5, 9, 13], lead: [261.63, 329.63, 392, 523.25, 440, 392], leadSteps: [3, 7, 11, 15], kick: [0, 4, 8, 12], snare: [4, 12], pad: true },
    { name: 'SEJA MALAM', bpm: 68,  roots: [87.31, 82.41, 98, 73.42], bass: { 0: 0, 3: 7, 8: 0, 11: 5 }, stabs: [6, 14], lead: [220, 196, 246.94, 293.66, 220, 174.61], leadSteps: [4, 12], kick: [0, 8], snare: [8], pad: true },
  ],
  // Round 7 — horn: two-tone, and the pedestrians ahead of the car
  // step aside when they hear it.
  horn: { freqs: [370, 466], dur: 0.35, vol: 0.25, reactRadius: 14, reactSeconds: 2 },
  // Round 7 — headlights: 'auto' (on at night, the default), 'on'
  // or 'off'. The LAMPU button / L key cycles auto → on → off.
  lightsModes: ['auto', 'on', 'off'],
  // Round 7 — the landmark tower: the tallest building in the city,
  // placed by city.js at the Downtown core. Its position is stored on
  // the city object (city.landmark); the minimap draws a star there.
  landmarkHeight: 58,
  // Round 7 — street props: how many of each the city plants (all
  // merged into the static buffer, all guarded off roads/buildings).
  props: { hydrants: 14, signs: 18, bins: 16, benches: 14, busStops: 3 },
  trafficCount: 14,
  parkedCount: 28,
  // Pedestrians.
  pedCount: 48,
  pedWalkSpeed: 1.6,
  pedRunSpeed: 4.5,
  // Wanted / police.
  wantedMax: 5,
  wantedDecaySeconds: 25,
  wantedCrimeCooldown: 15,
  policeFootCount: 6,
  policeCarCount: 3,
  bustedCatchSeconds: 1.5,
  bustedFine: 200,
  // Combat.
  weapons: {
    fists:   { name: 'FISTS',   slot: 1, damage: 12, range: 2.2,  mag: Infinity, reload: 0.4, rate: 0.45, spread: 0.05, auto: false, owned: true },
    pistol:  { name: 'PISTOL',  slot: 2, damage: 34, range: 55,   mag: 12, reload: 1.1,  rate: 0.28, spread: 0.03, auto: false, owned: true },
    smg:     { name: 'SMG',     slot: 3, damage: 18, range: 45,   mag: 30, reload: 1.4,  rate: 0.09, spread: 0.07, auto: true,  owned: false },
    shotgun: { name: 'SHOTGUN', slot: 4, damage: 22, range: 26,   mag: 6,  reload: 1.8,  rate: 0.8,  spread: 0.16, auto: false, owned: false, pellets: 6 },
  },
  // Missions: name, pay, and a short briefing shown on the title of each one.
  missions: [
    { name: 'FRESH AIR',      pay: 500,  brief: 'Rico needs wheels. Steal a car and bring it to the hideout.' },
    { name: 'WRENCH WORK',    pay: 600,  brief: 'Pick up the package at the Harbour and deliver it Downtown. Keep the car clean.' },
    { name: 'TAXI TROUBLE',   pay: 700,  brief: 'Three fares are waiting on the Beachfront. Get them all there on time.' },
    { name: 'HARBOUR LIGHTS', pay: 800,  brief: 'Sabotage the warehouse on the east docks. Stay out of the patrols sight.' },
    { name: 'OLD QUARTER HEAT', pay: 900, brief: 'A runner is fleeing through the Old Quarter. Chase him down and bring him in.' },
    { name: 'SUNSET RUN',     pay: 1000, brief: 'Street race at sunset: three checkpoints, two rivals, no mercy.' },
    { name: 'THE COLLECTOR',  pay: 1200, brief: 'Five packages are hidden across the city. Collect them all before dawn.' },
    { name: 'KING OF SOLANO', pay: 1500, brief: 'Take back the hideout. The whole force will come for you. Survive it.' },
  ],
  debt: 50000,
  // Clock: one game day is 12 real minutes; the day starts at 17:40, sunset.
  dayLengthSeconds: 720,
  dayStartHours: 17.66,
  // Pickups and side content.
  collectibleCount: 10,
  stuntJumpCount: 3,
  healthPickupHeal: 40,
  armourPickupAmount: 50,
  // Colours of the sunset palette, shared by renderer and city.
  palette: {
    skyTop: [0.36, 0.16, 0.48],
    skyMid: [0.98, 0.45, 0.32],
    skyLow: [1.0, 0.72, 0.42],
    sun: [1.0, 0.85, 0.55],
    road: [0.16, 0.16, 0.20],
    sidewalk: [0.62, 0.58, 0.52],
    grass: [0.35, 0.55, 0.30],
    sand: [0.93, 0.82, 0.60],
    water: [0.10, 0.35, 0.55],
    building: ['#f2a65a', '#f27d7d', '#f7d774', '#8ecb7d', '#7fb8d9', '#e58bb1', '#c9a7e8', '#f5e6c8'],
    roof: ['#7a4a2b', '#5d3a4e', '#3e5c4b', '#31435c'],
  },
};

export const DISTRICTS = [
  { name: 'Downtown',   x0: -60,  z0: -190, x1: 90,   z1: -20 },
  { name: 'Old Quarter', x0: -250, z0: -190, x1: -60,  z1: 40 },
  { name: 'Beachfront', x0: -250, z0: 40,   x1: 60,   z1: 200 },
  { name: 'Harbour',    x0: 90,   z0: -190, x1: 250,  z1: 200 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Kota Seja';
}

// Round 7 — day/night: interpolate the CONFIG.dayPhases keyframes at
// any hour (0..24) and return the blended sky/fog/light values plus
// the phase name and whether it counts as night (street lights and
// lit windows switch on, headlights go auto-on). Pure function, so
// the unit tests can pin every phase without booting the game.
export function dayPhaseAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  const frames = CONFIG.dayPhases;
  let a = frames[0], b = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (h >= frames[i].hour && h <= frames[i + 1].hour) { a = frames[i]; b = frames[i + 1]; break; }
  }
  const span = (b.hour - a.hour) || 1;
  const t = Math.min(1, Math.max(0, (h - a.hour) / span));
  const lerp3 = (x, y) => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  const lerp1 = (x, y) => x + (y - x) * t;
  return {
    name: t < 0.5 ? a.name : b.name,
    top: lerp3(a.top, b.top),
    mid: lerp3(a.mid, b.mid),
    low: lerp3(a.low, b.low),
    fog: lerp3(a.fog, b.fog),
    ambient: lerp1(a.ambient, b.ambient),
    sunElev: lerp1(a.sunElev, b.sunElev),
    // Night runs 19:30–05:00; dawn/dusk are twilight, not night.
    night: h >= 19.5 || h < 5,
    hour: h,
  };
}

// Round 7 complete (2026-11-19): Halcyon contextual A/B controls,
// top-down camera, full day/night cycle, 3 radio stations, horn +
// headlights, district building types, roof details, landmark tower,
// street props, zebra + road markings, sidewalks, parks, blob
// shadows, fog + sky per phase, NPC variety, police in patrol cars.
