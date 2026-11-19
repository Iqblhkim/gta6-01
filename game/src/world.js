// Kota Seja — game state, physics, wanted system, police AI, missions, combat.
// This is the biggest module: it owns every entity and rule, and it knows
// nothing about the DOM, WebGL or audio, so the same code runs in the
// browser and in the Node unit tests.
import { CONFIG, districtAt, dayPhaseAt } from './config.js';
import { makeRng } from './random.js';
import { buildCity, onRoad, nearestRoadPoint, resolveBuildingCollision, carColour } from './city.js';

const TAU = Math.PI * 2;
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}
function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

const CAR_MODELS = [
  { model: 'sedan',  w: 1.9, l: 4.4, h: 1.35 },
  { model: 'taxi',   w: 1.9, l: 4.4, h: 1.35 },
  { model: 'van',    w: 2.1, l: 5.2, h: 2.0 },
  { model: 'sport',  w: 1.9, l: 4.2, h: 1.15 },
  { model: 'truck',  w: 2.3, l: 6.4, h: 2.4 },
];
const PED_SHIRTS = ['#e84a5f', '#3fa7d6', '#f2c14e', '#7bc950', '#9b7ede', '#f28c38', '#e8e8e8', '#3d3d4a'];

export function createWorld(seed = CONFIG.seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const world = {
    seed, rng, city,
    time: 0,
    clockHours: CONFIG.dayStartHours,
    day: 1,
    money: 250,
    respect: 0,
    debtPaid: 0,
    screen: 'title', // title | playing | paused | map | busted | wasted | complete | missionComplete
    screenTimer: 0,
    lastCrimeAt: -999,
    wanted: 0,
    wantedTimer: 0,
    bustedTimer: 0,
    message: '',
    messageTimer: 0,
    radio: '',
    radioTimer: 0,
    cameraYaw: Math.PI,
    cameraPitch: 0.32,
    // Round 7 — Halcyon settings, saved with the game (serialize):
    // camMode 'chase' (round 5/6 follow cam) or 'top' (top-down);
    // station 0..2 = the radio station index (audio.js); lights
    // 'auto' (on at night, the default), 'on' or 'off'.
    settings: { camMode: 'chase', station: 0, lights: 'auto' },
    // Round 7 — day phase (dayPhaseAt(clockHours), refreshed every
    // update) and the effective headlight state: on when the setting
    // is 'on', or when 'auto' and the phase counts as night. It
    // starts as the sunset phase, not null, so the title screen and
    // the HUD can read it before the first update runs.
    dayPhase: dayPhaseAt(CONFIG.dayStartHours),
    carLightsOn: false,
    // Round 7 — contextual actions (Halcyon A/B): recomputed every
    // update by computeContext() and read by the HUD/buttons.
    contextA: { action: 'attack', label: 'SERANG' },
    contextB: { action: 'shoot', label: 'TEMBAK' },
    // Round 7 — horn: seconds left of the current honk (drives the
    // sound in main.js and the pedestrian reaction in update).
    hornTimer: 0,
    // Round 6 (packet 12): the living title screen orbits this
    // intersection (roads x=26 and z=26 cross here) — streets,
    // traffic and pedestrians in every direction.
    titleFocus: { x: 26, z: 26 },
    player: {
      x: city.spawn.x, z: city.spawn.z, y: 0, vy: 0,
      angle: city.spawn.angle, speed: 0, health: 100, armour: 0,
      onGround: true, inCar: null, weapon: 'pistol',
      ammo: { fists: Infinity, pistol: 12, smg: 0, shotgun: 0 },
      reserve: { pistol: 48, smg: 0, shotgun: 0 },
      owned: { fists: true, pistol: true, smg: false, shotgun: false },
      fireCooldown: 0, reloadTimer: 0, reloading: false,
      invulnerable: 0,
      // Round 6: walk-cycle phase (drives Rico's leg/arm swing) and
      // gun recoil (0..1, decays; poses the shooting arm + muzzle flash).
      walkPhase: 0, recoil: 0,
    },
    cars: [],
    peds: [],
    police: [],      // foot cops
    patrolCars: [],  // police cars
    enemies: [],
    rivals: [],
    targetCar: null,
    particles: [],
    // Round 6: visible shooting effects — one tracer per pellet, a
    // muzzle flash at the gun tip, a camera shake that decays.
    tracers: [],     // {x0,y0,z0,x1,y1,z1,life,maxLife}
    muzzle: null,    // {x,y,z,life} — null when no flash is showing
    shake: 0,        // 0..1 camera shake, decays every frame
    // Round 6: nearest car the player can enter (null when on foot and
    // far away, or while driving) — the renderer draws the red GTA-style
    // marker above it. Recomputed every frame in update().
    nearCar: null,
    mission: {
      index: 0, stage: 0, sub: 0, timer: 0, active: false,
      collected: 0, checkpoints: 0, damageTaken: 0, sabotage: 0,
      capture: 0, finished: false, failReason: '',
    },
    stats: { crimes: 0, carsStolen: 0, kills: 0, fares: 0, collectibles: 0, jumps: 0 },
    flags: { jumped: {} },
  };

  // Parked cars: along the streets, just off the road centre lines.
  for (let i = 0; i < CONFIG.parkedCount; i++) {
    const vertical = rng.chance(0.5);
    const rx = rng.pick(city.roadXs.slice(1, -1));
    const rz = rng.pick(city.roadZs.slice(1, -1));
    const m = rng.pick(CAR_MODELS);
    const along = rng.range(-180, 180);
    world.cars.push({
      id: i, model: m.model, w: m.w, l: m.l, h: m.h,
      x: vertical ? rx + (rng.chance(0.5) ? 5.4 : -5.4) : along,
      z: vertical ? along : rz + (rng.chance(0.5) ? 5.4 : -5.4),
      angle: vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
      speed: 0, color: carColour(rng), parked: true, traffic: false,
      health: 100, owner: 'parked', driver: false, smoking: false,
    });
  }
  // Traffic cars: rolling on the road grid.
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const m = rng.pick(CAR_MODELS);
    const vertical = rng.chance(0.5);
    const rx = rng.pick(city.roadXs.slice(1, -1));
    const rz = rng.pick(city.roadZs.slice(1, -1));
    const along = rng.range(-180, 180);
    world.cars.push({
      id: CONFIG.parkedCount + i, model: m.model, w: m.w, l: m.l, h: m.h,
      x: vertical ? rx : along, z: vertical ? along : rz,
      angle: vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
      speed: rng.range(7, 11), color: carColour(rng), parked: false, traffic: true,
      health: 100, owner: 'traffic', driver: true, smoking: false,
      dir: vertical ? 'z' : 'x',
    });
  }
  // Pedestrians: wandering the sidewalks and crosswalks.
  const pedNames = ['Ayu', 'Budi', 'Sari', 'Dedi', 'Lina', 'Rudi', 'Maya', 'Agus', 'Nina', 'Joko'];
  const PED_SKINS = ['#f2c89b', '#c98d5f', '#8a5a3b', '#f7d7b0'];
  const PED_HAIR = ['#1c1410', '#3a2a1a', '#6a6a6a', '#c9a227', '#7a3b1e'];
  const PED_PANTS = ['#2b2b33', '#3a4a6b', '#5a3a2a', '#4a4a4a', '#7a6a4a'];
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const p = nearestRoadPoint(city, rng.range(-220, 220), rng.range(-170, 170));
    world.peds.push({
      id: i, name: pedNames[i % pedNames.length], x: p.x + rng.range(-4, 4), z: p.z + rng.range(-4, 4),
      angle: rng.range(0, TAU), speed: 0, shirt: rng.pick(PED_SHIRTS),
      skin: rng.pick(PED_SKINS),
      // Round 7 (packet 17) — NPC VARIETY: hair style + colour,
      // trousers and an accessory, so the 48 pedestrians stop
      // looking like clones in different shirts. The draw space is
      // 4 skins × 8 shirts × 5 hair styles × 5 hair colours × 5
      // trousers × 3 accessories — no two peds share the full look
      // by construction. Height varies ±8% per pedestrian.
      hairStyle: rng.pick(['short', 'long', 'bald', 'cap', 'hat']),
      hairColor: rng.pick(PED_HAIR),
      pants: rng.pick(PED_PANTS),
      accessory: rng.pick(['none', 'none', 'none', 'glasses', 'bag']),
      heightScale: rng.range(0.92, 1.08),
      state: 'walk', walkPhase: rng.range(0, TAU), target: null, panic: 0,
    });
  }
  return world;
}

