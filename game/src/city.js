// Kota Seja — deterministic procedural city generation.
// One seed builds the same island city every time: a 9x7 block grid with
// four districts, a beach on the south shore, a harbour on the east,
// ~100 low-poly buildings, palms, lamps, crosswalks, and all the anchor
// points the missions, collectibles and pickups need.
import { CONFIG } from './config.js';
import { makeRng } from './random.js';

const PASTEL = ['#f2a65a', '#f27d7d', '#f7d774', '#8ecb7d', '#7fb8d9', '#e58bb1', '#c9a7e8', '#f5e6c8'];
const ROOFS = ['#7a4a2b', '#5d3a4e', '#3e5c4b', '#31435c'];
const CAR_COLOURS = ['#d94f3d', '#3d7dd9', '#e8c33d', '#3dd9a0', '#e8e8e8', '#2b2b33', '#c95fd9', '#f08a2d', '#7dd93d', '#d9d9d9'];

export function roadLines() {
  // Centre lines of the vertical and horizontal streets.
  const pitch = CONFIG.pitch;
  const xs = [];
  const zs = [];
  for (let i = 0; i <= CONFIG.blocksX; i++) xs.push((i - CONFIG.blocksX / 2) * pitch);
  for (let j = 0; j <= CONFIG.blocksZ; j++) zs.push((j - CONFIG.blocksZ / 2) * pitch);
  return { xs, zs };
}

export function buildCity(seed = CONFIG.seed) {
  const rng = makeRng(seed);
  const { xs, zs } = roadLines();
  const halfX = (CONFIG.blocksX / 2) * CONFIG.pitch;
  const halfZ = (CONFIG.blocksZ / 2) * CONFIG.pitch;
  const city = {
    seed,
    halfX,
    halfZ,
    buildings: [],
    palms: [],
    lamps: [],
    crosswalks: [],
    roadXs: xs,
    roadZs: zs,
    beach: { z0: halfZ - 26, z1: halfZ + 34 },
    harbour: { x0: halfX - 8, x1: halfX + 40 },
    hideout: { x: -12, z: 96 },
    warehouse: { x: 160, z: -52 },
    downtownDrop: { x: 24, z: -118 },
    beachfront: { x: -96, z: 132 },
    oldQuarter: { x: -150, z: -30 },
    raceCheckpoints: [
      { x: -180, z: -120 },
      { x: 60, z: 30 },
      { x: -40, z: 140 },
    ],
    collectorSpots: [],
    collectibles: [],
    stuntJumps: [
      { x: -104, z: 52, angle: 0 },
      { x: 104, z: -52, angle: Math.PI / 2 },
      { x: 0, z: 156, angle: 0 },
    ],
    healthPickups: [],
    armourPickups: [],
    spawn: { x: -12, z: 84, angle: Math.PI },
  };

  // Buildings: one to four per block, skipping the park block in the
  // middle-west, the plaza in front of the hideout, and the beach strip.
  const parkBlock = { bx: 1, bz: 3 };
  const plazaBlock = { bx: 4, bz: 5 };
  for (let bx = 0; bx < CONFIG.blocksX; bx++) {
    for (let bz = 0; bz < CONFIG.blocksZ; bz++) {
      const cx = (bx - CONFIG.blocksX / 2 + 0.5) * CONFIG.pitch;
      const cz = (bz - CONFIG.blocksZ / 2 + 0.5) * CONFIG.pitch;
      if (bx === parkBlock.bx && bz === parkBlock.bz) continue; // park
      if (bx === plazaBlock.bx && bz === plazaBlock.bz) continue; // hideout plaza
      if (cz > city.beach.z0 - 10) continue; // beachfront: no towers on the sand
      if (bx >= 8) continue; // harbour docks: warehouses instead
      const downtown = Math.abs(cx) < 80 && cz < -40;
      const count = downtown ? rng.int(2, 4) : rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        const w = rng.range(9, 16);
        const d = rng.range(9, 16);
        const ox = rng.range(-10, 10);
        const oz = rng.range(-10, 10);
        const h = downtown ? rng.range(16, 42) : rng.range(6, 18);
        city.buildings.push({
          x: cx + ox, z: cz + oz, w, d, h,
          color: rng.pick(PASTEL),
          roof: rng.pick(ROOFS),
          windows: rng.int(2, 5),
        });
      }
    }
  }
  // Harbour warehouses: long low sheds on the east docks, centred on blocks.
  for (let i = 0; i < 5; i++) {
    city.buildings.push({
      x: 160, z: [-156, -104, -52, 0, 52][i], w: 22, d: 34, h: 9,
      color: i === 2 ? '#c96a4a' : '#9aa5ad', roof: '#31435c', windows: 1, warehouse: true,
    });
  }
  // Beachfront hotels: tall pastel slabs facing the sand, centred on blocks.
  for (let i = 0; i < 4; i++) {
    city.buildings.push({
      x: [-156, -52, 52, 156][i], z: city.beach.z0 - 40, w: 20, d: 14, h: rng.range(18, 28),
      color: PASTEL[(i * 3 + 1) % PASTEL.length], roof: ROOFS[i % ROOFS.length], windows: 5,
    });
  }

  // Palms: along the beach and scattered through the park and plazas.
  for (let i = 0; i < 46; i++) {
    const onBeach = i < 26;
    city.palms.push({
      x: onBeach ? rng.range(-halfX + 8, halfX - 8) : rng.range(-halfX, halfX),
      z: onBeach ? rng.range(city.beach.z0 + 2, city.beach.z1 - 4)
        : rng.range(-halfZ, halfZ),
      h: rng.range(5, 8),
      lean: rng.range(-0.12, 0.12),
    });
  }
  // Street lamps at every other intersection, crosswalks at every one.
  for (const x of xs) {
    for (const z of zs) {
      city.crosswalks.push({ x, z });
      if ((Math.round(x / CONFIG.pitch) + Math.round(z / CONFIG.pitch)) % 2 === 0) {
        city.lamps.push({ x: x + 7, z: z + 7 });
      }
    }
  }
  // Collector package spots: five spread-out landmarks.
  city.collectorSpots = [
    { x: -200, z: -150 }, { x: 180, z: -150 }, { x: -200, z: 150 },
    { x: 150, z: 120 }, { x: 0, z: -170 },
  ];
  // Ten hidden collectibles: rooftops, alleys, the pier and the park.
  const coll = [
    [-150, -130], [90, -160], [-210, 30], [200, 40], [-30, -160],
    [150, 150], [-190, 150], [30, 60], [-90, -60], [210, -120],
  ];
  city.collectibles = coll.map(([x, z], i) => ({ id: i, x, z, taken: false }));
  // Pickups: health crosses near the park and beach, armour near the docks.
  city.healthPickups = [
    { x: -160, z: 40, taken: false }, { x: 40, z: 140, taken: false },
    { x: -40, z: -80, taken: false }, { x: 180, z: 80, taken: false },
  ];
  city.armourPickups = [
    { x: 190, z: -40, taken: false }, { x: -120, z: -140, taken: false },
    { x: 90, z: 150, taken: false },
  ];
  return city;
}

