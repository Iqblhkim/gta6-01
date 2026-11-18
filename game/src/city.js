// Procedural city data (pure — no THREE, no DOM). Same seed => same city.
// Layout: 9 vertical roads x 7 horizontal roads, pitch 50, road width 14.
// Blocks between roads hold 1-3 pastel low-poly buildings; 3 blocks are parks.
// Beach strip along the south edge, harbour docks along the east edge.
import { BLOCK, BOUNDS, CAR_MODELS, DISTRICTS, HQ, PALETTE, PITCH, ROAD_W, ROAD_X, ROAD_Z, SEED, TOTAL_CARS, districtAt } from './config.js';
import { makeRng } from './random.js';

const PARK_BLOCKS = [[2, 1], [5, 3], [3, 4]]; // [col,row] of blocks that are parks
const BEACH = { x0: -225, z0: 158, x1: -25, z1: 195 };
const SEA = { x0: -225, z0: 195, x1: 245, z1: 320 };
const DOCKS = { x0: 208, z0: -25, x1: 245, z1: 150 };
const SEA_EAST = { x0: 245, z0: -175, x1: 340, z1: 320 };

// Ground-floor shop fronts (Old Quarter / Beachfront shophouses).
const SHOP_SIGNS = ['TACOS', 'KOPI', 'BARBER', 'LAUNDRY', 'WARUNG', 'CAFE', 'TOKO', 'PHARMACY', 'BAKERY', 'PIZZA', 'SURF', 'HOTEL'];
const AWNING_COLORS = [0xff5a3c, 0x2ec4b6, 0xffd166, 0xff8fa3, 0x4fc3f7, 0x8fd694];

function isPark(col, row) {
  return PARK_BLOCKS.some(([c, r]) => c === col && r === row);
}

