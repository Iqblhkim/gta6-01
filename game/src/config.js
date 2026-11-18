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
  // Cars.
  carAccel: 22,
  carBrake: 34,
  carMaxSpeed: 34,
  carMaxReverse: 10,
  carTurnRate: 2.1,
  carRadius: 2.2,
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