// True when (x, z) is on a road (within the road half-width of a street).
export function onRoad(city, x, z) {
  const hw = CONFIG.roadWidth / 2 + 1;
  for (const rx of city.roadXs) if (Math.abs(x - rx) < hw) return true;
  for (const rz of city.roadZs) if (Math.abs(z - rz) < hw) return true;
  return false;
}

// Nearest point on the road grid (used to snap traffic and pedestrians).
export function nearestRoadPoint(city, x, z) {
  let bx = city.roadXs[0];
  for (const rx of city.roadXs) if (Math.abs(rx - x) < Math.abs(bx - x)) bx = rx;
  let bz = city.roadZs[0];
  for (const rz of city.roadZs) if (Math.abs(rz - z) < Math.abs(bz - z)) bz = rz;
  return Math.abs(bx - x) < Math.abs(bz - z) ? { x: bx, z } : { x, z: bz };
}

// Circle vs building AABBs: returns the building hit, or null.
export function buildingHit(city, x, z, r) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps; returns true on a hit.
export function resolveBuildingCollision(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const px = b.w / 2 + r - Math.abs(dx);
    const pz = b.d / 2 + r - Math.abs(dz);
    if (px > 0 && pz > 0) {
      hit = true;
      if (px < pz) p.x = b.x + Math.sign(dx || 1) * (b.w / 2 + r);
      else p.z = b.z + Math.sign(dz || 1) * (b.d / 2 + r);
    }
  }
  return hit;
}

export function carColour(rng) {
  return rng.pick(CAR_COLOURS);
}

export { CAR_COLOURS };