export function buildCity(seed = SEED) {
  const rng = makeRng(seed);
  const buildings = [];
  const sidewalks = [];
  const palms = [];
  const parkTrees = [];

  // Blocks: 8 cols x 6 rows. Block centre = between two roads.
  for (let col = 0; col < 8; col += 1) {
    for (let row = 0; row < 6; row += 1) {
      const cx = ROAD_X[col] + PITCH / 2;
      const cz = ROAD_Z[row] + PITCH / 2;
      sidewalks.push({ x: cx, z: cz, w: BLOCK + 2, d: BLOCK + 2 });
      if (isPark(col, row)) {
        for (let t = 0; t < 7; t += 1) {
          parkTrees.push({ x: cx + rng.range(-14, 14), z: cz + rng.range(-14, 14), s: rng.range(0.9, 1.4) });
        }
        continue;
      }
      // Subdivide the block into a 2x2 grid of plots; each plot may hold a building.
      // Architecture is district-driven — no single repeated box template:
      // Downtown = tall glass towers (stepped setbacks), Old Quarter = low
      // brick shophouses, Beachfront = pastel hotels with balconies,
      // Harbour = wide low warehouses. Heights, floors, roof kit and shop
      // fronts are all per-building so the skyline reads from afar.
      for (const [ox, oz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
        if (!rng.chance(0.62)) continue;
        const d = districtAt(cx, cz);
        let style; let h;
        if (d.name === 'Downtown') { style = 'glass'; h = rng.range(18, 42); }
        else if (d.name === 'Old Quarter') { style = 'brick'; h = rng.range(7, 13); }
        else if (d.name === 'Beachfront') { style = 'hotel'; h = rng.range(10, 18); }
        else { style = 'warehouse'; h = rng.range(6, 10); }
        const floors = Math.max(1, Math.round(h / 3.2));
        const w = style === 'warehouse' ? rng.range(12, 17) : rng.range(10, 15);
        const dep = style === 'warehouse' ? rng.range(12, 17) : rng.range(10, 15);
        const roof = style === 'glass'
          ? rng.pick(['antenna', 'ac', 'antenna', 'sign'])
          : style === 'brick'
            ? rng.pick(['tank', 'ac', 'tank', 'none'])
            : style === 'hotel'
              ? rng.pick(['sign', 'ac', 'ac', 'antenna'])
              : rng.pick(['vent', 'vent', 'ac', 'none']);
        // Tall glass towers step in toward the top (setback tiers).
        const tier = style === 'glass' && h >= 25 ? rng.int(1, 2) : 0;
        // Low buildings facing the street can be shops: awning + sign +
        // glowing storefront at dusk.
        const shop = h <= 14 && rng.chance(0.5)
          ? { text: rng.pick(SHOP_SIGNS), awning: rng.pick(AWNING_COLORS) }
          : null;
        // Fraction of windows lit warm at sunset (drives the texture variant).
        const winLit = rng.range(0.25, 0.85);
        buildings.push({
          x: cx + ox + rng.range(-1.5, 1.5),
          z: cz + oz + rng.range(-1.5, 1.5),
          w, d: dep, h,
          color: rng.pick(PALETTE), district: d.name,
          style, floors, roof, tier, shop, winLit,
        });
      }
    }
  }
  // HQ building (taller, distinct) on the Downtown corner block.
  buildings.push({ x: HQ.x, z: HQ.z, w: 16, d: 14, h: 24, color: 0xff5a3c, district: 'Downtown', style: 'glass', floors: 7, roof: 'antenna', tier: 1, shop: null, winLit: 0.7 });

  // Palms along the beach strip and a few sidewalks.
  for (let x = -210; x <= -40; x += 24) palms.push({ x: x + rng.range(-4, 4), z: 166 + rng.range(-4, 4), s: rng.range(1, 1.5) });
  for (let i = 0; i < 26; i += 1) {
    const col = rng.int(0, 7); const row = rng.int(0, 5);
    palms.push({ x: ROAD_X[col] + PITCH / 2 + rng.range(-16, 16), z: ROAD_Z[row] + PITCH / 2 + rng.range(-16, 16), s: rng.range(0.8, 1.2) });
  }

  // Street props — the details that make a block feel lived-in instead of
  // empty: lamps along every road, hydrants, benches + planters in the
  // parks and along the beachfront, bins near the shops.
  const props = [];
  for (const x of ROAD_X) {
    for (let z = ROAD_Z[0] + 25; z < ROAD_Z[ROAD_Z.length - 1]; z += 100) {
      props.push({ kind: 'lamp', x: x - ROAD_W / 2 - 1.6, z, angle: 0 });
      props.push({ kind: 'lamp', x: x + ROAD_W / 2 + 1.6, z: z + 50, angle: Math.PI });
    }
  }
  for (let i = 0; i < 10; i += 1) {
    const ix = ROAD_X[rng.int(0, 8)]; const iz = ROAD_Z[rng.int(0, 6)];
    props.push({ kind: 'hydrant', x: ix + ROAD_W / 2 + 2.2, z: iz + ROAD_W / 2 + 2.2, angle: rng.range(0, Math.PI * 2) });
  }
  for (let i = 0; i < 10; i += 1) {
    const ix = ROAD_X[rng.int(0, 8)]; const iz = ROAD_Z[rng.int(0, 6)];
    props.push({ kind: 'bin', x: ix - ROAD_W / 2 - 2.2, z: iz - ROAD_W / 2 - 2.2, angle: rng.range(0, Math.PI * 2) });
  }
  const parks = PARK_BLOCKS.map(([c, r]) => ({ x: ROAD_X[c] + PITCH / 2, z: ROAD_Z[r] + PITCH / 2 }));
  for (const pk of parks) {
    props.push({ kind: 'bench', x: pk.x - 8, z: pk.z - 4, angle: 0 });
    props.push({ kind: 'bench', x: pk.x + 8, z: pk.z + 4, angle: Math.PI });
    props.push({ kind: 'planter', x: pk.x - 8, z: pk.z + 6, angle: 0 });
    props.push({ kind: 'planter', x: pk.x + 8, z: pk.z - 6, angle: 0 });
  }
  for (let x = -200; x <= -50; x += 30) {
    props.push({ kind: 'bench', x: x + rng.range(-3, 3), z: 164 + rng.range(-2, 2), angle: Math.PI });
    props.push({ kind: 'planter', x: x + 15 + rng.range(-3, 3), z: 164 + rng.range(-2, 2), angle: 0 });
  }
  for (let i = 0; i < 8; i += 1) {
    const col = rng.int(0, 3); const row = rng.int(0, 2);
    props.push({ kind: 'planter', x: ROAD_X[col] + PITCH / 2 + rng.range(-16, 16), z: ROAD_Z[row] + PITCH / 2 + rng.range(-16, 16), angle: 0 });
  }

  // Traffic lights + zebra crossings at every other intersection.
  const lights = [];
  const zebras = [];
  for (let i = 0; i < ROAD_X.length; i += 1) {
    for (let j = 0; j < ROAD_Z.length; j += 1) {
      if ((i + j) % 2 === 0) lights.push({ x: ROAD_X[i] + ROAD_W / 2 + 1, z: ROAD_Z[j] - ROAD_W / 2 - 1 });
      zebras.push({ x: ROAD_X[i], z: ROAD_Z[j] - ROAD_W / 2 - 2, axis: 'x' });
      zebras.push({ x: ROAD_X[i] + ROAD_W / 2 + 2, z: ROAD_Z[j], axis: 'z' });
    }
  }

  // Centre dashes along every road (rendered as instanced strips).
  const dashes = [];
  for (const x of ROAD_X) for (let z = ROAD_Z[0]; z < ROAD_Z[ROAD_Z.length - 1]; z += 10) dashes.push({ x, z, axis: 'z' });
  for (const z of ROAD_Z) for (let x = ROAD_X[0]; x < ROAD_X[ROAD_X.length - 1]; x += 10) dashes.push({ x, z, axis: 'x' });

  // Cars: 32 parked along road edges, 12 in traffic.
  // Heading convention: forward = (sin a, cos a); mesh local +z is the front.
  // Parked along a vertical road (constant x) => angle 0/PI; horizontal => +/-PI/2.
  const cars = [];
  for (let n = 0; n < TOTAL_CARS; n += 1) {
    const model = rng.pick(CAR_MODELS);
    const parked = n < 32;
    if (parked) {
      const vertical = rng.chance(0.5);
      const road = vertical ? rng.pick(ROAD_X) : rng.pick(ROAD_Z);
      const along = rng.range(-190, 190);
      const side = rng.chance(0.5) ? 1 : -1;
      cars.push({
        id: n, model: model.type, color: model.color,
        x: vertical ? road + side * (ROAD_W / 2 - 2.5) : along,
        z: vertical ? along : road + side * (ROAD_W / 2 - 2.5),
        angle: vertical ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2),
        parked: true, traffic: false, speed: 0,
      });
    } else {
      const vertical = rng.chance(0.5);
      const road = vertical ? rng.pick(ROAD_X) : rng.pick(ROAD_Z);
      const dir = rng.chance(0.5) ? 1 : -1;
      cars.push({
        id: n, model: model.type, color: model.color,
        x: vertical ? road : rng.range(-190, 190),
        z: vertical ? rng.range(-140, 140) : road,
        angle: vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
        parked: false, traffic: true, speed: rng.range(7, 11),
      });
    }
  }

  // Pedestrians: 48 people on the sidewalks, varied (shirt, height, walk speed).
  // 12 of them are "crossers": they use the zebra crossings to get across a road.
  // Appearance is per-person so the crowd reads as individuals, not clones:
  // skin tone, hair colour + style, trousers.
  const PED_SHIRTS = [0x4fc3f7, 0xffd166, 0x8fd694, 0xff8fa3, 0xf9c784, 0xe07a5f, 0xff6b9d, 0x2ec4b6, 0xf4f1de, 0x9b5de5];
  const PED_SKINS = [0xd9a066, 0xc98a5a, 0xe8b88a, 0x8a5a3b, 0xf0c8a0, 0x6b4423];
  const PED_HAIRS = [0x1a1210, 0x3a2a1a, 0x6b6b6b, 0x8a5a2a, 0xd9b380, 0x2a2a2a];
  const PED_PANTS = [0x2a2f45, 0x1e2a52, 0x3a3a3a, 0x5a3a2a, 0x2a4a3a, 0x4a2a3a];
  const peds = [];
  for (let i = 0; i < 48; i += 1) {
    const col = rng.int(0, 7); const row = rng.int(0, 5);
    const cross = i < 12;
    let crossEnds = null;
    if (cross) {
      // Pick a nearby zebra crossing; endpoints on both sidewalks across the road.
      const zx = ROAD_X[rng.int(0, 8)]; const zz = ROAD_Z[rng.int(0, 6)];
      if (rng.chance(0.5)) crossEnds = [{ x: zx - 9, z: zz }, { x: zx + 9, z: zz }];
      else crossEnds = [{ x: zx, z: zz - 9 }, { x: zx, z: zz + 9 }];
    }
    peds.push({
      x: ROAD_X[col] + PITCH / 2 + rng.range(-15, 15),
      z: ROAD_Z[row] + PITCH / 2 + rng.range(-15, 15),
      angle: rng.range(0, Math.PI * 2),
      shirt: rng.pick(PED_SHIRTS),
      height: rng.range(0.88, 1.16),
      speed: rng.range(1.2, 2.4),
      cross: crossEnds,
      skin: rng.pick(PED_SKINS),
      hair: rng.pick(PED_HAIRS),
      hairStyle: rng.pick(['cap', 'flat', 'curly', 'bald']),
      pants: rng.pick(PED_PANTS),
    });
  }

  // 10 collectibles in hidden corners: alleys, beach, docks, parks.
  const collectibles = [
    { x: -190, z: -140 }, { x: -40, z: -140 }, { x: 190, z: -140 },
    { x: -190, z: 140 }, { x: -60, z: 170 }, { x: 220, z: 130 },
    { x: 60, z: -30 }, { x: -130, z: -30 }, { x: 130, z: 60 }, { x: 20, z: 120 },
  ];

  // 3 stunt jumps on long straights.
  const jumps = [
    { x: -100, z: 0, angle: 0 }, { x: 50, z: -100, angle: Math.PI / 2 }, { x: 100, z: 100, angle: Math.PI },
  ];

  // Taxi stands + health/armour pickups.
  const taxiStands = [{ x: -175, z: 20 }, { x: 25, z: -125 }, { x: 175, z: 120 }];
  const pickups = [
    { kind: 'health', x: -170, z: -120 }, { kind: 'armour', x: 170, z: -120 },
    { kind: 'health', x: -170, z: 130 }, { kind: 'armour', x: 130, z: 130 },
    { kind: 'health', x: 30, z: 20 }, { kind: 'armour', x: -30, z: 70 },
  ];

  // Harbour containers.
  const containers = [];
  for (let i = 0; i < 14; i += 1) {
    containers.push({ x: 214 + rng.range(0, 24), z: -10 + i * 11 + rng.range(-3, 3), color: rng.pick(PALETTE), angle: rng.chance(0.5) ? 0 : Math.PI / 2 });
  }

  return {
    seed, buildings, sidewalks, palms, parkTrees, lights, zebras, dashes,
    cars, peds, collectibles, jumps, taxiStands, pickups, containers,
    beach: BEACH, sea: SEA, docks: DOCKS, seaEast: SEA_EAST, bounds: BOUNDS,
    props, parks,
  };
}

/** Circle (x,z,r) vs building AABBs: push the circle out, return corrected {x,z}. */
export function collideBuildings(city, x, z, r) {
  for (const b of city.buildings) {
    const hx = b.w / 2 + r; const hz = b.d / 2 + r;
    const dx = x - b.x; const dz = z - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      const px = hx - Math.abs(dx); const pz = hz - Math.abs(dz);
      if (px < pz) x = b.x + Math.sign(dx || 1) * hx;
      else z = b.z + Math.sign(dz || 1) * hz;
    }
  }
  return { x, z };
}

export function clampBounds(x, z, r) {
  return {
    x: Math.min(BOUNDS.x1 - r, Math.max(BOUNDS.x0 + r, x)),
    z: Math.min(BOUNDS.z1 - r, Math.max(BOUNDS.z0 + r, z)),
  };
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx; const dz = az - bz;
  return dx * dx + dz * dz;
}
