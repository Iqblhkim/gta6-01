// Kota Seja — the island city: deterministic layout, buildings, roads,
// palms, traffic, pedestrians and the vehicles the game draws in 3D.
import { mulberry32, range, rangeInt, pick } from './rng.js';

export const DISTRICTS = [
  { name: 'MARINA BAY', x: -70, z: 90, color: '#ff9a3c' },
  { name: 'VIEJO CENTRO', x: -60, z: -30, color: '#ffd166' },
  { name: 'PALM ROW', x: 55, z: 40, color: '#7ee081' },
  { name: 'THE DOCKS', x: 70, z: -80, color: '#7fb3ff' },
];

const BUILDING_COLORS = ['#8a6f5c', '#6e5a6e', '#7d6a4f', '#5c6e7d', '#9c7a5a', '#715a4a', '#5a6a7a', '#8a5a50'];
const ROOF_COLORS = ['#4a3a34', '#3d3444', '#54423a', '#2e3a44'];
const CAR_COLORS = ['#d33a2c', '#2c6ed3', '#e8b73a', '#e8e8e8', '#222831', '#2ca36b', '#8a2be2', '#ff7a1a'];

export function buildCity(seed = 20261121) {
  const rng = mulberry32(seed);
  const buildings = [];
  // City blocks on a grid, offset +19 so roads (boulevard x in [-11,11],
  // cross streets at multiples of 34) stay clear of every building.
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 2; gz++) {
      const bx = gx * 34 + 19, bz = gz * 34 + 19;
      if (gz === 2) continue; // beach front stays open
      const n = rangeInt(rng, 1, 2);
      for (let i = 0; i < n; i++) {
        const w = range(rng, 12, 18), d = range(rng, 12, 18);
        const h = range(rng, 9, 42) * (Math.abs(gx) + Math.abs(gz) > 4 ? 1.5 : 1);
        buildings.push({
          x: bx + range(rng, -6, 6) + (i ? 10 : -10) * 0.4,
          z: bz + range(rng, -6, 6),
          w, d, h: Math.min(58, h),
          yaw: pick(rng, [0, 0, 0, 0.06, -0.06]),
          color: pick(rng, BUILDING_COLORS),
          roof: pick(rng, ROOF_COLORS),
          lit: rng(),
        });
      }
    }
  }
  const palms = [];
  for (let i = 0; i < 46; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    palms.push({
      x: side * range(rng, 13, 15) + Math.floor(i / 2) * 0 - range(rng, -2, 2),
      z: -95 + (i * 7.3) % 195,
      h: range(rng, 7, 11), lean: range(rng, -0.12, 0.12), phase: rng() * 6.28,
    });
  }
  const traffic = [];
  for (let i = 0; i < 10; i++) {
    traffic.push({
      x: pick(rng, [-8, -2, 2, 8]) + range(rng, -1, 1),
      z: -90 + i * 19 + range(rng, -4, 4),
      yaw: pick(rng, [0, Math.PI]),
      color: pick(rng, CAR_COLORS), speed: range(rng, 6, 14),
    });
  }
  const peds = [];
  for (let i = 0; i < 14; i++) {
    peds.push({
      x: pick(rng, [-12, 12]) + range(rng, -2, 2),
      z: -80 + i * 13 + range(rng, -3, 3),
      shirt: pick(rng, ['#e84a5f', '#2ec4b6', '#ffd166', '#7fb3ff', '#f4f4f4', '#ff7a1a']),
      skin: pick(rng, ['#c68e5e', '#8d5524', '#e8b88a', '#5c3a21']),
      phase: rng() * 6.28,
    });
  }
  return { buildings, palms, traffic, peds, rng };
}

// Windows as small quads on the two faces that look toward the camera.
export function drawBuildingWindows(r, b) {
  const sy = Math.sin(b.yaw), cy = Math.cos(b.yaw);
  const faces = [
    { n: [-sy, 0, -cy], o: [0, -b.d / 2], along: [cy, sy], len: b.w },
    { n: [cy, 0, -sy], o: [b.w / 2, 0], along: [-sy, cy], len: b.d },
    { n: [sy, 0, cy], o: [0, b.d / 2], along: [-cy, -sy], len: b.w },
    { n: [-cy, 0, sy], o: [-b.w / 2, 0], along: [sy, -cy], len: b.d },
  ];
  for (const f of faces) {
    const mx = b.x + f.o[0] - r.cam.x, mz = b.z + f.o[1] - r.cam.z;
    if (f.n[0] * mx + f.n[2] * mz > 0) continue; // faces away
    const cols = Math.max(2, Math.floor(f.len / 3.4));
    const rows = Math.max(2, Math.floor(b.h / 4.2));
    for (let ci = 0; ci < cols; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        const lit = ((ci * 7 + ri * 13 + Math.floor(b.lit * 100)) % 5) < 2;
        const a = -f.len / 2 + (ci + 0.5) * (f.len / cols);
        const wx = b.x + f.o[0] + f.along[0] * a;
        const wz = b.z + f.o[1] + f.along[1] * a;
        const wy = 2.2 + (ri + 0.5) * ((b.h - 3) / rows);
        const ox = f.n[0] * 0.12, oz = f.n[2] * 0.12;
        const px = f.along[0] * 0.9, pz = f.along[1] * 0.9;
        const q = [
          [wx - px + ox, wy - 0.9, wz - pz + oz], [wx + px + ox, wy - 0.9, wz + pz + oz],
          [wx + px + ox, wy + 0.9, wz + pz + oz], [wx - px + ox, wy + 0.9, wz - pz + oz],
        ];
        r.poly(q, f.n, lit ? '#ffd166' : '#2a2438', lit ? 1.25 : 0.9);
      }
    }
  }
}