// ------------------------------------------------------------------ Halcyon context (round 7)
// The two big touch buttons (and the E / F keys) are CONTEXTUAL: what
// A and B do depends on where Rico is and what is near him. This pure
// function answers that question from the world state, so the HUD,
// the touch buttons and the unit tests all agree on the labels.
//   In a car:  A = KELUAR (exit), B = KLAKSON (horn).
//   On foot:   A = MASUK (near a car) / AMBIL (near a package or a
//              hidden collectible) / MULAI (near the hideout with a
//              mission waiting) / SERANG (otherwise — attack with the
//              current weapon); B = TEMBAK (fire) or PUKUL (fists).
export function computeContext(world) {
  const p = world.player;
  const car = playerCar(world);
  if (car) {
    return {
      a: { action: 'exit', label: 'KELUAR' },
      b: { action: 'horn', label: 'KLAKSON' },
    };
  }
  const t = missionTarget(world);
  const nearPackage = t
    && ((world.mission.index === 1 && world.mission.stage === 0)
      || world.mission.index === 6)
    && dist2(p.x, p.z, t.x, t.z) < t.r * t.r;
  const nearCollectible = world.city.collectibles.some(
    (c) => !c.taken && dist2(p.x, p.z, c.x, c.z) < 16);
  const nearHideout = !world.mission.active
    && dist2(p.x, p.z, world.city.hideout.x, world.city.hideout.z) < 625;
  let a;
  if (world.nearCar) a = { action: 'enter', label: 'MASUK' };
  else if (nearPackage || nearCollectible) a = { action: 'pickup', label: 'AMBIL' };
  else if (nearHideout) a = { action: 'start', label: 'MULAI' };
  else a = { action: 'attack', label: 'SERANG' };
  return {
    a,
    b: { action: 'shoot', label: p.weapon === 'fists' ? 'PUKUL' : 'TEMBAK' },
  };
}

// A = AMBIL pressed: pick up a hidden collectible within reach right
// now (walking over one already collects it — this is the deliberate
// button path), or acknowledge a mission package target in range.
// Returns true when something was actually picked up.
export function collectNearby(world) {
  const p = world.player;
  for (const col of world.city.collectibles) {
    if (!col.taken && dist2(p.x, p.z, col.x, col.z) < 16) {
      col.taken = true;
      world.stats.collectibles++;
      world.money += 100;
      showMessage(world, 'Hidden package found! +$100 (' + world.stats.collectibles + '/10)', 3);
      return true;
    }
  }
  const t = missionTarget(world);
  if (t && dist2(p.x, p.z, t.x, t.z) < t.r * t.r) {
    showMessage(world, 'Paket diambil!', 2);
    return true;
  }
  return false;
}

// B = KLAKSON pressed while driving: the horn sounds (main.js plays
// it while hornTimer is up) and the pedestrians ahead of the car
// step aside — a short panic plus a sidestep out of the car's path.
export function honkHorn(world) {
  const car = playerCar(world);
  if (!car) return false;
  world.hornTimer = CONFIG.horn.dur;
  const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
  for (const pd of world.peds) {
    const dx = pd.x - car.x, dz = pd.z - car.z;
    const ahead = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < CONFIG.horn.reactRadius && side < 4) {
      pd.panic = Math.max(pd.panic, CONFIG.horn.reactSeconds);
      pd.state = 'flee';
      const s = (dx * fz - dz * fx) >= 0 ? 1 : -1;
      pd.x += fz * s * 2.5;
      pd.z += -fx * s * 2.5;
    }
  }
  showMessage(world, 'KLAKSON!', 1);
  return true;
}

// ------------------------------------------------------------------ helpers
export function playerCar(world) {
  const p = world.player;
  if (p.inCar === null) return null;
  return world.cars.find((c) => c.id === p.inCar) ?? null;
}

