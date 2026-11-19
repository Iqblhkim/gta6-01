// Kota Seja — deterministic procedural city generation.
// One seed builds the same island city every time: a 9x7 block grid with
// four districts, a beach on the south shore, a harbour on the east,
// ~100 low-poly buildings, palms, lamps, crosswalks, and all the anchor
// points the missions, collectibles and pickups need.
// Round 7 (2026-11-19): buildings now carry a DISTRICT TYPE
// (packet 7), ROOF DETAILS (packet 8) and the city gains a LANDMARK
// tower (packet 9), parks with flowers (packet 13) and street props
// — hydrants, signs, bins, benches, bus stops (packet 12) — all
// planted off the roads and out of the buildings, like the round-6
// palms. The zebra crossings (packet 10) are drawn by the renderer
// from city.crosswalks; the bands sit on the roads, so the onRoad
// guard below already keeps every tree, palm and prop off them.
import { CONFIG, districtAt } from './config.js';
import { makeRng } from './random.js';

const PASTEL = ['#f2a65a', '#f27d7d', '#f7d774', '#8ecb7d', '#7fb8d9', '#e58bb1', '#c9a7e8', '#f5e6c8'];
const ROOFS = ['#7a4a2b', '#5d3a4e', '#3e5c4b', '#31435c'];
// Round 6 (packet 13) — LAS VEGAS neon, visual style ONLY (no
// gambling anywhere: no slots, no tables, no betting). Hot pinks,
// cyans and golds for roof strips, corner tubes and glowing sign
// panels. Sign names are fictional entertainment venues.
const NEON_COLORS = ['#ff2e88', '#00e5ff', '#ffd23d', '#ff7b2d', '#c95fd9', '#37d67a'];
const NEON_SIGNS = ['SEJA LIVE', 'PALM STAGE', 'NEON NIGHTS', 'SUNSET CLUB', 'MANGO BAR', 'DISCO SOL', 'CINE SEJA', 'KARAOKE'];
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
    trafficLights: [],
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
      if (bx === 4 && bz === 1) continue; // round 7: landmark tower block
      if (cz > city.beach.z0 - 10) continue; // beachfront: no towers on the sand
      if (bx >= 8) continue; // harbour docks: warehouses instead
      const downtown = Math.abs(cx) < 80 && cz < -40;
      // Round 7 (packet 7) — DISTRICT BUILDING TYPES: a block reads
      // its district and rolls a type from it, so Downtown is tall
      // apartments + glass offices, the Old Quarter is low shophouses
      // (ruko) with awnings, and the outskirts are small houses with
      // pitched roofs. Same block, same seed, same type every load.
      const district = districtAt(cx, cz);
      const type = district === 'Downtown'
        ? rng.weightedPick([['apartemen', 0.55], ['kantor', 0.3], ['ruko', 0.15]])
        : district === 'Old Quarter'
          ? rng.weightedPick([['ruko', 0.65], ['rumah', 0.25], ['apartemen', 0.1]])
          : district === 'Harbour'
            ? rng.weightedPick([['gudang', 0.4], ['ruko', 0.35], ['apartemen', 0.25]])
            : rng.weightedPick([['apartemen', 0.45], ['rumah', 0.35], ['ruko', 0.2]]);
      const count = downtown ? rng.int(2, 4) : rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        // Silhouette per type: offices are the tallest and widest,
        // apartments step down from the core, shophouses stay low and
        // narrow, houses are the smallest. Round 7 (packet 9) —
        // SKYLINE FALLOFF: Downtown heights shrink with distance from
        // the core (15, -105), so the skyline peaks in the centre and
        // steps down toward the beach and the harbour.
        const coreDist = Math.hypot(cx - 15, cz + 105);
        const falloff = downtown ? Math.max(0.55, 1 - coreDist / 420) : 1;
        let w, d, h;
        if (type === 'kantor') { w = rng.range(12, 18); d = rng.range(12, 18); h = rng.range(22, 48) * falloff; }
        else if (type === 'apartemen') { w = rng.range(9, 16); d = rng.range(9, 16); h = (downtown ? rng.range(16, 42) : rng.range(8, 18)) * falloff; }
        else if (type === 'ruko') { w = rng.range(8, 12); d = rng.range(8, 12); h = rng.range(6, 11); }
        else if (type === 'gudang') { w = rng.range(14, 20); d = rng.range(12, 18); h = rng.range(7, 10); }
        else { w = rng.range(8, 11); d = rng.range(8, 11); h = rng.range(5, 8); } // rumah
        h = Math.round(h * 10) / 10;
        const ox = rng.range(-10, 10);
        const oz = rng.range(-10, 10);
        // Round 6 — facades: a real window grid (not one glowing
        // strip), a ground-floor door, and sometimes a canopy or a
        // balcony. winLit is one lit/unlit bit per window — about half
        // the glass glows warm at dusk, the rest stays dark.
        const winCols = type === 'kantor' ? 5 : Math.max(2, Math.min(4, Math.floor(w / 4.5)));
        const winFloors = Math.max(1, Math.min(9, Math.floor(h / 4.2)));
        const winLit = [];
        for (let wi = 0; wi < winCols * winFloors; wi++) winLit.push(rng.chance(type === 'kantor' ? 0.6 : 0.45));
        // Round 6 (packet 13): Vegas neon — downtown towers usually
        // glow, smaller blocks sometimes do. Style: a hot strip along
        // the roof edge, neon tubes down the front corners, or a
        // glowing sign panel (fictional venue name, data only — the
        // renderer draws the lit panel, not text).
        const neonChance = h >= 16 ? 0.7 : 0.22;
        const neon = rng.chance(neonChance)
          ? { color: rng.pick(NEON_COLORS), style: rng.pick(['top', 'corners', 'sign']), sign: null }
          : null;
        if (neon && neon.style === 'sign') neon.sign = rng.pick(NEON_SIGNS);
        // Round 7 (packet 8) — ROOF DETAILS: every building rolls its
        // own rooftop kit — AC units, a water tank, an antenna, a
        // chimney (houses mostly), a parapet rim. The renderer draws
        // them as a few merged boxes on the roof slab, so they read
        // from the street AND from the top-down camera (packet 3).
        const roofDetail = {
          ac: type === 'kantor' ? rng.int(1, 3) : rng.int(0, 2),
          tank: rng.chance(type === 'apartemen' ? 0.45 : 0.25),
          antenna: rng.chance(type === 'kantor' ? 0.6 : 0.3),
          chimney: rng.chance(type === 'rumah' ? 0.6 : 0.08),
          parapet: rng.chance(type === 'rumah' ? 0.15 : 0.7),
        };
        city.buildings.push({
          x: cx + ox, z: cz + oz, w, d, h,
          type,
          glass: type === 'kantor',
          roofType: type === 'rumah' ? 'pitched' : 'flat',
          roofDetail,
          color: type === 'kantor' ? rng.pick(['#7fb8d9', '#9fd0e8', '#6a9fd0']) : rng.pick(PASTEL),
          roof: rng.pick(ROOFS),
          windows: rng.int(2, 5),
          winCols, winFloors, winLit,
          doorDx: rng.range(-w / 4, w / 4),
          doorFace: rng.chance(0.5) ? 1 : -1, // +z or -z face
          canopy: type === 'ruko' ? rng.chance(0.8) : rng.chance(0.5),
          balcony: h >= 14 && rng.chance(0.45),
          neon,
        });
      }
    }
  }
  // Round 7 (packet 9) — LANDMARK TOWER: the tallest building in Kota
  // Seja, a gold-and-glass tower on the Downtown core block (0, -104)
  // with a helipad on the roof and a red beacon on top. Visible from
  // the beach, the bridge and the harbour; the minimap draws a star
  // on it and the renderer gives it a glowing crown at night.
  const landmark = {
    x: 0, z: -104, w: 20, d: 20, h: CONFIG.landmarkHeight,
    type: 'landmark', glass: true, roofType: 'flat',
    roofDetail: { ac: 2, tank: false, antenna: true, chimney: false, parapet: true },
    color: '#e8b04a', roof: '#31435c', windows: 5,
    winCols: 5, winFloors: 12,
    winLit: Array.from({ length: 60 }, (_, i) => i % 3 !== 0),
    doorDx: 0, doorFace: 1, canopy: true, balcony: false,
    neon: { color: '#ffd23d', style: 'top', sign: null },
    helipad: true, beacon: true,
  };
  city.buildings.push(landmark);
  city.landmark = { x: landmark.x, z: landmark.z, h: landmark.h };
  // Harbour warehouses: long low sheds on the east docks, centred on blocks.
  for (let i = 0; i < 5; i++) {
    city.buildings.push({
      x: 160, z: [-156, -104, -52, 0, 52][i], w: 22, d: 34, h: 9,
      type: 'gudang', glass: false, roofType: 'flat',
      roofDetail: { ac: 1, tank: false, antenna: i === 2, chimney: false, parapet: false },
      color: i === 2 ? '#c96a4a' : '#9aa5ad', roof: '#31435c', windows: 1, warehouse: true,
      // Round 6 facade data (same shape as the city buildings).
      winCols: 4, winFloors: 1, winLit: [true, false, true, false],
      doorDx: 0, doorFace: 1, canopy: true, balcony: false,
      neon: null, // the docks stay industrial — no neon out here
    });
  }
  // Beachfront hotels: tall pastel slabs facing the sand, centred on blocks.
  for (let i = 0; i < 4; i++) {
    const hh = rng.range(18, 28);
    const winFloors = Math.max(1, Math.min(9, Math.floor(hh / 4.2)));
    const winLit = [];
    for (let wi = 0; wi < 5 * winFloors; wi++) winLit.push(rng.chance(0.5));
    city.buildings.push({
      x: [-156, -52, 52, 156][i], z: city.beach.z0 - 40, w: 20, d: 14, h: hh,
      type: 'hotel', glass: false, roofType: 'flat',
      roofDetail: { ac: 2, tank: true, antenna: i % 2 === 0, chimney: false, parapet: true },
      color: PASTEL[(i * 3 + 1) % PASTEL.length], roof: ROOFS[i % ROOFS.length], windows: 5,
      winCols: 5, winFloors, winLit,
      doorDx: 0, doorFace: 1, canopy: true, balcony: true,
      // Round 6 (packet 13): the beachfront hotels glow — a neon sign
      // panel is the postcard of the strip.
      neon: { color: NEON_COLORS[i % NEON_COLORS.length], style: 'sign', sign: NEON_SIGNS[i % NEON_SIGNS.length] },
    });
  }

  // Round 7 (packet 13) — PARKS: Taman Senja is the park block
  // (bx 1, bz 3) the buildings already skip; the hideout plaza
  // (bx 4, bz 5) is the second green. Each park gets a lawn, flower
  // beds (data only — the renderer draws the coloured patches) and
  // its own benches below. The lawn colour differs from the asphalt
  // and the sidewalk, so the green reads from the top-down camera.
  const parkCx = (1 - CONFIG.blocksX / 2 + 0.5) * CONFIG.pitch;
  const parkCz = (3 - CONFIG.blocksZ / 2 + 0.5) * CONFIG.pitch;
  city.parks = [
    { x: parkCx, z: parkCz, w: 40, d: 32, name: 'Taman Senja' },
    { x: 0, z: 104, w: 36, d: 30, name: 'Plaza Hideout' },
  ];
  city.flowers = [];
  const FLOWER_COLORS = ['#ff5a7a', '#ffd23d', '#c95fd9', '#ffffff', '#ff7b2d'];
  for (const park of city.parks) {
    for (let i = 0; i < 8; i++) {
      city.flowers.push({
        x: park.x + rng.range(-park.w / 2 + 3, park.w / 2 - 3),
        z: park.z + rng.range(-park.d / 2 + 3, park.d / 2 - 3),
        w: rng.range(1.5, 3), d: rng.range(1, 2),
        color: rng.pick(FLOWER_COLORS),
      });
    }
  }

  // Round 7 (packet 12) — STREET PROPS: hydrants and signs on the
  // sidewalk corners of shuffled intersections, bins tucked against
  // building walls, benches in the parks / on the beachfront / on
  // wide sidewalks, and bus-stop shelters on three avenues. Every
  // candidate is checked against the roads AND the buildings with
  // the same guards as the round-6 palms — a prop that fails is
  // re-rolled to the next candidate, never planted on asphalt or
  // inside a wall. All of them merge into the static buffer.
  city.props = [];
  const propSpots = [];
  for (const x of xs) for (const z of zs) propSpots.push({ x, z });
  const shuffled = rng.shuffle(propSpots);
  const propOk = (x, z, r = 1.5) => !onRoad(city, x, z) && !buildingHit(city, x, z, r);
  let hydrants = 0, signs = 0;
  for (const s of shuffled) {
    if (hydrants < CONFIG.props.hydrants && propOk(s.x + 8.6, s.z + 8.6)) {
      city.props.push({ kind: 'hydrant', x: s.x + 8.6, z: s.z + 8.6, yaw: 0 });
      hydrants++;
    } else if (signs < CONFIG.props.signs && propOk(s.x + 7.6, s.z - 7.6)) {
      city.props.push({ kind: 'sign', x: s.x + 7.6, z: s.z - 7.6, yaw: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) });
      signs++;
    }
    if (hydrants >= CONFIG.props.hydrants && signs >= CONFIG.props.signs) break;
  }
  let bins = 0, binGuard = 0;
  while (bins < CONFIG.props.bins && binGuard++ < 200) {
    const b = rng.pick(city.buildings);
    const side = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const x = b.x + side[0] * (b.w / 2 + 1.6);
    const z = b.z + side[1] * (b.d / 2 + 1.6);
    // Same 1.5 m guard the tests use, against EVERY building — the
    // wall the bin leans on is not always the only one nearby.
    if (!propOk(x, z, 1.5)) continue;
    city.props.push({ kind: 'bin', x, z, yaw: 0 });
    bins++;
  }
  // Benches: six in Taman Senja, four in the plaza, four along the
  // beachfront promenade (just off the beach road, on the sand side).
  // Plaza centre is z=104 (block bz 5) — z=78 is the road itself.
  // Beach benches sit clear of every vertical avenue (roads at
  // -182/-130/-78/-26/26/78/130/182: keep ≥9 m away from each).
  const benchSpots = [];
  for (let i = 0; i < 6; i++) benchSpots.push({ x: parkCx + rng.range(-16, 16), z: parkCz + rng.range(-12, 12), yaw: rng.pick([0, Math.PI / 2]) });
  for (let i = 0; i < 4; i++) benchSpots.push({ x: rng.range(-14, 14), z: 104 + rng.range(-11, 11), yaw: rng.pick([0, Math.PI / 2]) });
  for (let i = 0; i < 4; i++) benchSpots.push({ x: [-170, -105, -35, 35][i], z: city.beach.z0 - 9.5, yaw: 0 });
  for (const s of benchSpots) {
    // A bench that lands on a road or inside a wall is nudged a few
    // metres (up to 8 tries) before it is dropped — the count matters
    // (the city promises 14 benches), the exact metre does not.
    let placed = false;
    for (let attempt = 0; attempt < 8 && !placed; attempt++) {
      const x = s.x + (attempt === 0 ? 0 : rng.range(-6, 6));
      const z = s.z + (attempt === 0 ? 0 : rng.range(-6, 6));
      if (!propOk(x, z, 2)) continue;
      city.props.push({ kind: 'bench', x, z, yaw: s.yaw });
      placed = true;
    }
  }
  // Bus stops: a shelter (posts + roof + bench) on three avenues.
  // Spots sit on REAL avenues (roadXs / roadZs), 9.5 m off the road
  // centre on the sidewalk side; each stop tries six offsets around
  // its anchor — the sidewalk runs right past the buildings, so a
  // shelter that would sit inside a wall moves along the avenue.
  const BUS_ANCHORS = [[-26, 0, 0], [78, -104, Math.PI / 2], [-130, 104, 0]];
  for (const [ax, az, yaw] of BUS_ANCHORS) {
    const candidates = [
      [ax + 9.5, az], [ax - 9.5, az],
      [ax + 9.5, az + 18], [ax - 9.5, az + 18],
      [ax + 9.5, az - 18], [ax - 9.5, az - 18],
    ];
    for (const [x, z] of candidates) {
      if (!propOk(x, z, 3)) continue;
      city.props.push({ kind: 'busstop', x, z, yaw });
      break;
    }
  }

  // Palms: along the beach and scattered through the park and plazas.
  // Round 6 (packet 10) — PALMS OFF THE ROAD: the old code dropped
  // palms anywhere, and 19 of 46 landed ON a road (worst of all on
  // the beachfront road and its zebra crossings, exactly what the
  // user photographed). A palm is now only planted after it passes
  // the same checks as the street trees: off every road (onRoad
  // covers the road strips AND the crosswalks at the intersections)
  // and clear of every building. Rejected spots are re-rolled until
  // all 46 palms stand on sand, sidewalk, park or plaza — never on
  // asphalt. (The trees below already had these guards.)
  let palmsPlaced = 0;
  for (let guard = 0; palmsPlaced < 46 && guard < 600; guard++) {
    const onBeach = palmsPlaced < 26;
    const px = onBeach ? rng.range(-halfX + 8, halfX - 8) : rng.range(-halfX, halfX);
    const pz = onBeach ? rng.range(city.beach.z0 + 2, city.beach.z1 - 4)
      : rng.range(-halfZ, halfZ);
    if (onRoad(city, px, pz)) continue;
    if (buildingHit(city, px, pz, 2)) continue;
    city.palms.push({
      x: px, z: pz,
      h: rng.range(5, 8),
      lean: rng.range(-0.12, 0.12),
      // Round 6: frond count and crown spread vary per palm.
      fronds: rng.int(5, 7),
      crownR: rng.range(1.6, 2.4),
    });
    palmsPlaced++;
  }
  // Round 6 — city trees (NOT palms): round-crowned street trees in
  // the park block, along the sidewalks and on the plazas — trunk +
  // a lumpy multi-box crown, each with its own height, crown size
  // and green shade, so no two trees read the same. (The old palms
  // were the only trees in the city; they stay, as the Miami palms.)
  city.trees = [];
  // (parkCx / parkCz are declared above, in the round-7 parks block.)
  for (let i = 0; i < 64; i++) {
    let x, z;
    if (i < 18) { // park grove
      x = parkCx + rng.range(-18, 18);
      z = parkCz + rng.range(-14, 14);
    } else if (i < 50) { // along the sidewalks, just off the roads
      const vertical = rng.chance(0.5);
      const rx = rng.pick(xs.slice(1, -1));
      const rz = rng.pick(zs.slice(1, -1));
      x = vertical ? rx + (rng.chance(0.5) ? 9.5 : -9.5) : rng.range(-halfX + 10, halfX - 10);
      z = vertical ? rng.range(-halfZ + 10, halfZ - 10) : rz + (rng.chance(0.5) ? 9.5 : -9.5);
    } else { // plazas and the hideout square
      x = rng.range(-halfX + 10, halfX - 10);
      z = rng.range(-halfZ + 10, halfZ - 10);
    }
    if (buildingHit(city, x, z, 3)) continue;
    if (onRoad(city, x, z)) continue;
    city.trees.push({
      x, z,
      h: rng.range(4.5, 8),
      crownR: rng.range(1.6, 2.8),
      variant: rng.int(0, 3), // green shade + crown shape
      lean: rng.range(-0.1, 0.1),
    });
  }
  // Round 6 (packet 11) — BILLBOARDS: big GTA-style ad boards on
  // the main avenues. Every brand is FICTIONAL, invented for Kota
  // Seja — no real brands, no licensed material. Each board stands
  // just off the road (sidewalk edge, never on asphalt, never in a
  // building) and faces the traffic: beside a north-south avenue the
  // panel spans the z axis (yaw 90°), beside an east-west avenue it
  // spans x (yaw 0°). Candidates that fail the road/building checks
  // are tried on the other three corners of the same intersection.
  const BILLBOARD_BRANDS = [
    { brand: 'SEJA FM', color: '#ff2e88', accent: '#ffd23d' },
    { brand: 'SOLANO COLA', color: '#d94f3d', accent: '#ffffff' },
    { brand: 'VEGA TACOS', color: '#f2a65a', accent: '#c22a2a' },
    { brand: 'SUNSET HOTEL', color: '#7fb8d9', accent: '#ffd23d' },
    { brand: 'PALM SURF', color: '#3f9e4d', accent: '#ffffff' },
    { brand: 'MANGO MOTORS', color: '#f2c14e', accent: '#22303e' },
    { brand: 'NEON NIGHTS', color: '#9b7ede', accent: '#37d67a' },
    { brand: 'KOTA SEJA', color: '#ff7b2d', accent: '#ffffff' },
  ];
  // [roadX or roadZ, cross street, beside a vertical avenue?]
  const BILLBOARD_SPOTS = [
    { a: -104, b: -52, vertical: true }, { a: 0, b: 104, vertical: true },
    { a: 104, b: -104, vertical: true }, { a: -52, b: 52, vertical: false },
    { a: 52, b: -52, vertical: false }, { a: 156, b: 0, vertical: true },
    { a: -156, b: -104, vertical: true }, { a: 0, b: -156, vertical: false },
  ];
  city.billboards = [];
  BILLBOARD_SPOTS.forEach((spot, i) => {
    const def = BILLBOARD_BRANDS[i % BILLBOARD_BRANDS.length];
    for (const [sx, sz] of [[10.5, 10.5], [-10.5, 10.5], [10.5, -10.5], [-10.5, -10.5]]) {
      const x = spot.vertical ? spot.a + sx : spot.b + sx;
      const z = spot.vertical ? spot.b + sz : spot.a + sz;
      if (onRoad(city, x, z)) continue;
      if (buildingHit(city, x, z, 4)) continue;
      city.billboards.push({
        x, z, yaw: spot.vertical ? Math.PI / 2 : 0,
        w: 11, h: 5.5, brand: def.brand, color: def.color, accent: def.accent,
      });
      break;
    }
  });
  // Street lamps at every other intersection, crosswalks at every one.
  for (const x of xs) {
    for (const z of zs) {
      city.crosswalks.push({ x, z });
      if ((Math.round(x / CONFIG.pitch) + Math.round(z / CONFIG.pitch)) % 2 === 0) {
        city.lamps.push({ x: x + 7, z: z + 7 });
        // Round 5: a traffic light on the opposite corner of the same
        // intersections — static street detail for the driving scenes.
        city.trafficLights.push({ x: x - 7, z: z - 7 });
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

// Round 7 — zebra band helper (packet 10): the renderer draws two
// zebra bands per intersection — one across each road, just outside
// the intersection square. A point is on a zebra when it lies inside
// one of those bands; the bands sit on the roads, so onRoad() already
// covers them, but the unit tests pin the bands directly (a thin
// stripe must never land under a tree, a palm or a prop).
export function zebraBands(city) {
  const bands = [];
  for (const cw of city.crosswalks) {
    // Across the vertical road (traffic along z): 16 thin stripes
    // along z, spread across x, just north of the intersection.
    bands.push({ x0: cw.x - 5.6, x1: cw.x + 5.6, z0: cw.z + 7, z1: cw.z + 11 });
    // Across the horizontal road (traffic along x): stripes along x,
    // spread across z, just east of the intersection.
    bands.push({ x0: cw.x + 7, x1: cw.x + 11, z0: cw.z - 5.6, z1: cw.z + 5.6 });
  }
  return bands;
}

export function onZebra(city, x, z) {
  for (const b of zebraBands(city)) {
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return true;
  }
  return false;
}

// Round 7 complete (2026-11-19): district building types, roof
// details, landmark tower + skyline falloff, parks + flowers, street
// props with guards, zebra-band helpers — unit tests in tests-r7.