export function drawBuilding(r, b) {
  r.box(b.x, 0, b.z, b.w, b.h, b.d, b.yaw,
    { top: b.roof, side: b.color }, 1);
  // Rooftop box (AC unit / penthouse) for silhouette depth.
  r.box(b.x, b.h, b.z, b.w * 0.35, 2.2, b.d * 0.35, b.yaw,
    { top: '#3a3230', side: '#55483f' }, 0.9);
  drawBuildingWindows(r, b);
}

export function drawGround(r) {
  // Sea to the south-east, sand beach, then the city slab.
  r.ground(-260, 96, 260, 320, -0.4, '#2a4a7a', 1.05);
  r.ground(-260, 88, 260, 98, -0.2, '#e8c88a', 1.1);
  r.ground(-260, -140, 260, 90, 0, '#3a3a44', 0.95);
  // Boulevard + cross streets (lighter asphalt) with centre dashes.
  r.ground(-11, -140, 11, 96, 0.06, '#4a4a55', 1.0);
  for (let gz = -3; gz <= 2; gz++) r.ground(-160, gz * 34 - 5, 160, gz * 34 + 5, 0.06, '#454550', 1.0);
  for (let z = -130; z < 96; z += 8) r.ground(-0.4, z, 0.4, z + 4, 0.12, '#ffd166', 1.2);
  for (let x = -150; x < 150; x += 10) r.ground(x, -0.4, x + 5, 0.4, 0.12, '#ffd166', 1.2);
  // Sidewalks flanking the boulevard.
  r.ground(-15, -140, -11, 96, 0.1, '#8a8078', 1.05);
  r.ground(11, -140, 15, 96, 0.1, '#8a8078', 1.05);
}

