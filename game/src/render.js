// Drawing only: Three.js scene + DOM HUD + minimap. The world's state in,
// pixels out. No game rules here — the renderer never changes state.
// Sunset Miami-Vice look: purple-to-orange sky dome, warm directional sun,
// pastel low-poly buildings, instanced road markings and palms.
import * as THREE from '../vendor/three.module.js';
import { BLOCK, BOUNDS, DISTRICTS, MISSIONS, PITCH, ROAD_W, ROAD_X, ROAD_Z, WEAPONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_MAP = 'map';
export const SCREEN_END = 'end';

const SKY_TOP = new THREE.Color(0x2d1b4e);
const SKY_MID = new THREE.Color(0xb34a7a);
const SKY_LOW = new THREE.Color(0xff8c5a);
const FOG_COLOR = 0x9a5570;

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000000'; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 12) {
      const lit = ((x * 7 + y * 13) % 10) < 6;
      g.fillStyle = lit ? '#ffd98a' : '#20242e';
      g.fillRect(x, y, 7, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- Facade textures: one floor band per texture tile --------------------
// Each style paints a single storey (128x64) that repeats up the facade, so
// windows stay the same size on every building: glass towers (dark glass,
// warm lit windows), brick shophouses (brick courses, small windows, AC
// boxes), pastel hotels (big curtained windows, balcony shadow band),
// warehouses (corrugated cladding, small high windows). Lit fraction is
// bucketed so a few cached variants cover the whole city.
const facadeCache = new Map();
function facadeTexture(style, color, winLit) {
  const bucket = winLit < 0.4 ? 0.3 : winLit < 0.6 ? 0.5 : winLit < 0.75 ? 0.7 : 0.9;
  const key = style + ':' + color + ':' + bucket;
  if (facadeCache.has(key)) return facadeCache.get(key);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const base = new THREE.Color(color);
  if (style === 'glass') {
    g.fillStyle = '#141c2e'; g.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 4; i += 1) {
      const x = 8 + i * 30; const lit = ((i * 7 + Math.floor(bucket * 10)) % 10) / 10 < bucket;
      g.fillStyle = lit ? '#ffd98a' : (i % 3 === 0 ? '#9fd8e8' : '#0e1420');
      g.fillRect(x, 10, 20, 38);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, 10, 20, 4);
    }
    g.fillStyle = '#0a0e18'; g.fillRect(0, 60, 128, 4); // floor line
  } else if (style === 'brick') {
    g.fillStyle = '#7a3b2e'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 128, 1); // brick courses
    for (let y = 0; y < 64; y += 16) for (let x = (y % 32 === 0 ? 0 : 8); x < 128; x += 16) g.fillRect(x, y, 1, 8);
    for (let i = 0; i < 2; i += 1) {
      const x = 22 + i * 56;
      g.fillStyle = '#2a2018'; g.fillRect(x - 2, 8, 20, 34); // frame
      g.fillStyle = ((i * 5 + Math.floor(bucket * 10)) % 10) / 10 < bucket ? '#ffca7a' : '#1a2230';
      g.fillRect(x, 10, 16, 30);
      g.fillStyle = '#9aa0a8'; g.fillRect(x + 2, 44, 12, 6); // AC box
    }
    g.fillStyle = '#4a241c'; g.fillRect(0, 60, 128, 4); // floor line
  } else if (style === 'hotel') {
    g.fillStyle = hex(color); g.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 3; i += 1) {
      const x = 10 + i * 40;
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x - 3, 8, 30, 40); // recess
      g.fillStyle = ((i * 3 + Math.floor(bucket * 10)) % 10) / 10 < bucket ? '#ffe6b0' : '#24344a';
      g.fillRect(x, 10, 24, 36);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, 10, 8, 36); // curtain
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 50, 128, 6); // balcony shadow band
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 56, 128, 2); // rail
  } else { // warehouse: corrugated cladding
    g.fillStyle = hex(new THREE.Color(color).multiplyScalar(0.8).getHex());
    g.fillRect(0, 0, 128, 64);
    for (let x = 0; x < 128; x += 8) {
      g.fillStyle = (x / 8) % 2 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.16)';
      g.fillRect(x, 0, 4, 64);
    }
    for (let i = 0; i < 3; i += 1) {
      g.fillStyle = '#1a2230'; g.fillRect(16 + i * 40, 8, 18, 14);
    }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 60, 128, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  facadeCache.set(key, t);
  return t;
}

function sidewalkTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a7f8d'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const v = 118 + ((x * 13 + y * 7) % 5) * 4;
      g.fillStyle = `rgb(${v},${v - 6},${v + 2})`;
      g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i <= 4; i += 1) { g.fillRect(i * 32 - 1, 0, 2, 128); g.fillRect(0, i * 32 - 1, 128, 2); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5a4a3a'; g.fillRect(0, 0, 256, 256);
  // Deterministic blotches: dirt, gravel, sparse grass — breaks up the flat
  // brown on unbuilt plots without any extra geometry.
  const tones = ['#6b5a44', '#4a3a2e', '#7a6a52', '#54453a', '#4a6a3a', '#63523e'];
  for (let i = 0; i < 220; i += 1) {
    const x = (i * 53) % 256; const y = (i * 97 + 31) % 256;
    const r = 4 + ((i * 37) % 18);
    g.fillStyle = tones[i % tones.length];
    g.globalAlpha = 0.25 + ((i * 13) % 10) / 25;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

function awningTexture(color) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 32;
  const g = c.getContext('2d');
  const hex = '#' + color.toString(16).padStart(6, '0');
  for (let x = 0; x < 64; x += 16) {
    g.fillStyle = (x / 16) % 2 === 0 ? hex : '#f5efe0';
    g.fillRect(x, 0, 16, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function hawaiiTexture() {
  // Red Hawaiian shirt: bright coral base so it reads as a Hawaiian shirt
  // from behind at third-person distance, big pink/white hibiscus + teal leaves.
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d93a24'; g.fillRect(0, 0, 128, 128);
  const flower = (x, y, r, petal) => {
    g.fillStyle = petal;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.32, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffd166';
    g.beginPath(); g.arc(x, y, r * 0.22, 0, Math.PI * 2); g.fill();
  };
  const leaf = (x, y, a) => {
    g.fillStyle = '#1e7a6e';
    g.beginPath();
    g.ellipse(x, y, 14, 5, a, 0, Math.PI * 2);
    g.fill();
  };
  flower(30, 32, 13, '#ff8fa3'); flower(96, 26, 11, '#ffffff'); flower(64, 78, 14, '#ff5a8a'); flower(104, 100, 12, '#ffffff'); flower(22, 100, 10, '#ff8fa3');
  leaf(55, 20, 0.6); leaf(80, 55, -0.5); leaf(18, 60, 1.1); leaf(40, 95, -0.8); leaf(112, 70, 0.4); leaf(70, 115, 0.2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyDome() {
  const geo = new THREE.SphereGeometry(880, 24, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) / 880; // -1..1
    if (y > 0.25) col.copy(SKY_MID).lerp(SKY_TOP, Math.min(1, (y - 0.25) / 0.6));
    else if (y > -0.05) col.copy(SKY_LOW).lerp(SKY_MID, (y + 0.05) / 0.3);
    else col.copy(SKY_LOW);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---- Merged-geometry helpers --------------------------------------------
// Several coloured boxes/cylinders become ONE mesh with vertex colours:
// one draw call per car body instead of twenty. Parts are {geo, matrix, color}.
function mergeParts(parts) {
  const pos = []; const norm = []; const col = []; const idx = [];
  let base = 0;
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (const part of parts) {
    const g = part.geo;
    const p = g.attributes.position;
    const n = g.attributes.normal;
    c.setHex(part.color);
    nm.getNormalMatrix(part.matrix);
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i).applyMatrix4(part.matrix);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      norm.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i += 1) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i += 1) idx.push(base + i);
    base += p.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

function partBox(w, h, d, x, y, z, color, ry = 0, rx = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4();
  const e = new THREE.Euler(rx, ry, 0);
  m.makeRotationFromEuler(e);
  m.setPosition(x, y, z);
  return { geo, matrix: m, color };
}

// Any geometry as a merged part (cylinders for tanks/lamps, planes for glow).
// Rotation composes as yaw * pitch * roll, so a tilted awning slopes away
// from its wall whichever way the wall faces.
function partGeo(geo, x, y, z, color, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().makeRotationY(ry);
  m.multiply(new THREE.Matrix4().makeRotationX(rx));
  m.multiply(new THREE.Matrix4().makeRotationZ(rz));
  m.scale(new THREE.Vector3(sx, sy, sz));
  m.setPosition(x, y, z);
  return { geo, matrix: m, color };
}

const CAR_BODY_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const CAR_GLASS = 0x9fd8e8;
const CAR_DARK = 0x14161c;
const CAR_TYRE = 0x0e0e10;

// One merged body geometry per model type (cached). Local space: +z is the
// front (hood), y is up. Real proportions: hood, glass cabin, trunk, bumpers,
// grille, headlights / taillights, mirrors — clearly different per model.
const carBodyCache = new Map();
function carBodyGeometry(type, color) {
  const key = type + ':' + color;
  if (carBodyCache.has(key)) return carBodyCache.get(key);
  const P = [];
  const add = (w, h, d, x, y, z, c, ry = 0, rx = 0) => P.push(partBox(w, h, d, x, y, z, c, ry, rx));
  if (type === 'van') {
    add(2.1, 1.5, 5.4, 0, 1.0, 0, color); // tall boxy body
    add(1.9, 0.7, 1.0, 0, 1.65, 1.9, CAR_GLASS); // windshield band
    add(2.0, 0.1, 5.2, 0, 1.78, 0, 0xffffff); // roof stripe
    add(2.1, 0.2, 0.18, 0, 0.4, 2.72, CAR_DARK); // bumpers
    add(2.1, 0.2, 0.18, 0, 0.4, -2.72, CAR_DARK);
    add(0.5, 0.16, 0.06, -0.6, 0.75, 2.72, 0xfff2b0); add(0.5, 0.16, 0.06, 0.6, 0.75, 2.72, 0xfff2b0); // headlights
    add(0.4, 0.16, 0.06, -0.7, 0.75, -2.72, 0xcc2222); add(0.4, 0.16, 0.06, 0.7, 0.75, -2.72, 0xcc2222); // taillights
    add(0.16, 0.3, 0.4, -1.12, 1.35, 1.9, CAR_DARK); add(0.16, 0.3, 0.4, 1.12, 1.35, 1.9, CAR_DARK); // mirrors
  } else if (type === 'truck') {
    add(2.3, 1.0, 2.0, 0, 0.75, 2.1, color); // cab
    add(2.0, 0.75, 0.12, 0, 1.35, 2.9, CAR_GLASS); // cab windshield
    add(2.3, 0.18, 1.9, 0, 1.32, 2.1, color); // cab roof
    add(2.3, 1.9, 4.0, 0, 1.2, -1.0, 0xcfd6dd); // cargo box
    add(2.3, 0.2, 0.18, 0, 0.4, 3.12, CAR_DARK);
    add(2.3, 0.2, 0.18, 0, 0.4, -3.12, CAR_DARK);
    add(0.5, 0.16, 0.06, -0.7, 0.75, 3.12, 0xfff2b0); add(0.5, 0.16, 0.06, 0.7, 0.75, 3.12, 0xfff2b0);
    add(0.4, 0.16, 0.06, -0.8, 0.75, -3.12, 0xcc2222); add(0.4, 0.16, 0.06, 0.8, 0.75, -3.12, 0xcc2222);
    add(0.16, 0.3, 0.4, -1.22, 1.2, 2.6, CAR_DARK); add(0.16, 0.3, 0.4, 1.22, 1.2, 2.6, CAR_DARK);
  } else if (type === 'sport') {
    add(2.0, 0.42, 4.2, 0, 0.48, 0, color); // low wide body
    add(1.9, 0.2, 1.7, 0, 0.78, 1.15, color); // long low hood
    add(1.9, 0.16, 0.9, 0, 0.72, -1.55, color); // rear deck
    add(1.5, 0.42, 1.3, 0, 0.95, -0.35, CAR_GLASS); // glass cabin
    add(1.45, 0.08, 1.2, 0, 1.18, -0.35, color); // roof
    add(1.85, 0.06, 0.42, 0, 0.98, -2.0, CAR_DARK); // spoiler wing
    add(0.08, 0.22, 0.3, -0.7, 0.86, -1.95, CAR_DARK); add(0.08, 0.22, 0.3, 0.7, 0.86, -1.95, CAR_DARK); // struts
    add(1.9, 0.08, 3.9, 0, 0.1, 0, 0xff2a7a); // neon underglow (pink)
    add(2.0, 0.16, 0.14, 0, 0.38, 2.12, CAR_DARK);
    add(2.0, 0.16, 0.14, 0, 0.38, -2.12, CAR_DARK);
    add(0.55, 0.14, 0.06, -0.62, 0.55, 2.14, 0xfff2b0); add(0.55, 0.14, 0.06, 0.62, 0.55, 2.14, 0xfff2b0);
    add(0.45, 0.14, 0.06, -0.7, 0.55, -2.14, 0xcc2222); add(0.45, 0.14, 0.06, 0.7, 0.55, -2.14, 0xcc2222);
    add(0.14, 0.24, 0.34, -1.05, 0.95, 0.5, CAR_DARK); add(0.14, 0.24, 0.34, 1.05, 0.95, 0.5, CAR_DARK);
  } else if (type === 'convertible') {
    add(1.95, 0.5, 4.3, 0, 0.52, 0, color); // teal roadster body
    add(1.85, 0.22, 1.4, 0, 0.85, 1.3, color); // hood
    add(1.85, 0.24, 1.0, 0, 0.85, -1.5, color); // trunk
    add(1.5, 0.5, 0.14, 0, 1.05, 0.75, CAR_GLASS, 0, -0.35); // low windshield
    add(0.7, 0.35, 0.7, -0.42, 0.95, -0.35, CAR_DARK); add(0.7, 0.35, 0.7, 0.42, 0.95, -0.35, CAR_DARK); // seats
    add(1.7, 0.1, 0.18, 0, 1.15, -0.95, CAR_DARK); // roll bar
    add(1.9, 0.08, 4.0, 0, 0.1, 0, 0x2ec4b6); // neon underglow (teal)
    add(1.95, 0.16, 0.14, 0, 0.38, 2.17, CAR_DARK);
    add(1.95, 0.16, 0.14, 0, 0.38, -2.17, CAR_DARK);
    add(0.5, 0.14, 0.06, -0.6, 0.55, 2.19, 0xfff2b0); add(0.5, 0.14, 0.06, 0.6, 0.55, 2.19, 0xfff2b0);
    add(0.4, 0.14, 0.06, -0.68, 0.55, -2.19, 0xcc2222); add(0.4, 0.14, 0.06, 0.68, 0.55, -2.19, 0xcc2222);
    add(0.14, 0.24, 0.34, -1.02, 0.95, 0.6, CAR_DARK); add(0.14, 0.24, 0.34, 1.02, 0.95, 0.6, CAR_DARK);
  } else {
    // sedan + taxi share the classic three-box shape.
    add(1.9, 0.55, 4.4, 0, 0.55, 0, color); // body
    add(1.8, 0.26, 1.15, 0, 0.92, 1.45, color); // hood
    add(1.8, 0.28, 0.95, 0, 0.92, -1.6, color); // trunk
    add(1.6, 0.55, 1.9, 0, 1.12, -0.15, CAR_GLASS); // glass cabin
    add(1.5, 0.08, 1.7, 0, 1.42, -0.15, color); // roof
    add(0.5, 0.5, 0.1, 0, 1.05, 0.85, CAR_GLASS, 0, -0.3); // windshield
    add(0.5, 0.5, 0.1, 0, 1.05, -1.1, CAR_GLASS, 0, 0.3); // rear window
    add(1.9, 0.18, 0.16, 0, 0.36, 2.22, CAR_DARK);
    add(1.9, 0.18, 0.16, 0, 0.36, -2.22, CAR_DARK);
    add(0.5, 0.14, 0.06, -0.6, 0.55, 2.24, 0xfff2b0); add(0.5, 0.14, 0.06, 0.6, 0.55, 2.24, 0xfff2b0);
    add(0.4, 0.14, 0.06, -0.68, 0.55, -2.24, 0xcc2222); add(0.4, 0.14, 0.06, 0.68, 0.55, -2.24, 0xcc2222);
    add(0.7, 0.1, 0.04, 0, 0.55, 2.25, CAR_DARK); // grille
    add(0.15, 0.26, 0.36, -1.0, 1.05, 0.55, CAR_DARK); add(0.15, 0.26, 0.36, 1.0, 1.05, 0.55, CAR_DARK); // mirrors
    if (type === 'taxi') {
      add(0.95, 0.26, 0.32, 0, 1.6, -0.15, 0xf2c230); // roof sign
      add(1.92, 0.1, 4.42, 0, 0.62, 0, 0x1a1a1a); // checker band
    }
  }
  const geo = mergeParts(P);
  carBodyCache.set(key, geo);
  return geo;
}

const WHEEL_GEO = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: CAR_TYRE });
const HUB_GEO = new THREE.CylinderGeometry(0.17, 0.17, 0.26, 10);
const HUB_MAT = new THREE.MeshLambertMaterial({ color: 0xb8bcc4 });

function makeCarMesh(model, color, isPolice) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(carBodyGeometry(model, color), CAR_BODY_MAT);
  g.add(body);
  // Wheels: one spin-group each (rotation.x spins around the axle).
  const wheelR = model === 'sport' ? 0.38 : model === 'van' || model === 'truck' ? 0.4 : 0.34;
  const halfLen = model === 'truck' ? 2.2 : model === 'van' ? 1.9 : model === 'sport' ? 1.5 : 1.55;
  const halfWid = model === 'truck' ? 1.15 : model === 'van' ? 1.05 : model === 'sport' ? 1.0 : 0.95;
  const wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const holder = new THREE.Group();
    holder.position.set(wx * halfWid, wheelR, wz * halfLen);
    const tyre = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    tyre.rotation.z = Math.PI / 2;
    tyre.scale.setScalar(wheelR / 0.34);
    holder.add(tyre);
    const hub = new THREE.Mesh(HUB_GEO, HUB_MAT);
    hub.rotation.z = Math.PI / 2;
    hub.scale.setScalar(wheelR / 0.34);
    holder.add(hub);
    g.add(holder);
    wheels.push(holder);
  }
  g.userData.wheels = wheels;
  g.userData.wheelR = wheelR;
  if (isPolice) {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
    red.position.set(-0.3, 1.62, -0.1);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }));
    blue.position.set(0.3, 1.62, -0.1);
    g.add(red); g.add(blue);
    g.userData.flash = [red, blue];
  }
  return g;
}