export function nearestCar(world, x, z, maxDist = 5) {
  let best = null, bestD = maxDist * maxDist;
  for (const c of world.cars) {
    const d = dist2(x, z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function addWanted(world, n, reason) {
  if (n <= 0) return;
  world.wanted = clamp(world.wanted + n, 0, CONFIG.wantedMax);
  world.lastCrimeAt = world.time;
  world.stats.crimes++;
  world.wantedTimer = 0;
  if (reason) showMessage(world, reason);
}

export function showMessage(world, text, seconds = 3) {
  world.message = text;
  world.messageTimer = seconds;
}
export function radio(world, text, seconds = 4) {
  world.radio = text;
  world.radioTimer = seconds;
}

export function enterCar(world, car) {
  const p = world.player;
  if (p.inCar !== null || !car) return false;
  p.inCar = car.id;
  car.parked = false;
  car.traffic = false;
  car.driver = true;
  if (car.owner === 'traffic' || car.owner === 'parked') {
    car.owner = 'player';
    world.stats.carsStolen++;
    addWanted(world, 1, 'Car stolen — wanted level up!');
    radio(world, 'Radio: "Unit, we have a stolen vehicle in ' + districtAt(car.x, car.z) + '."');
  }
  return true;
}

export function exitCar(world) {
  const p = world.player;
  const car = playerCar(world);
  if (!car) return false;
  p.x = car.x + Math.sin(car.angle + Math.PI / 2) * 3;
  p.z = car.z + Math.cos(car.angle + Math.PI / 2) * 3;
  p.angle = car.angle;
  p.inCar = null;
  car.speed = 0;
  return true;
}

export function damageCar(world, car, amount) {
  car.health = Math.max(0, car.health - amount);
  if (car.health < 55) car.smoking = true;
  if (world.mission.index === 1 && world.mission.active && playerCar(world) === car) {
    world.mission.damageTaken += amount;
  }
  if (car.health <= 0) {
    spawnParticles(world, car.x, car.z, 24, '#ff7b2d');
    car.speed = 0;
    if (playerCar(world) === car) exitCar(world);
  }
}

export function spawnParticles(world, x, z, n, color) {
  for (let i = 0; i < n; i++) {
    world.particles.push({
      x, z, y: 1 + world.rng.range(0, 2),
      vx: world.rng.range(-4, 4), vy: world.rng.range(1, 6), vz: world.rng.range(-4, 4),
      life: world.rng.range(0.4, 1.1), maxLife: 1.1, color,
      size: world.rng.range(0.15, 0.4),
    });
  }
  if (world.particles.length > 400) world.particles.splice(0, world.particles.length - 400);
}

export function hurtPlayer(world, amount, source) {
  const p = world.player;
  if (p.invulnerable > 0 || world.screen !== 'playing') return;
  let rest = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, rest * 0.6);
    p.armour -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  if (source === 'police') addWanted(world, 0, '');
  if (p.health <= 0) {
    p.health = 0;
    world.screen = 'wasted';
    world.screenTimer = 0;
    showMessage(world, 'WASTED — Rico is down.', 6);
  }
}

export function healPlayer(world, amount) {
  world.player.health = clamp(world.player.health + amount, 0, 100);
}

export function giveWeapon(world, key) {
  const p = world.player;
  p.owned[key] = true;
  const def = CONFIG.weapons[key];
  if (def.mag !== Infinity && p.ammo[key] === 0) p.ammo[key] = def.mag;
  if (def.mag !== Infinity) p.reserve[key] = (p.reserve[key] ?? 0) + def.mag * 2;
  showMessage(world, 'Picked up ' + def.name + '!');
}

// ------------------------------------------------------------------ shooting
export function tryShoot(world) {
  const p = world.player;
  if (p.fireCooldown > 0 || p.reloading || world.screen !== 'playing') return false;
  const def = CONFIG.weapons[p.weapon];
  if (def.mag !== Infinity && p.ammo[p.weapon] <= 0) {
    reloadWeapon(world);
    return false;
  }
  p.fireCooldown = def.rate;
  if (def.mag !== Infinity) p.ammo[p.weapon]--;
  const car = playerCar(world);
  const ox = car ? car.x : p.x;
  const oz = car ? car.z : p.z;
  const aim = car ? car.angle : p.angle;
  // Round 6 — shooting feedback: the gun kicks (recoil poses the arm),
  // the camera shudders, and a muzzle flash burns at the gun tip.
  // Muzzle tip: just past the hand on foot, past the bonnet in a car.
  p.recoil = 1;
  world.shake = Math.max(world.shake, 0.35);
  const muzzleX = ox + Math.sin(aim) * (car ? 2.6 : 0.9);
  const muzzleZ = oz + Math.cos(aim) * (car ? 2.6 : 0.9);
  const muzzleY = (car ? 1.2 : 1.3) + (p.y || 0);
  world.muzzle = { x: muzzleX, y: muzzleY, z: muzzleZ, life: 0.09 };
  const pellets = def.pellets ?? 1;
  let hitAnything = false;
  for (let k = 0; k < pellets; k++) {
    const a = aim + (world.rng.next() - 0.5) * 2 * def.spread;
    const dx = Math.sin(a), dz = Math.cos(a);
    // Nearest hit among enemies, peds, police and cars along the ray.
    let best = null, bestT = def.range;
    const consider = (x, z, r, ref) => {
      const rx = x - ox, rz = z - oz;
      const t = rx * dx + rz * dz;
      if (t < 0 || t > bestT) return;
      const px = ox + dx * t - x, pz = oz + dz * t - z;
      if (px * px + pz * pz < r * r) { bestT = t; best = ref; }
    };
    for (const e of world.enemies) consider(e.x, e.z, 1.1, { kind: 'enemy', ref: e });
    for (const pd of world.peds) consider(pd.x, pd.z, 0.9, { kind: 'ped', ref: pd });
    for (const c of world.police) consider(c.x, c.z, 0.9, { kind: 'cop', ref: c });
    for (const c of world.cars) {
      if (car && c.id === car.id) continue;
      consider(c.x, c.z, 2.4, { kind: 'car', ref: c });
    }
    if (best) {
      hitAnything = true;
      const hx = ox + dx * bestT, hz = oz + dz * bestT;
      spawnParticles(world, hx, hz, 5, '#ffd23d');
      if (best.kind === 'enemy') {
        best.ref.health -= def.damage;
        if (best.ref.health <= 0 && !best.ref.dead) {
          best.ref.dead = true;
          world.stats.kills++;
          spawnParticles(world, best.ref.x, best.ref.z, 14, '#c22');
        }
      } else if (best.kind === 'ped') {
        best.ref.panic = 6;
        best.ref.state = 'flee';
        addWanted(world, 1, 'Pedestrian shot — witnesses called the police!');
      } else if (best.kind === 'cop') {
        best.ref.health -= def.damage;
        addWanted(world, 1, 'Officer down — wanted level up!');
        if (best.ref.health <= 0) { best.ref.dead = true; world.stats.kills++; }
      } else if (best.kind === 'car') {
        damageCar(world, best.ref, def.damage);
        if (best.ref.owner === 'police') addWanted(world, 1, 'Police car hit!');
      }
    } else {
      spawnParticles(world, ox + dx * def.range, oz + dz * def.range, 2, '#aaa');
    }
    // Round 6 — visible bullet: a glowing tracer from the muzzle to
    // the hit point (or to max range on a miss), plus a bright impact
    // burst where it lands. Tracers decay in update(), the renderer
    // draws them as thin light streaks.
    world.tracers.push({
      x0: muzzleX, y0: muzzleY, z0: muzzleZ,
      x1: ox + dx * bestT, y1: best ? 1.0 : muzzleY, z1: oz + dz * bestT,
      life: 0.14, maxLife: 0.14,
    });
    if (best) spawnParticles(world, ox + dx * bestT, oz + dz * bestT, 3, '#ffffff');
    if (world.tracers.length > 24) world.tracers.splice(0, world.tracers.length - 24);
  }
  // Firing a gun in public is a crime the city notices: the first shot
  // puts the police on Rico, later shots keep the heat from cooling off.
  if (p.weapon !== 'fists') {
    if (world.wanted < 1) {
      world.wanted = 1;
      world.lastCrimeAt = world.time;
      world.stats.crimes++;
      showMessage(world, 'Shots fired — the police are on their way!');
    } else {
      world.lastCrimeAt = world.time;
    }
  }
  return hitAnything;
}

export function reloadWeapon(world) {
  const p = world.player;
  const def = CONFIG.weapons[p.weapon];
  if (def.mag === Infinity || p.reloading) return false;
  if (p.ammo[p.weapon] >= def.mag) return false;
  if ((p.reserve[p.weapon] ?? 0) <= 0) return false;
  p.reloading = true;
  p.reloadTimer = def.reload;
  return true;
}

export function finishReload(world) {
  const p = world.player;
  const def = CONFIG.weapons[p.weapon];
  const need = def.mag - p.ammo[p.weapon];
  const take = Math.min(need, p.reserve[p.weapon] ?? 0);
  p.ammo[p.weapon] += take;
  p.reserve[p.weapon] -= take;
  p.reloading = false;
}

// ------------------------------------------------------------------ missions
export function missionDef(world) {
  return CONFIG.missions[world.mission.index] ?? null;
}

export function missionTarget(world) {
  const m = world.mission;
  const c = world.city;
  switch (m.index) {
    case 0: return m.stage === 0 ? null : { x: c.hideout.x, z: c.hideout.z, r: 8, label: 'Hideout' };
    case 1: return m.stage === 0
      ? { x: c.warehouse.x, z: c.warehouse.z, r: 7, label: 'Package' }
      : { x: c.downtownDrop.x, z: c.downtownDrop.z, r: 8, label: 'Drop-off' };
    case 2: {
      const fares = [
        { x: -140, z: 130 }, { x: -60, z: 150 }, { x: 20, z: 120 },
      ];
      return m.stage === 0
        ? { x: fares[m.sub].x, z: fares[m.sub].z, r: 6, label: 'Fare ' + (m.sub + 1) }
        : { x: c.downtownDrop.x, z: c.downtownDrop.z, r: 8, label: 'Drop-off' };
    }
    case 3: return m.stage === 0
      ? { x: c.warehouse.x, z: c.warehouse.z, r: 7, label: 'Warehouse' }
      : { x: c.warehouse.x, z: c.warehouse.z, r: 9, label: 'Sabotage zone' };
    case 4: return world.targetCar
      ? { x: world.targetCar.x, z: world.targetCar.z, r: 5, label: 'Runner' }
      : { x: c.oldQuarter.x, z: c.oldQuarter.z, r: 10, label: 'Old Quarter' };
    case 5: {
      const cp = c.raceCheckpoints[Math.min(m.checkpoints, 2)];
      return { x: cp.x, z: cp.z, r: 10, label: 'Checkpoint ' + (m.checkpoints + 1) + '/3' };
    }
    case 6: {
      const s = c.collectorSpots[m.collected] ?? c.collectorSpots[0];
      return { x: s.x, z: s.z, r: 6, label: 'Package ' + (m.collected + 1) + '/5' };
    }
    case 7: return m.stage === 0
      ? { x: c.hideout.x, z: c.hideout.z, r: 10, label: 'Hideout' }
      : { x: c.hideout.x, z: c.hideout.z, r: 12, label: 'Hold the hideout' };
    default: return null;
  }
}

export function missionObjectiveText(world) {
  const def = missionDef(world);
  if (!def) return 'All missions complete — Kota Seja is yours, Rico.';
  const m = world.mission;
  if (!m.active) return 'Go to the hideout to start: ' + def.name;
  const stage = 'STAGE ' + (m.stage + 1) + '/2';
  switch (m.index) {
    case 0: return m.stage === 0 ? 'Steal any car' : 'Drive the car to the hideout';
    case 1: return m.stage === 0 ? 'Pick up the package at the Harbour' : 'Deliver it Downtown — no damage!';
    case 2: return m.stage === 0 ? 'Pick up fare ' + (m.sub + 1) + ' of 3 on the Beachfront' : 'Drop the fare off Downtown';
    case 3: return m.stage === 0 ? 'Reach the warehouse at the Harbour' : 'Sabotage the warehouse — stay in the zone';
    case 4: return m.stage === 0 ? 'Chase the runner through the Old Quarter' : 'Ram his car until it stops';
    case 5: return 'Race! Hit checkpoint ' + (m.checkpoints + 1) + ' of 3 before the rivals';
    case 6: return 'Collect package ' + (m.collected + 1) + ' of 5 before dawn';
    case 7: return m.stage === 0 ? 'Fight your way to the hideout' : 'Hold the hideout — clear the attackers';
    default: return stage;
  }
}

export function startMission(world) {
  const m = world.mission;
  const def = missionDef(world);
  if (!def || m.active || m.finished) return false;
  m.active = true;
  m.stage = 0;
  m.sub = 0;
  m.timer = 0;
  m.collected = 0;
  m.checkpoints = 0;
  m.damageTaken = 0;
  m.sabotage = 0;
  m.capture = 0;
  showMessage(world, 'MISSION ' + (m.index + 1) + '/8 — ' + def.name + ': ' + def.brief, 5);
  radio(world, 'Radio: "Rico, this is Seja. ' + def.brief + '"');
  if (m.index === 2) giveWeapon(world, 'smg');
  if (m.index === 3) giveWeapon(world, 'shotgun');
  if (m.index === 4) spawnTargetCar(world);
  if (m.index === 5) spawnRivals(world);
  if (m.index === 6) m.timer = 0; // 300 seconds of night remain; dawn fails it
  if (m.index === 7) {
    spawnEnemies(world, 6, world.city.hideout.x, world.city.hideout.z);
    addWanted(world, 5 - world.wanted, 'The whole force is coming!');
  }
  return true;
}

function spawnTargetCar(world) {
  const c = world.city;
  const car = {
    id: 900, model: 'sport', w: 1.9, l: 4.2, h: 1.15,
    x: c.oldQuarter.x + 20, z: c.oldQuarter.z, angle: 0, speed: 9,
    color: '#e8e8e8', parked: false, traffic: false, health: 60,
    owner: 'runner', driver: true, smoking: false, dir: 'x',
  };
  world.targetCar = car;
  world.cars.push(car);
}

function spawnRivals(world) {
  const c = world.city;
  world.rivals = [0, 1].map((i) => ({
    id: 910 + i, model: 'sport', w: 1.9, l: 4.2, h: 1.15,
    x: c.hideout.x + (i === 0 ? -8 : 8), z: c.hideout.z + 6,
    angle: 0, speed: 0, color: i === 0 ? '#d94f3d' : '#3d7dd9',
    parked: false, traffic: false, health: 100, owner: 'rival',
    driver: true, smoking: false, cp: 0, progress: 0,
  }));
  for (const r of world.rivals) world.cars.push(r);
}

function spawnEnemies(world, n, x, z) {
  for (let i = 0; i < n; i++) {
    world.enemies.push({
      x: x + world.rng.range(-14, 14), z: z + world.rng.range(-14, 14),
      angle: 0, health: 60, dead: false, fireCooldown: world.rng.range(0.5, 2),
      speed: 2.4,
    });
  }
}

export function completeMission(world) {
  const m = world.mission;
  const def = missionDef(world);
  m.active = false;
  m.finished = false;
  world.money += def.pay;
  world.debtPaid += def.pay;
  world.respect = clamp(world.respect + 12, 0, 100);
  world.player.health = Math.min(100, world.player.health + 25);
  world.screen = 'missionComplete';
  world.screenTimer = 0;
  showMessage(world, 'MISSION COMPLETE: ' + def.name + ' — +$' + def.pay, 6);
  radio(world, 'Radio: "Clean work, Rico. $' + def.pay + ' is yours."');
  m.index++;
  m.stage = 0;
  m.sub = 0;
  if (m.index >= CONFIG.missions.length) {
    world.screen = 'complete';
    showMessage(world, 'KING OF SOLANO — the debt is paid. Kota Seja is yours!', 8);
  }
}

export function failMission(world, reason) {
  const m = world.mission;
  m.active = false;
  m.stage = 0;
  m.sub = 0;
  m.failReason = reason;
  showMessage(world, 'MISSION FAILED: ' + reason + ' — try again at the hideout.', 5);
  radio(world, 'Radio: "That went sideways, Rico. Come back when you are ready."');
}

// ------------------------------------------------------------------ police
export function spawnPolice(world) {
  const p = world.player;
  const car = playerCar(world);
  const px = car ? car.x : p.x, pz = car ? car.z : p.z;
  const wantFoot = Math.min(world.wanted, 3);
  while (world.police.filter((c) => !c.dead).length < wantFoot) {
    const a = world.rng.range(0, TAU);
    world.police.push({
      x: px + Math.sin(a) * 26, z: pz + Math.cos(a) * 26,
      angle: 0, health: 50, dead: false, catchTimer: 0, speed: 3.4 + world.wanted * 0.25,
    });
  }
  const wantCars = world.wanted >= 2 ? Math.min(world.wanted - 1, 3) : 0;
  while (world.patrolCars.filter((c) => c.health > 0).length < wantCars) {
    const a = world.rng.range(0, TAU);
    const car2 = {
      id: 800 + world.patrolCars.length, model: 'sedan', w: 1.9, l: 4.4, h: 1.35,
      x: px + Math.sin(a) * 40, z: pz + Math.cos(a) * 40, angle: 0, speed: 12,
      color: '#22303e', parked: false, traffic: false, health: 100,
      owner: 'police', driver: true, smoking: false, siren: true,
    };
    world.patrolCars.push(car2);
    world.cars.push(car2);
  }
}

function updatePolice(world, dt) {
  const p = world.player;
  const car = playerCar(world);
  const px = car ? car.x : p.x, pz = car ? car.z : p.z;
  if (world.wanted > 0) spawnPolice(world);
  for (const cop of world.police) {
    if (cop.dead) continue;
    const d = Math.sqrt(dist2(cop.x, cop.z, px, pz));
    cop.angle = Math.atan2(px - cop.x, pz - cop.z);
    if (d > 2) {
      cop.x += Math.sin(cop.angle) * cop.speed * dt;
      cop.z += Math.cos(cop.angle) * cop.speed * dt;
    }
    if (d < 1.6 && !car) {
      cop.catchTimer += dt;
      if (cop.catchTimer > CONFIG.bustedCatchSeconds) {
        world.screen = 'busted';
        world.screenTimer = 0;
        world.money = Math.max(0, world.money - CONFIG.bustedFine);
        world.wanted = 0;
        showMessage(world, 'BUSTED — caught by the police. Fine $' + CONFIG.bustedFine + '.', 6);
      }
    } else cop.catchTimer = 0;
  }
  for (const pc of world.patrolCars) {
    if (pc.health <= 0) continue;
    const d = Math.sqrt(dist2(pc.x, pc.z, px, pz));
    const targetAngle = Math.atan2(px - pc.x, pz - pc.z);
    pc.angle = angleLerp(pc.angle, targetAngle, dt * 1.6);
    pc.speed = clamp(d > 8 ? pc.speed + 14 * dt : pc.speed - 6 * dt, 0, 20 + world.wanted * 2);
    pc.x += Math.sin(pc.angle) * pc.speed * dt;
    pc.z += Math.cos(pc.angle) * pc.speed * dt;
    resolveBuildingCollision(world.city, pc, 2.2);
    if (d < 3.4) {
      if (car) damageCar(world, car, 8 * dt);
      else hurtPlayer(world, 6 * dt, 'police');
      spawnParticles(world, px, pz, 2, '#9fb7d9');
    }
  }
}

// ------------------------------------------------------------------ title backdrop
// Round 6 (packet 12) — the LIVING title screen: while the menu is
// up, traffic rolls, pedestrians stroll and the clock of the city
// keeps ticking, all with the same systems the game uses (no second
// city, no duplicated code). Deliberately LIGHT for phones: no
// collisions with the player, no police, no missions, no particles
// spawning — just cars on the roads and people on the sidewalks.
// The day clock is NOT advanced here, so the sunset stays at 17:40
// until the player actually starts playing.
export function updateTitleBackdrop(world, dt) {
  dt = Math.min(dt, 0.1);
  world.time += dt;
  const city = world.city;
  for (const c of world.cars) {
    if (!c.traffic || c.owner === 'player') continue;
    c.speed = 9; // steady cruise past the menu
    const nx = c.x + Math.sin(c.angle) * c.speed * dt;
    const nz = c.z + Math.cos(c.angle) * c.speed * dt;
    const probe = { x: nx, z: nz };
    if (!resolveBuildingCollision(city, probe, 2.2)) { c.x = nx; c.z = nz; }
    const nearX = city.roadXs.some((rx) => Math.abs(c.x - rx) < 1.2);
    const nearZ = city.roadZs.some((rz) => Math.abs(c.z - rz) < 1.2);
    if ((nearX || nearZ) && world.rng.chance(dt * 0.3)) {
      c.angle += world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    }
    if (c.x < -city.halfX || c.x > city.halfX || c.z < -city.halfZ || c.z > city.halfZ) {
      c.angle += Math.PI;
      c.x = clamp(c.x, -city.halfX + 4, city.halfX - 4);
      c.z = clamp(c.z, -city.halfZ + 4, city.halfZ - 4);
    }
  }
  for (const pd of world.peds) {
    pd.walkPhase += dt * 7;
    if (!pd.target || dist2(pd.x, pd.z, pd.target.x, pd.target.z) < 4) {
      const np = nearestRoadPoint(city, pd.x + world.rng.range(-60, 60), pd.z + world.rng.range(-60, 60));
      pd.target = np;
    }
    const ta = Math.atan2(pd.target.x - pd.x, pd.target.z - pd.z);
    pd.angle = angleLerp(pd.angle, ta, dt * 6);
    pd.x += Math.sin(pd.angle) * CONFIG.pedWalkSpeed * dt;
    pd.z += Math.cos(pd.angle) * CONFIG.pedWalkSpeed * dt;
    pd.x = clamp(pd.x, -city.halfX, city.halfX);
    pd.z = clamp(pd.z, -city.halfZ, city.halfZ);
  }
  for (const pt of world.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
    pt.vy -= 6 * dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
}

// ------------------------------------------------------------------ update
export function update(world, input, dt) {
  // Clamped so a slow frame never jumps the physics, but wide enough
  // that a low-end machine still plays near real time.
  dt = Math.min(dt, 0.1);
  if (world.screen !== 'playing') return;
  world.time += dt;
  world.clockHours += dt * (24 / CONFIG.dayLengthSeconds);
  if (world.clockHours >= 24) { world.clockHours -= 24; world.day++; }
  // Round 7 (packet 4) — the full day/night cycle: the phase is
  // refreshed every frame from the clock, and the headlights follow
  // the lights setting ('on', or 'auto' + night). The renderer reads
  // world.dayPhase for the sky, fog and sun; the HUD reads it for the
  // phase name. Mission 6 still fails at dawn (see updateMission).
  world.dayPhase = dayPhaseAt(world.clockHours);
  world.carLightsOn = world.settings.lights === 'on'
    || (world.settings.lights === 'auto' && world.dayPhase.night);
  const p = world.player;
  const city = world.city;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  // Round 6: shooting feedback decays — recoil eases the arm back,
  // the shake settles, the muzzle flash burns out, tracers fade.
  if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 6);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 1.8);
  // Round 7: the horn note dies with its timer (main.js plays the
  // sound while hornTimer is up).
  if (world.hornTimer > 0) world.hornTimer = Math.max(0, world.hornTimer - dt);
  if (world.muzzle) {
    world.muzzle.life -= dt;
    if (world.muzzle.life <= 0) world.muzzle = null;
  }
  for (const tr of world.tracers) tr.life -= dt;
  world.tracers = world.tracers.filter((tr) => tr.life > 0);
  if (p.reloading) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) finishReload(world);
  }
  if (world.messageTimer > 0) world.messageTimer -= dt;
  if (world.radioTimer > 0) world.radioTimer -= dt;

  // Camera follows the mouse look — and the look deltas are consumed
  // exactly once, right here. Round 5 fixed a nasty bug: main.js used to
  // put the consumed deltas back, so one mouse move (or one touch drag)
  // kept turning the camera forever and the character spun in circles,
  // unable to walk straight. A delta now turns the camera once.
  // Round 6: cameraYaw is deliberately NEVER clamped — it wraps
  // naturally through sin/cos in the movement and camera code, so a
  // full 360° look-drag is possible. The only thing that used to stop
  // a full turn was the chase camera pulling the yaw back to the car's
  // heading; main.js now leaves the view alone for 5 s after a manual
  // look (CONFIG.camLookGraceMs).
  world.cameraYaw += (input.lookDX || 0) * 0.0032;
  world.cameraPitch = clamp(world.cameraPitch + (input.lookDY || 0) * 0.0022, -0.1, 0.9);
  input.lookDX = 0;
  input.lookDY = 0;
  if (input.weaponSlot) {
    const key = WEAPON_ORDER[input.weaponSlot - 1];
    if (key && p.owned[key]) { p.weapon = key; p.reloading = false; }
    input.weaponSlot = 0;
  }
  // SENJATA button (touch): cycle to the next OWNED weapon only. The old
  // behaviour stepped 1-2-3-4 and silently ignored locked slots, so from
  // the pistol the first two taps changed nothing at all — the button
  // felt dead. Every tap now answers with a HUD message.
  if (input.cycleWeapon) {
    input.cycleWeapon = false;
    const owned = WEAPON_ORDER.filter((k) => p.owned[k]);
    const cur = owned.indexOf(p.weapon);
    const next = owned[(cur + 1) % owned.length] ?? 'fists';
    if (next !== p.weapon) {
      p.weapon = next;
      p.reloading = false;
      const def = CONFIG.weapons[next];
      showMessage(world, 'Weapon: ' + def.name + (def.mag === Infinity ? '' : '  ' + p.ammo[next] + '/' + (p.reserve[next] ?? 0)), 2);
    } else {
      showMessage(world, 'Only ' + CONFIG.weapons[p.weapon].name + ' in your arsenal — SMG and Shotgun come with missions 3 and 4.', 3);
    }
  }
  if (input.reload) { reloadWeapon(world); input.reload = false; }
  if (input.shoot || input.shootPulse) { tryShoot(world); input.shootPulse = false; }

  // ---- driving or walking
  const car = playerCar(world);
  if (car) {
    // Round 5 handling: analog steering from the touch joystick (or the
    // digital keys), ramped toward its target so the car leans into a
    // turn instead of snapping; a punchy launch that tapers near top
    // speed; steering that bites at low speed and softens at the top;
    // and a handbrake (SPACE on desktop, REM on touch) that trades
    // grip for a sharp drift turn.
    const steerTarget = Math.abs(input.steer || 0) > 0.12
      ? clamp(input.steer, -1, 1)
      : (input.left ? 1 : 0) - (input.right ? 1 : 0);
    car.steer = (car.steer ?? 0) + (steerTarget - (car.steer ?? 0)) * Math.min(1, CONFIG.carSteerSmooth * dt);
    const throttle = Math.abs(input.throttle || 0) > 0.12
      ? clamp(input.throttle, -1, 1)
      : (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const handbrake = input.handbrake || input.jump;
    input.jump = false;
    const speedAbs = Math.abs(car.speed);
    if (throttle > 0) {
      if (car.speed < -0.5) car.speed += CONFIG.carBrake * throttle * dt;
      else {
        const pull = CONFIG.carAccelLow + (CONFIG.carAccelHigh - CONFIG.carAccelLow) * (speedAbs / CONFIG.carMaxSpeed);
        car.speed += pull * throttle * dt;
      }
    } else if (throttle < 0) {
      if (car.speed > 0.5) car.speed += CONFIG.carBrake * throttle * dt;
      else car.speed += CONFIG.carAccel * 0.6 * throttle * dt;
    } else if (handbrake) {
      car.speed -= Math.sign(car.speed) * CONFIG.carHandbrakeDecel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * 8 * dt;
    }
    if (Math.abs(car.speed) < 0.2 && throttle === 0 && !handbrake) car.speed = 0;
    car.speed = clamp(car.speed, -CONFIG.carMaxReverse, CONFIG.carMaxSpeed);
    const dirSign = car.speed >= 0 ? 1 : -1;
    const turnRate = CONFIG.carTurnLow + (CONFIG.carTurnHigh - CONFIG.carTurnLow) * (speedAbs / CONFIG.carMaxSpeed);
    const grip = clamp(speedAbs / 8, 0.15, 1);
    car.angle += car.steer * turnRate * (handbrake ? CONFIG.carHandbrakeTurn : 1) * dt * dirSign * grip;
    // Handbrake at speed kicks up tyre smoke behind the car.
    if (handbrake && speedAbs > 10 && world.rng.chance(dt * 20)) {
      spawnParticles(world, car.x - Math.sin(car.angle) * 2, car.z - Math.cos(car.angle) * 2, 2, '#bbbbbb');
    }
    const nx = car.x + Math.sin(car.angle) * car.speed * dt;
    const nz = car.z + Math.cos(car.angle) * car.speed * dt;
    const probe = { x: nx, z: nz };
    if (resolveBuildingCollision(city, probe, 2.2)) {
      if (Math.abs(car.speed) > 8) {
        damageCar(world, car, Math.abs(car.speed) * 1.2);
        spawnParticles(world, probe.x, probe.z, 8, '#ccc');
        car.speed *= 0.3;
      } else car.speed *= 0.4;
    }
    car.x = clamp(probe.x, -city.halfX - 20, city.halfX + 34);
    car.z = clamp(probe.z, -city.halfZ - 10, city.halfZ + 30);
    // Running over pedestrians is a crime.
    for (const pd of world.peds) {
      if (Math.abs(car.speed) > 3 && dist2(car.x, car.z, pd.x, pd.z) < 4.5) {
        pd.panic = 8; pd.state = 'flee';
        addWanted(world, 1, 'Pedestrian hit — witnesses called the police!');
        spawnParticles(world, pd.x, pd.z, 8, '#f2c89b');
        pd.x += Math.sin(car.angle) * 4; pd.z += Math.cos(car.angle) * 4;
      }
    }
    // Stunt jumps.
    for (const j of city.stuntJumps) {
      if (!world.flags.jumped[j.x + ':' + j.z] && Math.abs(car.speed) > 18 && dist2(car.x, car.z, j.x, j.z) < 9) {
        world.flags.jumped[j.x + ':' + j.z] = true;
        world.stats.jumps++;
        world.money += 150;
        showMessage(world, 'STUNT JUMP! +$150', 3);
      }
    }
    p.x = car.x; p.z = car.z; p.angle = car.angle;
  } else {
    // Round 5: the joystick is analog — a half-pushed stick walks, a
    // full push runs. Keyboard stays digital.
    const stickMag = Math.hypot(input.joyX || 0, input.joyY || 0);
    const moveSpeed = (input.run ? CONFIG.runSpeed : CONFIG.walkSpeed)
      * (stickMag > 0.12 ? 0.4 + 0.6 * Math.min(1, stickMag) : 1);
    const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    // Movement is relative to the camera yaw.
    const cy = world.cameraYaw;
    const mx = Math.sin(cy) * f + Math.cos(cy) * s;
    const mz = Math.cos(cy) * f - Math.sin(cy) * s;
    const len = Math.hypot(mx, mz) || 1;
    p.speed = (f || s) ? moveSpeed : 0;
    // Round 6: the walk cycle advances with distance actually covered,
    // so Rico's legs/arms swing at the speed he moves — and freeze
    // when he stands still (then only his breathing moves, in render).
    if (f || s) p.walkPhase += dt * p.speed * 1.7;
    if (f || s) {
      p.angle = Math.atan2(mx, mz);
      const nx = p.x + (mx / len) * moveSpeed * dt;
      const nz = p.z + (mz / len) * moveSpeed * dt;
      const probe = { x: nx, z: nz };
      resolveBuildingCollision(city, probe, CONFIG.playerRadius);
      p.x = clamp(probe.x, -city.halfX - 20, city.halfX + 34);
      p.z = clamp(probe.z, -city.halfZ - 10, city.halfZ + 30);
    }
    if (input.jump && p.onGround) {
      p.vy = CONFIG.jumpSpeed;
      p.onGround = false;
    }
    input.jump = false;
    if (!p.onGround) {
      p.vy -= CONFIG.gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
    }
  }
  // Round 6 — enterable-car marker: on foot, the nearest car within
  // 5 m is remembered so the renderer can draw the pulsing red GTA
  // marker above it. It clears the moment Rico drives (he is already
  // in a car) or walks away — nearestCar returns null past 5 m.
  // Round 7: nearCar is set BEFORE the context is computed, so the A
  // label is right on the very first frame after walking up to a car
  // (it used to lag one frame behind the marker).
  world.nearCar = car ? null : nearestCar(world, p.x, p.z, 5);
  // Round 7 — contextual A/B (Halcyon): the labels are recomputed
  // from the world every frame (computeContext) and the HUD + touch
  // buttons read world.contextA / world.contextB. E = A and F = B on
  // the keyboard; the touch buttons set input.actionA / actionB.
  // A = MASUK/KELUAR reuses the enterCar path below (the old MOBIL
  // button and the F key used to do this — the context button is the
  // only way in and out of a car now, so there is no duplicate).
  const ctx = computeContext(world);
  world.contextA = ctx.a;
  world.contextB = ctx.b;
  if (input.actionA) {
    input.actionA = false;
    if (ctx.a.action === 'enter' || ctx.a.action === 'exit') input.enterCar = true;
    else if (ctx.a.action === 'start' && !world.mission.active) startMission(world);
    else if (ctx.a.action === 'pickup') collectNearby(world);
    else if (ctx.a.action === 'attack') tryShoot(world);
  }
  if (input.actionB) {
    input.actionB = false;
    if (car) honkHorn(world);
    // On foot B fires the current weapon: a tap (F key) is one shot
    // (shootPulse only), a held touch button keeps firing — input.shoot
    // stays up while the finger is down (see attachTouch in input.js).
    else { input.shoot = !!input.bHeld; input.shootPulse = true; }
  }
  if (input.horn) {
    input.horn = false;
    if (car) honkHorn(world);
  }
  if (input.enterCar) {
    if (car) exitCar(world);
    else {
      const near = nearestCar(world, p.x, p.z, 5);
      if (near) enterCar(world, near);
    }
    input.enterCar = false;
  }
  if (input.interact) {
    input.interact = false;
    const t = missionTarget(world);
    if (!world.mission.active && t === null && world.mission.index === 0) startMission(world);
    if (!world.mission.active) {
      const d = dist2(p.x, p.z, city.hideout.x, city.hideout.z);
      if (d < 100) startMission(world);
    }
  }
  // MISI button (touch): it ALWAYS answers. The old button only pulsed
  // interact, which does nothing away from the hideout — and missions
  // auto-start in the same radius anyway, so across most of the map the
  // tap was dead silence. Now: near the hideout the tap itself starts
  // the mission (from further out than the auto-start radius); far away
  // it shows the objective, the distance and sets a waypoint to it.
  if (input.missionTap) {
    input.missionTap = false;
    const def = missionDef(world);
    const px = car ? car.x : p.x;
    const pz = car ? car.z : p.z;
    if (def && !world.mission.active) {
      const d = Math.hypot(px - city.hideout.x, pz - city.hideout.z);
      if (d < 25) {
        startMission(world);
      } else {
        world.waypoint = { x: city.hideout.x, z: city.hideout.z };
        showMessage(world, 'MISSION ' + (world.mission.index + 1) + '/8 · ' + def.name + ': go to the hideout — ' + Math.round(d) + ' m. Waypoint set.', 4);
      }
    } else if (def && world.mission.active) {
      const t = missionTarget(world);
      if (t) {
        const d = Math.hypot(px - t.x, pz - t.z);
        world.waypoint = { x: t.x, z: t.z };
        showMessage(world, missionObjectiveText(world) + ' — ' + (t.label || 'target') + ' ' + Math.round(d) + ' m. Waypoint set.', 4);
      } else {
        showMessage(world, missionObjectiveText(world), 3);
      }
    } else {
      showMessage(world, 'All missions complete — Kota Seja is yours, Rico.', 3);
    }
  }

  // ---- traffic
  for (const c of world.cars) {
    if (!c.traffic || c.owner === 'player') continue;
    const ahead = { x: c.x + Math.sin(c.angle) * 6, z: c.z + Math.cos(c.angle) * 6 };
    let blocked = false;
    for (const o of world.cars) {
      if (o !== c && dist2(ahead.x, ahead.z, o.x, o.z) < 9) { blocked = true; break; }
    }
    const pc = playerCar(world);
    if (pc && dist2(ahead.x, ahead.z, pc.x, pc.z) < 9) blocked = true;
    if (!pc && dist2(ahead.x, ahead.z, p.x, p.z) < 6) blocked = true;
    c.speed = clamp(c.speed + (blocked ? -10 : 3) * dt, 0, 11);
    const nx = c.x + Math.sin(c.angle) * c.speed * dt;
    const nz = c.z + Math.cos(c.angle) * c.speed * dt;
    const probe = { x: nx, z: nz };
    if (!resolveBuildingCollision(city, probe, 2.2)) { c.x = nx; c.z = nz; }
    else c.speed = 0;
    // Turn at intersections, keep to the road grid.
    const nearX = city.roadXs.some((rx) => Math.abs(c.x - rx) < 1.2);
    const nearZ = city.roadZs.some((rz) => Math.abs(c.z - rz) < 1.2);
    if ((nearX || nearZ) && world.rng.chance(dt * 0.25)) {
      c.angle += world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      c.dir = c.dir === 'x' ? 'z' : 'x';
    }
    if (c.x < -city.halfX || c.x > city.halfX || c.z < -city.halfZ || c.z > city.halfZ) {
      c.angle += Math.PI;
      c.x = clamp(c.x, -city.halfX + 4, city.halfX - 4);
      c.z = clamp(c.z, -city.halfZ + 4, city.halfZ - 4);
    }
  }
  // The runner in mission 5 flees along the roads.
  if (world.targetCar && !world.mission.finished) {
    const tc = world.targetCar;
    if (tc.health > 0 && world.mission.index === 4 && world.mission.active) {
      tc.speed = clamp(tc.speed + 4 * dt, 0, 16);
      const nx = tc.x + Math.sin(tc.angle) * tc.speed * dt;
      const nz = tc.z + Math.cos(tc.angle) * tc.speed * dt;
      const probe = { x: nx, z: nz };
      if (!resolveBuildingCollision(city, probe, 2.2)) { tc.x = nx; tc.z = nz; }
      if (world.rng.chance(dt * 0.4)) tc.angle += world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      const pc = playerCar(world);
      if (pc && dist2(pc.x, pc.z, tc.x, tc.z) < 12 && Math.abs(pc.speed) > 6) {
        damageCar(world, tc, Math.abs(pc.speed) * dt * 2);
      }
    }
  }
  // Race rivals follow the checkpoints.
  for (const r of world.rivals) {
    if (world.mission.index !== 5 || !world.mission.active) continue;
    const cp = city.raceCheckpoints[Math.min(r.cp, 2)];
    const d = Math.sqrt(dist2(r.x, r.z, cp.x, cp.z));
    const ta = Math.atan2(cp.x - r.x, cp.z - r.z);
    r.angle = angleLerp(r.angle, ta, dt * 1.4);
    r.speed = clamp(r.speed + 10 * dt, 0, 24 + r.id * 0.2);
    r.x += Math.sin(r.angle) * r.speed * dt;
    r.z += Math.cos(r.angle) * r.speed * dt;
    if (d < 11) { r.cp++; r.progress++; }
  }

  // ---- pedestrians
  for (const pd of world.peds) {
    pd.walkPhase += dt * (pd.state === 'flee' ? 14 : 7);
    if (pd.panic > 0) pd.panic -= dt;
    if (pd.state === 'flee' && pd.panic <= 0) pd.state = 'walk';
    const speed = pd.state === 'flee' ? CONFIG.pedRunSpeed : CONFIG.pedWalkSpeed;
    if (!pd.target || dist2(pd.x, pd.z, pd.target.x, pd.target.z) < 4) {
      const np = nearestRoadPoint(city, pd.x + world.rng.range(-60, 60), pd.z + world.rng.range(-60, 60));
      pd.target = np;
    }
    let ta = Math.atan2(pd.target.x - pd.x, pd.target.z - pd.z);
    if (pd.state === 'flee') {
      ta = Math.atan2(pd.x - p.x, pd.z - p.z);
    }
    pd.angle = angleLerp(pd.angle, ta, dt * 6);
    pd.x += Math.sin(pd.angle) * speed * dt;
    pd.z += Math.cos(pd.angle) * speed * dt;
    pd.x = clamp(pd.x, -city.halfX, city.halfX);
    pd.z = clamp(pd.z, -city.halfZ, city.halfZ);
  }

  // ---- enemies shoot back
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = Math.sqrt(dist2(e.x, e.z, p.x, p.z));
    e.angle = Math.atan2(p.x - e.x, p.z - e.z);
    if (d < 40) {
      if (d > 12) {
        e.x += Math.sin(e.angle) * e.speed * dt;
        e.z += Math.cos(e.angle) * e.speed * dt;
      }
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
        e.fireCooldown = world.rng.range(0.9, 2.2);
        if (world.rng.chance(0.45)) hurtPlayer(world, 7, 'enemy');
        spawnParticles(world, e.x, e.z, 2, '#ffd23d');
      }
    }
  }

  // ---- pickups and collectibles
  const px = car ? car.x : p.x, pz = car ? car.z : p.z;
  for (const h of city.healthPickups) {
    if (!h.taken && dist2(px, pz, h.x, h.z) < 4) {
      h.taken = true; healPlayer(world, CONFIG.healthPickupHeal);
      showMessage(world, 'Health +40', 2);
    }
  }
  for (const a of city.armourPickups) {
    if (!a.taken && dist2(px, pz, a.x, a.z) < 4) {
      a.taken = true; p.armour = clamp(p.armour + CONFIG.armourPickupAmount, 0, 100);
      showMessage(world, 'Armour +50', 2);
    }
  }
  for (const col of city.collectibles) {
    if (!col.taken && dist2(px, pz, col.x, col.z) < 4) {
      col.taken = true; world.stats.collectibles++;
      world.money += 100;
      showMessage(world, 'Hidden package found! +$100 (' + world.stats.collectibles + '/10)', 3);
    }
  }

  // ---- wanted decay and police
  if (world.wanted > 0 && world.time - world.lastCrimeAt > CONFIG.wantedCrimeCooldown) {
    world.wantedTimer += dt;
    if (world.wantedTimer >= CONFIG.wantedDecaySeconds) {
      world.wanted--;
      world.wantedTimer = 0;
      showMessage(world, 'The heat is cooling off — wanted ' + world.wanted + ' star' + (world.wanted === 1 ? '' : 's') + '.', 3);
    }
  }
  updatePolice(world, dt);
  if (world.wanted === 0) {
    world.police = world.police.filter((c) => !c.dead);
    if (world.police.length > 0 && world.time - world.lastCrimeAt > 30) world.police = [];
  }

  // ---- particles
  for (const pt of world.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
    pt.vy -= 6 * dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);

  // ---- missions
  updateMission(world, dt, px, pz);
}