// A full 3D car: body, cabin, wheels, windshield, lights. yaw = heading.
export function drawCar(r, x, z, yaw, color, opts = {}) {
  const L = 4.6, W = 2.0, H = 0.95;
  const body = { top: color, side: color };
  r.box(x, 0.35, z, W, H, L, yaw, body, 1);
  r.box(x, 1.25, z, W * 0.82, 0.72, L * 0.48, yaw, { top: '#1c2430', side: '#222c3a' }, 1.05);
  // Windshield (dark glass quad on the cabin front).
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const fx = sy, fz = cy;
  const wq = [
    [x - fz * W * 0.36 + fx * L * 0.12, 1.35, z + fx * W * 0.36 + fz * L * 0.12],
    [x + fz * W * 0.36 + fx * L * 0.12, 1.35, z - fx * W * 0.36 + fz * L * 0.12],
    [x + fz * W * 0.36 + fx * L * 0.02, 1.95, z - fx * W * 0.36 + fz * L * 0.02],
    [x - fz * W * 0.36 + fx * L * 0.02, 1.95, z + fx * W * 0.36 + fz * L * 0.02],
  ];
  r.poly(wq, [fx, 0.3, fz], '#101826', 1.1);
  // Wheels.
  for (const [lx, lz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const wx = x + lx * (W / 2) * cy + lz * sy;
    const wz = z - lx * (W / 2) * sy + lz * cy;
    r.box(wx, 0.05, wz, 0.32, 0.72, 0.72, yaw, { top: '#111', side: '#0c0c0c' }, 0.7);
  }
  // Headlights + taillights.
  const hl = (s) => {
    for (const side of [-1, 1]) {
      const hx = x + side * W * 0.36 * cy + s * L * 0.51 * sy;
      const hz = z - side * W * 0.36 * sy + s * L * 0.51 * cy;
      r.box(hx, 0.62, hz, 0.5, 0.22, 0.18, yaw,
        { top: s > 0 ? '#fff6c0' : '#ff2a2a', side: s > 0 ? '#fff6c0' : '#ff2a2a' }, 1.6);
    }
  };
  hl(1); hl(-1);
  if (opts.police) {
    r.box(x, 1.32, z, W * 0.5, 0.28, 0.5, yaw, { top: '#ff2a2a', side: '#2456ff' }, 1.5);
    r.box(x, 1.62, z, 0.18, 0.5, 0.18, yaw, { top: '#c8c8c8', side: '#c8c8c8' }, 1.2);
  }
  if (opts.smoke) {
    for (let i = 0; i < 2; i++) {
      const bx = x - fx * (L * 0.5 + i * 1.2) + (i % 2 ? 0.5 : -0.5);
      const bz = z - fz * (L * 0.5 + i * 1.2);
      r.billboard(bx, 0.5 + i * 0.4, bz, 1.3 + i * 0.5, 1.0 + i * 0.3, '#cfc8c0', 0.20 - i * 0.06);
    }
  }
}

export function drawHeli(r, x, y, z, yaw, rotorAngle) {
  r.box(x, y, z, 2.2, 1.6, 4.2, yaw, { top: '#1c2f4a', side: '#24344e' }, 1.05);
  r.box(x, y + 0.3, z - 3.4, 0.7, 0.7, 3.4, yaw, { top: '#1c2f4a', side: '#2c3e5c' }, 1.0);
  r.box(x, y + 1.6, z, 0.5, 0.5, 0.5, yaw, { top: '#3a4a5c', side: '#3a4a5c' }, 1.1);
  // Rotor: two long thin blades, angle frozen per shot.
  const ra = rotorAngle, rx = Math.sin(ra) * 4.4, rz = Math.cos(ra) * 4.4;
  const ry = y + 2.0;
  r.poly([[x - rx, ry, z - rz], [x + rx, ry, z + rz], [x + rx, ry + 0.06, z + rz], [x - rx, ry + 0.06, z - rz]], [0, 1, 0], '#c8ccd4', 1.3);
  r.poly([[x + rz, ry, z - rx], [x - rz, ry, z + rx], [x - rz, ry + 0.06, z + rx], [x + rz, ry + 0.06, z - rx]], [0, 1, 0], '#9aa0ac', 1.2);
  // Searchlight cone down to the street.
  const tx = x + Math.sin(yaw) * 6, tz = z + Math.cos(yaw) * 6;
  r.polyFlat([[x - 0.9, y - 0.4, z], [x + 0.9, y - 0.4, z], [tx + 2.6, 0.2, tz], [tx - 2.6, 0.2, tz]], 'rgba(255,244,180,0.15)', z - r.cam.z);
  r.polyFlat([[tx - 2.6, 0.15, tz], [tx + 2.6, 0.15, tz], [tx + 2.6, 0.3, tz + 0.01], [tx - 2.6, 0.3, tz + 0.01]], 'rgba(255,244,180,0.30)', tz - r.cam.z);
}

export function drawPalm(r, p) {
  const topX = p.x + p.lean * p.h, topZ = p.z;
  const ty = p.h;
  // Trunk: two crossed quads so it reads 3D from any angle.
  r.poly([[p.x - 0.35, 0, p.z], [p.x + 0.35, 0, p.z], [topX + 0.3, ty, topZ], [topX - 0.3, ty, topZ]], [0.4, 0.2, 0], '#7a5a3a', 1.0);
  r.poly([[p.x, 0, p.z - 0.35], [p.x, 0, p.z + 0.35], [topX, ty, topZ + 0.3], [topX, ty, topZ - 0.3]], [0, 0.2, 0.4], '#6a4a30', 0.9);
  // Fronds: 6 drooping triangles around the crown.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + p.phase;
    const dx = Math.cos(a), dz = Math.sin(a);
    const tipX = topX + dx * 2.6, tipZ = topZ + dz * 2.6;
    r.poly([[topX, ty, topZ], [topX + dx * 1.1, ty - 0.5, topZ + dz * 1.1], [tipX, ty - 1.9, tipZ]], [dx * 0.4, 1, dz * 0.4], i % 2 ? '#2f8a4a' : '#3aa655', 1.05);
  }
  // Coconuts.
  r.box(topX, ty - 0.6, topZ, 0.5, 0.5, 0.5, 0, { top: '#6a4a26', side: '#5a3d1e' }, 0.9);
}

// A person on foot: legs, torso, head — reads as a 3D figure, not a sprite.
export function drawPerson(r, x, z, yaw, shirt, skin, walkPhase = 0) {
  const swing = Math.sin(walkPhase) * 0.22;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const lx = -sy, lz = cy; // forward
  r.box(x - lx * swing * 0.4, 0, z - lz * swing * 0.4, 0.34, 0.8, 0.34, yaw, { top: '#2a2a33', side: '#23232c' }, 0.9);
  r.box(x + lx * swing * 0.4, 0, z + lz * swing * 0.4, 0.34, 0.8, 0.34, yaw, { top: '#2a2a33', side: '#23232c' }, 0.9);
  r.box(x, 0.8, z, 0.62, 0.75, 0.4, yaw, { top: shirt, side: shirt }, 1.0);
  r.box(x, 1.58, z, 0.42, 0.42, 0.42, yaw, { top: skin, side: skin }, 1.05);
  r.box(x, 1.95, z, 0.5, 0.14, 0.5, yaw, { top: '#1c1c22', side: '#1c1c22' }, 0.9);
}