// ---- Realistic low-poly people -------------------------------------------
// An articulated humanoid (~1.8 units tall) with real proportions instead of
// a toy block: neck, tapered torso with shoulders, two-segment arms and legs
// on hip/shoulder/elbow/knee pivots, hands, shoes, hair with volume, eyes
// and brows. The pivots make the walk cycle read as walking — legs swing
// from the hip with a knee bend, arms counter-swing — and the right hand
// carries the gun when aiming. Local space: +z is the front, y is up.
function makeFigureMesh(opts) {
  const { shirt, pants, shirtTex, skin = 0xd9a066, hair = 0x1a1210, hairStyle = 'cap' } = opts;
  const g = new THREE.Group();
  const shirtMat = shirtTex
    ? new THREE.MeshLambertMaterial({ map: shirtTex })
    : new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const hairMat = new THREE.MeshLambertMaterial({ color: hair });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x1c1a20 });

  // Torso: hips + chest (shoulders wider than the waist), neck, head.
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.26), pantsMat);
  hips.position.y = 0.98;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.3), shirtMat);
  chest.position.y = 1.3;
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), shirtMat);
  shoulderL.position.set(-0.32, 1.52, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.32;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), skinMat);
  neck.position.y = 1.58;
  const head = new THREE.Group();
  head.position.y = 1.66;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  skull.position.y = 0.13;
  head.add(skull);
  // Hair with volume: cap on top + back; curly adds sides; bald skips it.
  if (hairStyle !== 'bald') {
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), hairMat);
    hairTop.position.y = 0.3;
    head.add(hairTop);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.08), hairMat);
    hairBack.position.set(0, 0.2, -0.12);
    head.add(hairBack);
    if (hairStyle === 'curly') {
      const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.28), hairMat);
      hairL.position.set(-0.15, 0.2, 0);
      const hairR = hairL.clone(); hairR.position.x = 0.15;
      head.add(hairL, hairR);
    }
  }
  // Face: eyes + brows + nose (reads at third-person distance, and up close).
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.02), darkMat);
    eye.position.set(sx * 0.065, 0.15, 0.145);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), hairMat);
    brow.position.set(sx * 0.065, 0.21, 0.145);
    head.add(eye, brow);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.03), skinMat);
  nose.position.set(0, 0.09, 0.15);
  head.add(nose);
  // Police cap: flat crown + brim + badge on the chest.
  if (opts.cap) {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.3), darkMat);
    crown.position.y = 0.33;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.14), darkMat);
    brim.position.set(0, 0.29, 0.19);
    head.add(crown, brim);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.02), new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x554400 }));
    badge.position.set(-0.14, 1.42, 0.16);
    g.add(badge);
  }
  g.add(hips, chest, shoulderL, shoulderR, neck, head);

  // Arms: shoulder pivot -> upper arm (shirt) -> elbow pivot -> forearm
  // (skin) -> hand. Pivots sit at the joint so swings look like swings.
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.34 * side, 1.5, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.16), shirtMat);
    upper.position.y = -0.17;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.14), skinMat);
    fore.position.y = -0.16;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.12), skinMat);
    hand.position.y = -0.38;
    elbow.add(fore, hand);
    g.add(shoulder);
    return { shoulder, elbow, hand };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Legs: hip pivot -> thigh -> knee pivot -> shin -> shoe.
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.12 * side, 0.88, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.42, 0.19), pantsMat);
    thigh.position.y = -0.21;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.17), pantsMat);
    shin.position.y = -0.2;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), shoeMat);
    shoe.position.set(0, -0.44, 0.05);
    knee.add(shin, shoe);
    g.add(hip);
    return { hip, knee };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  g.userData = {
    hipL: legL.hip, hipR: legR.hip, kneeL: legL.knee, kneeR: legR.knee,
    shoulderL: armL.shoulder, shoulderR: armR.shoulder,
    elbowL: armL.elbow, elbowR: armR.elbow,
    handL: armL.hand, handR: armR.hand,
    head, torso: chest,
  };
  return g;
}