function updateMission(world, dt, px, pz) {
  const m = world.mission;
  if (m.index >= CONFIG.missions.length) return;
  // Walking (or driving) up to the hideout starts the next mission:
  // the HUD tells the player to go there, so no extra key is needed.
  if (!m.active) {
    const c = world.city;
    if (dist2(px, pz, c.hideout.x, c.hideout.z) < 100) startMission(world);
    return;
  }
  const c = world.city;
  const t = missionTarget(world);
  m.timer += dt;
  switch (m.index) {
    case 0:
      if (m.stage === 0 && world.player.inCar !== null) { m.stage = 1; showMessage(world, 'Now drive to the hideout.', 3); }
      else if (m.stage === 1 && t && dist2(px, pz, t.x, t.z) < t.r * t.r) completeMission(world);
      break;
    case 1:
      if (m.stage === 0 && t && dist2(px, pz, t.x, t.z) < t.r * t.r) {
        m.stage = 1; showMessage(world, 'Package secured. Deliver it Downtown — no damage!', 3);
      } else if (m.stage === 1 && t && dist2(px, pz, t.x, t.z) < t.r * t.r) {
        if (m.damageTaken > 40) failMission(world, 'the car was too damaged');
        else completeMission(world);
      }
      break;
    case 2:
      if (m.stage === 0 && t && dist2(px, pz, t.x, t.z) < t.r * t.r) {
        m.sub++;
        if (m.sub >= 3) { m.stage = 1; showMessage(world, 'All fares aboard. Drop them off Downtown.', 3); }
        else showMessage(world, 'Fare ' + m.sub + ' picked up.', 2);
      } else if (m.stage === 1 && t && dist2(px, pz, t.x, t.z) < t.r * t.r) {
        world.stats.fares += 3; completeMission(world);
      }
      if (m.timer > 240) failMission(world, 'the fares ran out of time');
      break;
    case 3:
      if (m.stage === 0 && t && dist2(px, pz, t.x, t.z) < t.r * t.r) {
        m.stage = 1; showMessage(world, 'Sabotage in progress — stay in the zone!', 3);
      } else if (m.stage === 1) {
        if (t && dist2(px, pz, t.x, t.z) < t.r * t.r) {
          m.sabotage += dt;
          if (m.sabotage >= 4) completeMission(world);
        } else m.sabotage = Math.max(0, m.sabotage - dt);
      }
      break;
    case 4:
      if (m.stage === 0 && world.targetCar && dist2(px, pz, world.targetCar.x, world.targetCar.z) < 100) {
        m.stage = 1; showMessage(world, 'There he is — ram his car until it stops!', 3);
      } else if (m.stage === 1 && world.targetCar && world.targetCar.health <= 0) {
        completeMission(world);
      }
      if (m.timer > 180) failMission(world, 'the runner got away');
      break;
    case 5: {
      const pc = playerCar(world);
      if (pc && t && dist2(pc.x, pc.z, t.x, t.z) < t.r * t.r) {
        m.checkpoints++;
        if (m.checkpoints >= 3) {
          const rivalBest = Math.max(...world.rivals.map((r) => r.progress));
          if (m.checkpoints >= rivalBest) completeMission(world);
          else failMission(world, 'a rival finished first');
        } else showMessage(world, 'Checkpoint ' + m.checkpoints + '/3!', 2);
      }
      if (m.timer > 200) failMission(world, 'the race timed out');
      break;
    }
    case 6:
      if (t && dist2(px, pz, t.x, t.z) < t.r * t.r) {
        m.collected++;
        showMessage(world, 'Package ' + m.collected + '/5 collected!', 2);
        if (m.collected >= 5) completeMission(world);
      }
      if (world.clockHours >= 5.5 && world.clockHours < 17.6) failMission(world, 'dawn broke');
      if (m.timer > 300) failMission(world, 'dawn broke');
      break;
    case 7:
      if (m.stage === 0 && t && dist2(px, pz, t.x, t.z) < t.r * t.r) {
        m.stage = 1; showMessage(world, 'Hold the hideout — clear the attackers!', 3);
      } else if (m.stage === 1) {
        const alive = world.enemies.filter((e) => !e.dead).length;
        if (alive === 0) {
          m.capture += dt;
          if (m.capture >= 3) completeMission(world);
        }
      }
      break;
    default: break;
  }
}

// ------------------------------------------------------------------ save/load
export function serialize(world) {
  return JSON.stringify({
    money: world.money, respect: world.respect, debtPaid: world.debtPaid,
    day: world.day, clockHours: world.clockHours,
    missionIndex: world.mission.index,
    // Round 7 — the Halcyon settings ride along with the save: camera
    // mode, radio station and headlight mode survive a quit/reload.
    settings: world.settings,
    player: { x: world.player.x, z: world.player.z, health: world.player.health, armour: world.player.armour, weapon: world.player.weapon, owned: world.player.owned, ammo: world.player.ammo, reserve: world.player.reserve },
    stats: world.stats,
    collectibles: world.city.collectibles.filter((c) => c.taken).map((c) => c.id),
  });
}

export function deserialize(world, json) {
  try {
    const s = JSON.parse(json);
    world.money = s.money ?? world.money;
    world.respect = s.respect ?? 0;
    world.debtPaid = s.debtPaid ?? 0;
    world.day = s.day ?? 1;
    world.clockHours = s.clockHours ?? CONFIG.dayStartHours;
    world.mission.index = s.missionIndex ?? 0;
    // Round 7 — restore settings, but only values the game knows:
    // a hand-edited or older save must never smuggle in a bad mode.
    if (s.settings && typeof s.settings === 'object') {
      if (CONFIG.camModes.includes(s.settings.camMode)) world.settings.camMode = s.settings.camMode;
      if (Number.isInteger(s.settings.station) && s.settings.station >= 0 && s.settings.station < CONFIG.radioStations.length) world.settings.station = s.settings.station;
      if (CONFIG.lightsModes.includes(s.settings.lights)) world.settings.lights = s.settings.lights;
    }
    if (s.player) {
      Object.assign(world.player, {
        x: s.player.x, z: s.player.z, health: s.player.health,
        armour: s.player.armour, weapon: s.player.weapon,
      });
      if (s.player.owned) world.player.owned = s.player.owned;
      if (s.player.ammo) world.player.ammo = s.player.ammo;
      if (s.player.reserve) world.player.reserve = s.player.reserve;
    }
    if (s.stats) world.stats = s.stats;
    if (Array.isArray(s.collectibles)) {
      for (const id of s.collectibles) {
        const c = world.city.collectibles[id];
        if (c) c.taken = true;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Round 7 complete (2026-11-19): Halcyon contextual A/B (MASUK /
// KELUAR / AMBIL / MULAI / SERANG + TEMBAK / PUKUL / KLAKSON), horn
// with pedestrian reaction, full day/night phase + auto headlights,
// saved settings (camera / station / lights), NPC variety
// (hair, pants, accessories, height). Unit tests in tests-r7.