export function createRenderer(canvas, hudRoot, city, callbacks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 280, 820);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);

  scene.add(skyDome());
  scene.add(new THREE.HemisphereLight(0xffb38a, 0x2a1a33, 0.95));
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.9);
  sun.position.set(-160, 190, -80);
  scene.add(sun);

  // Which way a building faces: the street in front of its plot.
  function frontFace(b) {
    const col = Math.max(0, Math.min(7, Math.floor((b.x + 225) / PITCH)));
    const row = Math.max(0, Math.min(5, Math.floor((b.z + 175) / PITCH)));
    const cx = ROAD_X[col] + PITCH / 2;
    const cz = ROAD_Z[row] + PITCH / 2;
    const dx = b.x - cx; const dz = b.z - cz;
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? { nx: 1, nz: 0, ry: Math.PI / 2 } : { nx: -1, nz: 0, ry: -Math.PI / 2 };
    return dz > 0 ? { nx: 0, nz: 1, ry: 0 } : { nx: 0, nz: -1, ry: Math.PI };
  }
  // Facade materials per building: the floor-band texture repeats up the
  // facade so windows stay a constant size; the roof is a darker cap.
  const roofMatCache = new Map();
  function facadeMaterials(b, mainH) {
    const tex = facadeTexture(b.style, b.color, b.winLit).clone();
    tex.repeat.set(Math.max(1, Math.round(b.w / 12)), Math.max(1, Math.round(mainH / 3.2)));
    tex.needsUpdate = true;
    const side = new THREE.MeshLambertMaterial({ map: tex });
    if (!roofMatCache.has(b.color)) roofMatCache.set(b.color, new THREE.MeshLambertMaterial({ color: new THREE.Color(b.color).multiplyScalar(0.45) }));
    const top = roofMatCache.get(b.color);
    return [side, side, top, top, side, side];
  }

  // Ground: asphalt base, sidewalk slabs, beach sand, sea, docks.
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2e2a33 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.x1 - BOUNDS.x0 + 120, BOUNDS.z1 - BOUNDS.z0 + 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, 0, (BOUNDS.z0 + BOUNDS.z1) / 2);
  scene.add(ground);
  // Sidewalks: slab-grid texture (one clone per slab so the joints stay
  // 4 m apart no matter the slab size).
  const walkTexBase = sidewalkTexture();
  for (const s of city.sidewalks) {
    const tex = walkTexBase.clone();
    tex.repeat.set(Math.max(1, Math.round(s.w / 8)), Math.max(1, Math.round(s.d / 8)));
    tex.needsUpdate = true;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.12, s.d), new THREE.MeshLambertMaterial({ map: tex }));
    slab.position.set(s.x, 0.06, s.z);
    scene.add(slab);
  }
  // Park lawns (one green slab per park, just above the sidewalk).
  const grassMats = [new THREE.MeshLambertMaterial({ color: 0x4a8f3f }), new THREE.MeshLambertMaterial({ color: 0x3f7d38 })];
  city.parks.forEach((pk, i) => {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 4, BLOCK - 4), grassMats[i % 2]);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(pk.x, 0.13, pk.z);
    scene.add(lawn);
  });
  // Curbs: low strips along every road edge, segmented per block so they
  // never cut across an intersection.
  const curbGeo = new THREE.BoxGeometry(0.3, 0.14, 1);
  const curbMat = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  const curbXf = [];
  for (const x of ROAD_X) {
    for (let j = 0; j < ROAD_Z.length - 1; j += 1) {
      const z0 = ROAD_Z[j] + ROAD_W / 2 + 1; const z1 = ROAD_Z[j + 1] - ROAD_W / 2 - 1;
      curbXf.push([x - ROAD_W / 2 - 0.15, (z0 + z1) / 2, z1 - z0, 0]);
      curbXf.push([x + ROAD_W / 2 + 0.15, (z0 + z1) / 2, z1 - z0, 0]);
    }
  }
  for (const z of ROAD_Z) {
    for (let i = 0; i < ROAD_X.length - 1; i += 1) {
      const x0 = ROAD_X[i] + ROAD_W / 2 + 1; const x1 = ROAD_X[i + 1] - ROAD_W / 2 - 1;
      curbXf.push([(x0 + x1) / 2, z - ROAD_W / 2 - 0.15, x1 - x0, Math.PI / 2]);
      curbXf.push([(x0 + x1) / 2, z + ROAD_W / 2 + 0.15, x1 - x0, Math.PI / 2]);
    }
  }
  const curbs = new THREE.InstancedMesh(curbGeo, curbMat, curbXf.length);
  {
    const m = new THREE.Matrix4();
    curbXf.forEach(([cx, cz, len, ry], i) => {
      m.makeRotationY(ry);
      m.scale(new THREE.Vector3(1, 1, len));
      m.setPosition(cx, 0.07, cz);
      curbs.setMatrixAt(i, m);
    });
  }
  scene.add(curbs);
  // Street props: lamps, hydrants, benches, planters, bins — one merged
  // mesh (+ one glow mesh for the lamp heads).
  const propParts = [];
  const propGlow = [];
  for (const pr of city.props) {
    if (pr.kind === 'lamp') {
      const roadX = ROAD_X[Math.max(0, Math.min(8, Math.round((pr.x + 200) / PITCH)))];
      const dir = Math.sign(roadX - pr.x) || 1;
      propParts.push(partGeo(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 6), pr.x, 2.3, pr.z, 0x222226));
      propParts.push(partBox(1.4, 0.1, 0.1, pr.x + dir * 0.7, 4.55, pr.z, 0x222226));
      propGlow.push(partBox(0.5, 0.16, 0.28, pr.x + dir * 1.3, 4.45, pr.z, 0xffd98a));
    } else if (pr.kind === 'hydrant') {
      propParts.push(partGeo(new THREE.CylinderGeometry(0.28, 0.32, 0.8, 8), pr.x, 0.4, pr.z, 0xcc2222));
      propParts.push(partGeo(new THREE.SphereGeometry(0.22, 8, 6), pr.x, 0.9, pr.z, 0xcc2222));
    } else if (pr.kind === 'bench') {
      propParts.push(partBox(2.0, 0.08, 0.5, pr.x, 0.5, pr.z, 0x8a6a4a, pr.angle));
      propParts.push(partBox(2.0, 0.5, 0.08, pr.x, 0.85, pr.z - 0.25, 0x8a6a4a, pr.angle));
      propParts.push(partBox(0.1, 0.5, 0.5, pr.x - 0.8, 0.25, pr.z, 0x222226, pr.angle));
      propParts.push(partBox(0.1, 0.5, 0.5, pr.x + 0.8, 0.25, pr.z, 0x222226, pr.angle));
    } else if (pr.kind === 'planter') {
      propParts.push(partBox(1.2, 0.7, 1.2, pr.x, 0.35, pr.z, 0x6b4a2f));
      propParts.push(partGeo(new THREE.IcosahedronGeometry(0.8, 0), pr.x, 1.1, pr.z, 0x3f9e4d));
    } else if (pr.kind === 'bin') {
      propParts.push(partGeo(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 8), pr.x, 0.45, pr.z, 0x2a2f45));
    }
  }
  const propMesh = new THREE.Mesh(mergeParts(propParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(propMesh);
  const propGlowMesh = new THREE.Mesh(mergeParts(propGlow), new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(propGlowMesh);
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xe8c98a });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(city.beach.x1 - city.beach.x0, city.beach.z1 - city.beach.z0), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((city.beach.x0 + city.beach.x0) / 2 + (city.beach.x1 - city.beach.x0) / 2, 0.02, (city.beach.z0 + city.beach.z1) / 2);
  scene.add(sand);
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x2a6f8f, emissive: 0x0a2a44 });
  for (const sea of [city.sea, city.seaEast]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sea.x1 - sea.x0, sea.z1 - sea.z0), seaMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((sea.x0 + sea.x1) / 2, 0.01, (sea.z0 + sea.z1) / 2);
    scene.add(m);
  }
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
  const dock = new THREE.Mesh(new THREE.BoxGeometry(city.docks.x1 - city.docks.x0, 0.5, city.docks.z1 - city.docks.z0), dockMat);
  dock.position.set((city.docks.x0 + city.docks.x1) / 2, 0.25, (city.docks.z0 + city.docks.z1) / 2);
  scene.add(dock);
  for (const c of city.containers) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6), new THREE.MeshLambertMaterial({ color: c.color }));
    box.position.set(c.x, 1.8, c.z);
    box.rotation.y = c.angle;
    scene.add(box);
  }

  // Buildings: one textured body mesh each (district facade) + one merged
  // mesh for ALL the roof kit, balconies, parapets and awnings in the city,
  // + glowing storefront planes and sign boards.
  const detailParts = [];
  const glowParts = [];
  const shopSignTex = new Map();
  function shopSignTexture(text) {
    if (!shopSignTex.has(text)) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#120a18'; g.fillRect(0, 0, 256, 64);
      g.font = 'bold 36px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff5a8a'; g.shadowBlur = 14;
      g.fillStyle = '#ffd166';
      g.fillText(text, 128, 34);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      shopSignTex.set(text, t);
    }
    return shopSignTex.get(text);
  }
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2436 });
  for (const b of city.buildings) {
    const mainH = b.tier > 0 ? b.h * 0.7 : b.h;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, mainH, b.d), facadeMaterials(b, mainH));
    mesh.position.set(b.x, mainH / 2 + 0.12, b.z);
    scene.add(mesh);
    // Stepped setback crown on tall glass towers.
    let topY = mainH + 0.12;
    if (b.tier > 0) {
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.72, b.h * 0.2, b.d * 0.72), glassMat);
      t1.position.set(b.x, topY + b.h * 0.1, b.z);
      scene.add(t1);
      topY += b.h * 0.2;
      if (b.tier > 1) {
        const t2 = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.45, b.h * 0.1, b.d * 0.45), glassMat);
        t2.position.set(b.x, topY + b.h * 0.05, b.z);
        scene.add(t2);
        topY += b.h * 0.1;
      }
    }
    const f = frontFace(b);
    const fx = b.x + f.nx * b.w / 2; const fz = b.z + f.nz * b.d / 2;
    const ox = f.nx; const oz = f.nz;
    // Roof kit.
    if (b.roof === 'ac') {
      detailParts.push(partBox(0.9, 0.5, 0.9, b.x - 2, topY + 0.25, b.z - 1, 0x9aa0a8));
      detailParts.push(partBox(0.9, 0.5, 0.9, b.x + 2, topY + 0.25, b.z + 1, 0x8a9098));
    } else if (b.roof === 'tank') {
      detailParts.push(partGeo(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 8), b.x, topY + 1.2, b.z, 0x6b4a2f));
      detailParts.push(partBox(0.2, 0.6, 0.2, b.x - 0.7, topY + 0.3, b.z, 0x4a3423));
      detailParts.push(partBox(0.2, 0.6, 0.2, b.x + 0.7, topY + 0.3, b.z, 0x4a3423));
    } else if (b.roof === 'antenna') {
      detailParts.push(partBox(0.1, 4.2, 0.1, b.x, topY + 2.1, b.z, 0x222226));
      glowParts.push(partGeo(new THREE.SphereGeometry(0.18, 6, 5), b.x, topY + 4.3, b.z, 0xff3b30));
    } else if (b.roof === 'vent') {
      detailParts.push(partBox(1.4, 0.9, 1.4, b.x - 2, topY + 0.45, b.z, 0x7a7f88));
      detailParts.push(partBox(1.4, 0.9, 1.4, b.x + 2, topY + 0.45, b.z, 0x6a6f78));
    }
    // Brick parapet around the roof edge.
    if (b.style === 'brick') {
      const py = topY + 0.25;
      detailParts.push(partBox(b.w, 0.5, 0.25, b.x, py, b.z - b.d / 2 + 0.12, 0x5a2a20));
      detailParts.push(partBox(b.w, 0.5, 0.25, b.x, py, b.z + b.d / 2 - 0.12, 0x5a2a20));
      detailParts.push(partBox(0.25, 0.5, b.d, b.x - b.w / 2 + 0.12, py, b.z, 0x5a2a20));
      detailParts.push(partBox(0.25, 0.5, b.d, b.x + b.w / 2 - 0.12, py, b.z, 0x5a2a20));
    }
    // Hotel balconies on the front face, one per floor.
    if (b.style === 'hotel') {
      for (let fl = 1; fl < b.floors; fl += 1) {
        const by = 0.12 + fl * 3.2;
        detailParts.push(partBox(b.w * 0.7, 0.14, 1.0, fx + ox * 0.5, by, fz + oz * 0.5, 0xd8cfc0, f.ry));
        detailParts.push(partBox(b.w * 0.7, 0.5, 0.06, fx + ox * 0.98, by + 0.3, fz + oz * 0.98, 0x8a7f70, f.ry));
      }
    }
    // Shop front: striped awning + sign board + glowing storefront.
    if (b.shop) {
      const ax = fx + ox * 0.9; const az = fz + oz * 0.9;
      detailParts.push(partGeo(new THREE.BoxGeometry(b.w * 0.7, 0.08, 1.6), ax, 2.7, az, b.shop.awning, f.ry, -0.45));
      glowParts.push(partGeo(new THREE.PlaneGeometry(b.w * 0.7, 2.2), fx + ox * 0.06, 1.3, fz + oz * 0.06, 0xffd98a, f.ry));
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(b.w * 0.6, 8), 1.1),
        new THREE.MeshBasicMaterial({ map: shopSignTexture(b.shop.text) }),
      );
      sign.position.set(fx + ox * 0.12, 3.7, fz + oz * 0.12);
      sign.rotation.y = f.ry;
      scene.add(sign);
    }
  }
  const detailMesh = new THREE.Mesh(mergeParts(detailParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(detailMesh);
  const glowMesh = new THREE.Mesh(mergeParts(glowParts), new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(glowMesh);

  // Road dashes + zebra stripes as instanced strips.
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c4 });
  const dashGeo = new THREE.BoxGeometry(0.5, 0.02, 3.2);
  const dashes = new THREE.InstancedMesh(dashGeo, stripeMat, city.dashes.length);
  {
    const m = new THREE.Matrix4();
    city.dashes.forEach((d, i) => {
      m.makeRotationY(d.axis === 'x' ? Math.PI / 2 : 0);
      m.setPosition(d.x, 0.03, d.z);
      dashes.setMatrixAt(i, m);
    });
  }
  scene.add(dashes);
  const zebraGeo = new THREE.BoxGeometry(2.2, 0.02, 0.9);
  const zebras = new THREE.InstancedMesh(zebraGeo, stripeMat, city.zebras.length * 5);
  {
    const m = new THREE.Matrix4();
    let k = 0;
    for (const z of city.zebras) {
      for (let s = -2; s <= 2; s += 1) {
        m.makeRotationY(z.axis === 'x' ? 0 : Math.PI / 2);
        m.setPosition(z.axis === 'x' ? z.x + s * 2.6 : z.x, 0.03, z.axis === 'x' ? z.z : z.z + s * 2.6);
        zebras.setMatrixAt(k, m);
        k += 1;
      }
    }
  }
  scene.add(zebras);

  // Traffic lights: instanced poles + heads + lit dots (green/red by index).
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.4, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, city.lights.length);
  const headGeo = new THREE.BoxGeometry(0.5, 1.1, 0.5);
  const heads = new THREE.InstancedMesh(headGeo, poleMat, city.lights.length);
  const dotGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, city.lights.length);
  {
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    city.lights.forEach((l, i) => {
      m.identity(); m.setPosition(l.x, 2.2, l.z); poles.setMatrixAt(i, m);
      m.identity(); m.setPosition(l.x, 4.5, l.z); heads.setMatrixAt(i, m);
      m.identity(); m.setPosition(l.x, 4.7, l.z); dots.setMatrixAt(i, m);
      dots.setColorAt(i, col.setHex(i % 2 === 0 ? 0x37e05a : 0xff3b30));
    });
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
  }
  scene.add(poles); scene.add(heads); scene.add(dots);

  // Palms + park trees: instanced trunks + foliage.
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 3.4, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafGeo = new THREE.IcosahedronGeometry(1.5, 0);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const allTrees = [...city.palms.map((p) => ({ ...p, park: false })), ...city.parkTrees.map((p) => ({ ...p, park: true }))];
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, allTrees.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, allTrees.length);
  {
    const m = new THREE.Matrix4();
    allTrees.forEach((t, i) => {
      m.makeScale(t.s, t.s, t.s); m.setPosition(t.x, 1.7 * t.s, t.z); trunks.setMatrixAt(i, m);
      m.makeScale(t.s, t.s * 0.8, t.s); m.setPosition(t.x, (3.4 + 0.9) * t.s, t.z); leaves.setMatrixAt(i, m);
    });
  }
  scene.add(trunks); scene.add(leaves);

  // ---- Sunset + neon dressing (poster refs: pink/teal neon, purple-orange sky)
  // Sun disc low in the west + halo.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(55, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  sunDisc.position.set(-680, 105, -260);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(120, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8c5a, transparent: true, opacity: 0.22, fog: false }),
  );
  sunGlow.position.set(-685, 105, -265);
  sunGlow.lookAt(0, 40, 0);
  scene.add(sunGlow);

  // Wet asphalt: a Phong sheen on the ground + dark puddle planes on the roads.
  // (ground was added above as Lambert; swap its material here.)
  const groundTex = groundTexture();
  groundTex.repeat.set(48, 48);
  ground.material = new THREE.MeshPhongMaterial({ color: 0xffffff, map: groundTex, shininess: 90, specular: 0x775577 });
  const puddleMat = new THREE.MeshBasicMaterial({ color: 0x1a2a44, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 8; i += 1) {
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = i % 2 === 0 ? 0 : Math.PI / 2;
    puddle.position.set(ROAD_X[i], 0.04, ROAD_Z[(i * 2) % ROAD_Z.length] + 3);
    scene.add(puddle);
  }

  // Neon signs on tall buildings (canvas text, pink/teal glow) + neon edge strips.
  function signTexture(text, fg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 80;
    const g = c.getContext('2d');
    g.fillStyle = '#120a18'; g.fillRect(0, 0, 256, 80);
    g.font = 'bold 44px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 18;
    g.fillStyle = fg;
    g.fillText(text, 128, 42);
    g.shadowBlur = 0;
    g.strokeStyle = fg; g.lineWidth = 3;
    g.strokeRect(4, 4, 248, 72);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const SIGNS = [
    ['HOTEL', '#ff5a8a'], ['ARCADE', '#2ec4b6'], ['TACOS', '#ffb347'],
    ['24/7', '#ffffff'], ['OCEAN DR', '#ff5a8a'], ['VICE', '#2ec4b6'],
  ];
  const tall = city.buildings.filter((b) => b.h >= 15).sort((a, b) => a.x - b.x);
  tall.slice(0, 12).forEach((b, i) => {
    const [text, fg] = SIGNS[i % SIGNS.length];
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 3.4),
      new THREE.MeshBasicMaterial({ map: signTexture(text, fg) }),
    );
    sign.position.set(b.x, Math.min(b.h - 2.5, 12), b.z + b.d / 2 + 0.2);
    scene.add(sign);
  });
  const neonStripMats = [new THREE.MeshBasicMaterial({ color: 0xff2a7a }), new THREE.MeshBasicMaterial({ color: 0x2ec4b6 })];
  tall.filter((b) => b.h >= 25).slice(0, 8).forEach((b, i) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, b.h * 0.9, 0.35), neonStripMats[i % 2]);
    strip.position.set(b.x + b.w / 2 + 0.2, b.h * 0.45 + 0.12, b.z + b.d / 2 + 0.2);
    scene.add(strip);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.3, 0.35), neonStripMats[(i + 1) % 2]);
    roof.position.set(b.x, b.h + 0.2, b.z + b.d / 2 + 0.2);
    scene.add(roof);
  });

  // ---- Dynamic entities -------------------------------------------------
  const carMeshes = new Map(); // car id -> group
  function carMesh(car) {
    if (!carMeshes.has(car.id)) {
      const isPolice = car.color === 0x1c2f6e;
      const g = makeCarMesh(car.model, car.color, isPolice);
      scene.add(g);
      carMeshes.set(car.id, g);
    }
    return carMeshes.get(car.id);
  }

  const pedMeshes = new Map();
  const PED_SHIRTS = [0x4fc3f7, 0xffd166, 0x8fd694, 0xff8fa3, 0xf9c784, 0xe07a5f];
  function pedMesh(i, ped, shirt) {
    if (!pedMeshes.has(i)) {
      const isCop = shirt === 0x1c2f6e;
      const g = makeFigureMesh({
        shirt: shirt ?? PED_SHIRTS[i % PED_SHIRTS.length],
        pants: ped?.pants ?? 0x2a2f45,
        skin: ped?.skin, hair: ped?.hair, hairStyle: ped?.hairStyle,
        cap: isCop,
      });
      scene.add(g);
      pedMeshes.set(i, g);
    }
    return pedMeshes.get(i);
  }

  // Rico Vega: Hawaiian shirt (floral canvas texture), dark hair, sunglasses,
  // tattoo band on the left forearm, gold chain — the poster look, low-poly.
  const hawaiiTex = hawaiiTexture();
  const playerMesh = makeFigureMesh({
    shirt: 0xe33e2a, pants: 0x1e2a52, shirtTex: hawaiiTex,
    skin: 0xd9a066, hair: 0x1a1210, hairStyle: 'cap',
  });
  {
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.04), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    shades.position.set(0, 0.16, 0.15);
    playerMesh.userData.head.add(shades);
    const tattoo = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    tattoo.position.set(0, -0.16, 0);
    playerMesh.userData.elbowL.add(tattoo);
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.02), new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x554400 }));
    chain.position.set(0, 1.48, 0.16);
    playerMesh.add(chain);
  }
  scene.add(playerMesh);
  // The gun rides in Rico's right hand so it follows the aim pose.
  const gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.55), new THREE.MeshLambertMaterial({ color: 0x14161c }));
  gunMesh.position.set(0, -0.4, 0.14);
  gunMesh.rotation.x = -0.35;
  playerMesh.userData.elbowR.add(gunMesh);

  // Blob shadows (cheap grounding, no shadow maps).
  const blobGeo = new THREE.CircleGeometry(1, 12);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 });
  const playerBlob = new THREE.Mesh(blobGeo, blobMat);
  playerBlob.rotation.x = -Math.PI / 2; playerBlob.scale.setScalar(1.1);
  scene.add(playerBlob);

  // Collectibles: spinning gold octahedrons.
  const collectMeshes = city.collectibles.map((c) => {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9),
      new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x8a6d00 }),
    );
    m.position.set(c.x, 1.6, c.z);
    scene.add(m);
    return m;
  });

  // Mission marker: glowing cylinder + bobbing cone.
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35 });
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true), markerMat);
  marker.position.y = 15;
  scene.add(marker);
  const markerArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  scene.add(markerArrow);

  // Pickups: health (white + red cross) / armour (blue).
  const pickupMeshes = city.pickups.map((pk) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({
      color: pk.kind === 'health' ? 0xf5f5f5 : 0x3a6fd8, emissive: pk.kind === 'health' ? 0x661111 : 0x0a2266,
    }));
    g.add(box);
    if (pk.kind === 'health') {
      const crossMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.05), crossMat);
      c1.position.z = 0.51;
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.05), crossMat);
      c2.position.z = 0.51;
      g.add(c1, c2);
    }
    g.position.set(pk.x, 1, pk.z);
    scene.add(g);
    return g;
  });

  // Stunt jump ramps.
  for (const j of city.jumps) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 7), new THREE.MeshLambertMaterial({ color: 0xffd166 }));
    ramp.position.set(j.x, 0.9, j.z);
    ramp.rotation.y = j.angle;
    ramp.rotation.x = -0.35;
    scene.add(ramp);
  }

  // Muzzle tracer pool.
  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 4; i += 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, tracerMat);
    line.visible = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerIdx = 0;
  function fireTracer(from, to) {
    const t = tracers[tracerIdx];
    tracerIdx = (tracerIdx + 1) % tracers.length;
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.visible = true;
    t.life = 0.09;
  }

  // ---- HUD (DOM) ---------------------------------------------------------
  const hud = hudRoot;
  hud.innerHTML = `
    <div id="hud-mission"><div id="hud-mission-title"></div><div id="hud-mission-text"></div><div id="hud-mission-next"></div></div>
    <div id="hud-status"><div id="hud-clock"></div><div id="hud-money"></div><div id="hud-stars"></div></div>
    <div id="hud-bars">
      <div class="hud-bar"><span>HEALTH</span><div class="hud-bar-track"><div id="hud-health" class="hud-bar-fill health"></div></div></div>
      <div class="hud-bar"><span>ARMOUR</span><div class="hud-bar-track"><div id="hud-armour" class="hud-bar-fill armour"></div></div></div>
      <div class="hud-bar"><span>RESPECT</span><div class="hud-bar-track"><div id="hud-respect" class="hud-bar-fill respect"></div></div><b id="hud-respect-n"></b></div>
    </div>
    <div id="hud-weapons"></div>
    <div id="hud-hint">WASD move · SHIFT sprint · SPACE jump · F enter car · LMB shoot · RMB aim · 1-4 weapon · R reload · E interact · M map · ESC pause</div>
    <div id="hud-toast"></div>
    <div id="hud-radio"></div>
    <canvas id="hud-minimap" width="180" height="180"></canvas>
    <div id="screen-title" class="screen">
      <h1>KOTA SEJA</h1>
      <p class="tagline">The sun never sets on the hustle.</p>
      <p class="story">Rico Vega is out — and he owes $50,000. Eight jobs across four districts stand between him and freedom.</p>
      <div class="features">8 MISSIONS ACROSS 4 DISTRICTS · 40+ RIDES TO STEAL · SIDE QUESTS &amp; SECRETS · AUTOSAVES AFTER EACH MISSION</div>
      <div class="menu-buttons">
        <button id="btn-new">NEW GAME</button>
        <button id="btn-continue">CONTINUE</button>
        <button id="btn-controls">CONTROLS</button>
      </div>
      <p class="save-line" id="save-line"></p>
    </div>
    <div id="screen-pause" class="screen hidden">
      <h1>PAUSED</h1>
      <p class="story">Kota Seja waits for no one. Except now.</p>
      <div class="menu-buttons"><button id="btn-resume">RESUME</button><button id="btn-restart">RESTART</button></div>
    </div>
    <div id="screen-map" class="screen hidden">
      <h1>CITY MAP</h1>
      <p class="story">Click: set waypoint · M / Esc: close</p>
      <canvas id="hud-bigmap" width="900" height="640"></canvas>
    </div>
    <div id="screen-end" class="screen hidden">
      <h1 id="end-title">BUSTED</h1>
      <p class="story" id="end-text"></p>
      <div class="menu-buttons"><button id="btn-again">TRY AGAIN</button></div>
    </div>
    <div id="screen-controls" class="screen hidden">
      <h1>CONTROLS</h1>
      <p class="story">WASD move · MOUSE look · SHIFT sprint · SPACE jump<br>F enter car · LMB shoot · RMB aim · 1-4 weapons · R reload<br>E interact · M map · ESC pause</p>
      <div class="menu-buttons"><button id="btn-controls-back">BACK</button></div>
    </div>`;
  const $ = (id) => hud.querySelector('#' + id);
  const minimap = $('hud-minimap');
  const bigmap = $('hud-bigmap');
  const weaponEls = [];
  for (let i = 0; i < 4; i += 1) {
    const d = document.createElement('div');
    d.className = 'weapon-slot';
    $('hud-weapons').appendChild(d);
    weaponEls.push(d);
  }
  $('btn-new').addEventListener('click', () => callbacks.onNewGame());
  $('btn-continue').addEventListener('click', () => callbacks.onContinue());
  $('btn-controls').addEventListener('click', () => callbacks.onControls());
  $('btn-controls-back').addEventListener('click', () => callbacks.onControlsBack());
  $('btn-resume').addEventListener('click', () => callbacks.onResume());
  $('btn-restart').addEventListener('click', () => callbacks.onRestart());
  $('btn-again').addEventListener('click', () => callbacks.onRestart());
  bigmap.addEventListener('click', (ev) => {
    const r = bigmap.getBoundingClientRect();
    const wx = ((ev.clientX - r.left) / r.width) * (BOUNDS.x1 - BOUNDS.x0) + BOUNDS.x0;
    const wz = ((ev.clientY - r.top) / r.height) * (BOUNDS.z1 - BOUNDS.z0) + BOUNDS.z0;
    callbacks.onWaypoint(wx, wz);
  });

  // Toast + radio queues (DOM, capped).
  const toasts = [];
  function showToast(text) {
    toasts.push(text);
    if (toasts.length > 3) toasts.shift();
    $('hud-toast').innerHTML = toasts.map((t) => `<div>${t}</div>`).join('');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toasts.length = 0; $('hud-toast').innerHTML = ''; }, 6000);
  }
  const radioLines = [];
  function showRadio(text) {
    radioLines.push(text);
    if (radioLines.length > 2) radioLines.shift();
    $('hud-radio').innerHTML = radioLines.map((t) => `<div>${t}</div>`).join('');
    clearTimeout(showRadio._t);
    showRadio._t = setTimeout(() => { radioLines.length = 0; $('hud-radio').innerHTML = ''; }, 9000);
  }

  function drawMap(ctx, size, state, big) {
    const w = BOUNDS.x1 - BOUNDS.x0; const h = BOUNDS.z1 - BOUNDS.z0;
    const sx = size / w; const sz = size / h;
    const X = (x) => (x - BOUNDS.x0) * sx;
    const Z = (z) => (z - BOUNDS.z0) * sz;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#241a2e'; ctx.fillRect(0, 0, size, size);
    // Sea + beach.
    ctx.fillStyle = '#2a6f8f';
    ctx.fillRect(X(city.sea.x0), Z(city.sea.z0), (city.sea.x1 - city.sea.x0) * sx, (city.sea.z1 - city.sea.z0) * sz);
    ctx.fillRect(X(city.seaEast.x0), Z(city.seaEast.z0), (city.seaEast.x1 - city.seaEast.x0) * sx, (city.seaEast.z1 - city.seaEast.z0) * sz);
    ctx.fillStyle = '#e8c98a';
    ctx.fillRect(X(city.beach.x0), Z(city.beach.z0), (city.beach.x1 - city.beach.x0) * sx, (city.beach.z1 - city.beach.z0) * sz);
    // Roads.
    ctx.strokeStyle = '#5a5260'; ctx.lineWidth = big ? 7 : 4;
    for (const x of ROAD_X) { ctx.beginPath(); ctx.moveTo(X(x), Z(-175)); ctx.lineTo(X(x), Z(195)); ctx.stroke(); }
    for (const z of ROAD_Z) { ctx.beginPath(); ctx.moveTo(X(-225), Z(z)); ctx.lineTo(X(245), Z(z)); ctx.stroke(); }
    // Districts (faint labels on the big map only).
    if (big) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const d of DISTRICTS) ctx.fillText(d.name.toUpperCase(), X((d.x0 + d.x1) / 2), Z((d.z0 + d.z1) / 2));
    }
    // Collectibles.
    ctx.fillStyle = '#ffd166';
    city.collectibles.forEach((c, i) => {
      if (!state.collectibles[i]) { ctx.beginPath(); ctx.arc(X(c.x), Z(c.z), big ? 4 : 2, 0, Math.PI * 2); ctx.fill(); }
    });
    // Mission target.
    if (state.mission.active) {
      const m = MISSIONS[state.mission.id - 1];
      const stage = m.stages[state.mission.stage];
      const tx = stage.x ?? (stage.points ? stage.points[0][0] : null);
      const tz = stage.z ?? (stage.points ? stage.points[0][1] : null);
      if (tx !== null && tz !== null) {
        ctx.fillStyle = '#ff5a3c';
        ctx.beginPath(); ctx.arc(X(tx), Z(tz), big ? 9 : 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${big ? 12 : 9}px system-ui, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(String.fromCharCode(64 + state.mission.id), X(tx), Z(tz) + (big ? 4 : 3));
      }
    }
    // Waypoint.
    if (state.waypoint) {
      ctx.strokeStyle = '#37e05a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(state.waypoint.x), Z(state.waypoint.z), big ? 8 : 5, 0, Math.PI * 2); ctx.stroke();
    }
    // Police (red dots) when wanted.
    if (state.wanted > 0) {
      ctx.fillStyle = '#ff3b30';
      for (const c of state.police) { ctx.beginPath(); ctx.arc(X(c.x), Z(c.z), big ? 4 : 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // Player arrow (rotated by camera yaw).
    const px = X(state.player.x); const pz = Z(state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - state.cam.yaw);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, big ? -9 : -7); ctx.lineTo(big ? 6 : 5, big ? 7 : 5); ctx.lineTo(0, big ? 3 : 2); ctx.lineTo(big ? -6 : -5, big ? 7 : 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // North.
    ctx.fillStyle = '#fff'; ctx.font = `bold ${big ? 16 : 12}px system-ui, sans-serif`; ctx.textAlign = 'left';
    ctx.fillText('N', 8, 18);
  }

  // ---- Per-frame sync ----------------------------------------------------
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let lastHud = '';
  let lastScreen = null;

  // Walk cycle on the articulated figure: hips swing, knees bend on the
  // lift, arms counter-swing, torso leans into a run. `phase` advances with
  // the stride; `amp` is 0 when idle. Returns the vertical bob.
  function animateFigure(u, phase, amp, opts = {}) {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    u.hipL.rotation.x = s * 0.55 * amp;
    u.hipR.rotation.x = -s * 0.55 * amp;
    u.kneeL.rotation.x = Math.max(0, -s) * 0.95 * amp;
    u.kneeR.rotation.x = Math.max(0, s) * 0.95 * amp;
    if (opts.aim) {
      // Right arm forward holding the gun, left arm across the chest.
      u.shoulderR.rotation.x = -1.35;
      u.elbowR.rotation.x = -0.08;
      u.shoulderL.rotation.x = -0.85;
      u.elbowL.rotation.x = -0.7;
      u.torso.rotation.x = 0.04;
    } else {
      u.shoulderL.rotation.x = -s * 0.45 * amp;
      u.shoulderR.rotation.x = s * 0.45 * amp;
      u.elbowL.rotation.x = -0.2 - Math.max(0, s) * 0.25 * amp;
      u.elbowR.rotation.x = -0.2 - Math.max(0, -s) * 0.25 * amp;
      u.torso.rotation.x = opts.run ? 0.1 * amp : 0.02 * amp;
    }
    u.head.rotation.x = opts.aim ? -0.05 : 0;
    return Math.abs(c) * 0.05 * amp;
  }

  function syncWorld(state, dt, time, snap = false) {
    const p = state.player;
    // Cars (heading convention: forward = (sin a, cos a); mesh +z is the front).
    for (const car of state.cars) {
      const g = carMesh(car);
      g.position.set(car.x, 0, car.z);
      g.rotation.y = car.angle;
      g.visible = true;
      if (g.userData.wheels) {
        const spin = (car.speed * dt) / g.userData.wheelR;
        for (const wg of g.userData.wheels) wg.rotation.x += spin;
      }
      if (g.userData.flash) {
        const on = Math.floor(time * 4) % 2 === 0;
        g.userData.flash[0].material.emissive.setHex(on ? 0xaa0000 : 0x220000);
        g.userData.flash[1].material.emissive.setHex(on ? 0x000022 : 0x0000aa);
      }
    }
    // Player figure (hidden while driving — he is inside the car).
    playerMesh.visible = p.onFoot;
    gunMesh.visible = p.onFoot && state.weapons.cur > 0;
    if (p.onFoot) {
      playerMesh.position.set(p.x, p.y, p.z);
      playerMesh.rotation.y = p.angle;
      const u = playerMesh.userData;
      if (p.y > 0) {
        // Airborne: tuck the legs, arms out for balance.
        u.hipL.rotation.x = 0.5; u.hipR.rotation.x = -0.3;
        u.kneeL.rotation.x = 0.9; u.kneeR.rotation.x = 0.6;
        u.shoulderL.rotation.x = -0.6; u.shoulderR.rotation.x = -0.6;
        u.elbowL.rotation.x = -0.3; u.elbowR.rotation.x = -0.3;
      } else {
        const phase = time * (p.running ? 13 : 9);
        const amp = p.moving ? (p.running ? 1 : 0.8) : 0;
        const bob = animateFigure(u, phase, amp, { aim: state.aiming, run: p.running });
        playerMesh.position.y = p.y + bob;
      }
      playerBlob.position.set(p.x, 0.03, p.z);
      playerBlob.visible = true;
    } else {
      playerBlob.visible = false;
    }
    // Peds (varied height + walk cycle).
    state.peds.forEach((ped, i) => {
      const g = pedMesh(i, ped, ped.shirt);
      g.visible = !ped.dead;
      if (ped.dead) return;
      g.scale.set(1, ped.height || 1, 1);
      const bob = animateFigure(g.userData, time * 8 + i * 1.7, 0.8, {});
      g.position.set(ped.x, bob, ped.z);
      g.rotation.y = ped.angle;
    });
    // Police on foot are figures too (indices 100+ — clear of the 48 peds).
    state.police.forEach((cop, k) => {
      if (cop.kind !== 'foot') return;
      const g = pedMesh(100 + k, cop, 0x1c2f6e);
      g.visible = true;
      const bob = animateFigure(g.userData, time * 12 + k, 1, {});
      g.position.set(cop.x, bob, cop.z);
      g.rotation.y = cop.angle;
    });
    // Mission runner / race rivals.
    if (state.mission.active) {
      const ss = state.mission.stageState;
      if (ss && ss.runner) {
        const g = pedMesh(200, ss.runner, 0xffd166);
        g.visible = true;
        const bob = animateFigure(g.userData, time * 11, 0.9, {});
        g.position.set(ss.runner.x, bob, ss.runner.z);
        g.rotation.y = ss.runner.angle;
      }
      if (ss && ss.rivals) {
        ss.rivals.forEach((r, i) => {
          const g = carMesh({ id: 1000 + i, model: 'sport', color: 0x8a2be2 });
          g.visible = !r.out;
          g.position.set(r.x, 0, r.z);
          g.rotation.y = r.angle;
        });
      }
    }
    // Collectibles spin + bob; hide when taken.
    collectMeshes.forEach((m, i) => {
      m.visible = !state.collectibles[i];
      if (m.visible) {
        m.rotation.y = time * 1.5;
        m.position.y = 1.6 + Math.sin(time * 2 + i) * 0.25;
      }
    });
    // Pickups bob; hide while on respawn timer.
    pickupMeshes.forEach((g, i) => {
      const pk = state.pickups[i];
      g.visible = pk.taken <= 0;
      if (g.visible) g.rotation.y = time * 0.8;
    });
    // Mission marker at the current objective.
    let mx = null; let mz = null;
    if (state.mission.active) {
      const m = MISSIONS[state.mission.id - 1];
      const stage = m.stages[state.mission.stage];
      if (stage.kind === 'goto' || stage.kind === 'deliver' || stage.kind === 'sabotage' || stage.kind === 'final') { mx = stage.x; mz = stage.z; }
      else if (stage.kind === 'collect') {
        const ss = state.mission.stageState;
        const next = stage.points.findIndex((_, i) => !ss.got[i]);
        if (next >= 0) { mx = stage.points[next][0]; mz = stage.points[next][1]; }
      } else if (stage.kind === 'race') {
        const ss = state.mission.stageState;
        if (ss.cp < stage.points.length) { mx = stage.points[ss.cp][0]; mz = stage.points[ss.cp][1]; }
      }
    }
    if (mx !== null) {
      marker.visible = true; markerArrow.visible = true;
      marker.position.set(mx, 15, mz);
      markerArrow.position.set(mx, 5 + Math.sin(time * 3) * 0.6, mz);
      markerArrow.rotation.y = time;
    } else {
      marker.visible = false; markerArrow.visible = false;
    }
    // Tracers fade.
    for (const t of tracers) {
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) t.line.visible = false;
      }
    }
    // Camera: third person behind the shoulder.
    const yaw = state.cam.yaw;
    const fx = -Math.sin(yaw); const fz = -Math.cos(yaw);
    const driving = !p.onFoot;
    const dist = driving ? 12 : 9;
    const height = driving ? 5.2 : 4.4 + state.cam.pitch * 3;
    camTarget.set(p.x + fx * 6, 1.4, p.z + fz * 6);
    camPos.set(p.x - fx * dist, height, p.z - fz * dist);
    if (snap) camera.position.copy(camPos);
    else camera.position.lerp(camPos, 1 - Math.pow(0.0001, dt));
    camera.lookAt(camTarget);
    camera.fov += ((state.aiming ? 50 : 62) - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }

  function syncHud(state, screen, ui) {
    // Mission tracker.
    const cur = ui.currentStage;
    if (cur) {
      $('hud-mission-title').textContent = `MISSION ${cur.mission.id}/8 · ${cur.mission.name}`;
      $('hud-mission-text').textContent = cur.stage.text;
      const next = MISSIONS[cur.mission.id] ? `NEXT ▸ ${MISSIONS[cur.mission.id].name}` : 'NEXT ▸ —';
      $('hud-mission-next').textContent = `STAGE ${cur.index + 1}/${cur.total} · ${next}`;
    } else {
      $('hud-mission-title').textContent = 'FREE ROAM';
      $('hud-mission-text').textContent = 'No active mission — explore, steal, cause chaos.';
      const nextId = 1 + Object.keys(state.mission.done).length;
      $('hud-mission-next').textContent = nextId <= 8 ? `NEXT ▸ ${MISSIONS[nextId - 1].name}` : 'All missions done.';
    }
    const hh = String(Math.floor(state.clockMin / 60)).padStart(2, '0');
    const mm = String(Math.floor(state.clockMin % 60)).padStart(2, '0');
    $('hud-clock').textContent = `DAY ${state.day} · ${hh}:${mm}`;
    $('hud-money').textContent = `$${state.money.toLocaleString('en-US')}`;
    $('hud-stars').textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    $('hud-stars').style.color = state.wanted > 0 ? '#ffd166' : '#777';
    $('hud-health').style.width = `${state.health}%`;
    $('hud-armour').style.width = `${state.armour}%`;
    $('hud-respect-n').textContent = `LV ${state.respect}`;
    $('hud-respect').style.width = `${Math.min(100, state.respectXp * 4)}%`;
    for (let i = 0; i < 4; i += 1) {
      const def = WEAPONS[i];
      const owned = state.weapons.owned[i];
      const ammo = state.weapons.ammo[i] === Infinity ? '∞' : state.weapons.ammo[i];
      weaponEls[i].textContent = `${i + 1} ${def.name} ${owned ? ammo : '—'}`;
      weaponEls[i].classList.toggle('active', state.weapons.cur === i && owned);
      weaponEls[i].classList.toggle('locked', !owned);
    }
    // Minimap + big map.
    const mmCtx = minimap.getContext('2d');
    drawMap(mmCtx, 180, state, false);
    if (screen === SCREEN_MAP) {
      const bmCtx = bigmap.getContext('2d');
      drawMap(bmCtx, 900, state, true);
    }
    // Screens.
    if (screen !== lastScreen) {
      for (const id of ['screen-title', 'screen-pause', 'screen-map', 'screen-end', 'screen-controls']) $(id).classList.add('hidden');
      if (screen === SCREEN_TITLE) $('screen-title').classList.remove('hidden');
      else if (screen === SCREEN_PAUSED) $('screen-pause').classList.remove('hidden');
      else if (screen === SCREEN_MAP) $('screen-map').classList.remove('hidden');
      else if (screen === SCREEN_END) $('screen-end').classList.remove('hidden');
      else if (screen === 'controls') $('screen-controls').classList.remove('hidden');
      lastScreen = screen;
    }
    if (screen === SCREEN_END && ui.endInfo) {
      $('end-title').textContent = ui.endInfo.kind === 'busted' ? 'BUSTED' : ui.endInfo.kind === 'wasted' ? 'WASTED' : 'KING OF SEJA';
      $('end-text').textContent = ui.endInfo.text;
    }
    if (screen === SCREEN_TITLE && ui.saveLine) $('save-line').textContent = ui.saveLine;
  }

  function resize() {
    const w = window.innerWidth; const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    // `snap` jumps the camera straight to its third-person spot (screenshot
    // mode: no lerping across frames, the subject is in frame on paint one).
    render(state, screen, ui, dt, time, snap = false) {
      syncWorld(state, dt, time, snap);
      syncHud(state, screen, ui);
      renderer.render(scene, camera);
    },
    fireTracer,
    showToast,
    showRadio,
    resize,
    scene,
  };
}


