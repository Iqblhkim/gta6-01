// Kota Seja — a raw WebGL renderer written from scratch.
// No library, no downloaded code: one shader pair, vertex-coloured
// low-poly boxes, a gradient sunset sky, simple sun lighting and fog.
// The city geometry is baked once into a static buffer; cars, people
// and effects are rebuilt into a dynamic buffer every frame.
// Round 7 (2026-11-19): the sky, fog and sun now follow the full
// day/night cycle (packet 4/15/16 — dayPhaseAt from config.js), the
// roads carry real markings and a correct 16-stripe zebra (packet
// 10), buildings have glass offices, pitched roofs and roof details
// (packets 7/8), the street props and parks are baked in (packets
// 12/13), and the dynamic layer adds cheap blob shadows (packet 14),
// headlight beams (packet 6) and a visible officer in every patrol
// car (packet 17). Still one static buffer + one dynamic buffer, no
// shadow maps, no extra draw calls — the phone budget is unchanged.
import { CONFIG, dayPhaseAt } from './config.js';
import { zebraBands } from './city.js';

// ------------------------------------------------------------------ matrices
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far);
  out[11] = -1; out[14] = (2 * far * near) / (near - far);
  return out;
}
function lookAt(eye, target, up) {
  const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  const xx = up[1] * z[2] - up[2] * z[1];
  const xy = up[2] * z[0] - up[0] * z[2];
  const xz = up[0] * z[1] - up[1] * z[0];
  zl = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / zl, xy / zl, xz / zl];
  const y = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ];
  const out = new Float32Array(16);
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
  out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  out[15] = 1;
  return out;
}

// ------------------------------------------------------------------ colour
export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function shade(rgb, f) {
  // Round 6 (packet 13): the cap is 1.8, not 1.0 — ordinary colours
  // are all ≤ 1.0 so nothing existing changes, but neon "hot" colours
  // (components up to ~1.7) survive the shading and read as glowing.
  return [Math.min(1.8, rgb[0] * f), Math.min(1.8, rgb[1] * f), Math.min(1.8, rgb[2] * f)];
}

// Round 6 (packet 12) — vegetation sway: every vertex carries a 10th
// float, its sway weight (0 = rigid). bakeCity sets SWAY_W while it
// emits palm fronds and tree crowns; the vertex shader then bends
// those vertices gently with world time. One uniform, no extra
// geometry, no extra draw calls.
let SWAY_W = 0;

// ------------------------------------------------------------------ geometry
// A box is pushed as 12 triangles: position, normal, colour per vertex.
// Each face gets its own shade so the low-poly look reads without textures.
const FACES = [
  { n: [0, 1, 0], s: 1.0, idx: [1, 5, 4, 0] },   // top
  { n: [0, -1, 0], s: 0.45, idx: [2, 6, 7, 3] }, // bottom
  { n: [0, 0, 1], s: 0.85, idx: [0, 1, 2, 3] },  // front (+z)
  { n: [0, 0, -1], s: 0.7, idx: [5, 4, 7, 6] },  // back
  { n: [1, 0, 0], s: 0.8, idx: [4, 0, 3, 7] },   // right (+x)
  { n: [-1, 0, 0], s: 0.6, idx: [1, 5, 6, 2] },  // left
];
export function pushBox(arr, cx, cy, cz, w, h, d, color, yaw = 0) {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const local = [
    [-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd],
    [-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd],
  ];
  const pts = local.map(([x, y, z]) => [
    cx + x * cos + z * sin,
    cy + y,
    cz - x * sin + z * cos,
  ]);
  const c = typeof color === 'string' ? hexRgb(color) : color;
  for (const face of FACES) {
    const col = shade(c, face.s);
    const [a, b, d2, e] = face.idx;
    const tris = [[a, b, d2], [a, d2, e]];
    for (const [i, j, k] of tris) {
      for (const vi of [i, j, k]) {
        arr.push(pts[vi][0], pts[vi][1], pts[vi][2]);
        arr.push(face.n[0], face.n[1], face.n[2]);
        arr.push(col[0], col[1], col[2]);
        arr.push(SWAY_W); // round 6: sway weight (packet 12)
      }
    }
  }
}
export function pushFlatQuad(arr, x0, z0, x1, z1, y, color) {
  const c = typeof color === 'string' ? hexRgb(color) : color;
  const col = shade(c, 1.0);
  const n = [0, 1, 0];
  const verts = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
    for (const vi of [i, j, k]) {
      arr.push(verts[vi][0], verts[vi][1], verts[vi][2]);
      arr.push(n[0], n[1], n[2]);
      arr.push(col[0], col[1], col[2]);
      arr.push(SWAY_W); // round 6: sway weight (packet 12)
    }
  }
}

// Round 7 — a flat quad rotated around Y (same rotation convention
// as pushBox): blob shadows under cars, headlight pools on the road
// ahead, and anything else that must lie flat but follow a heading.
export function pushFlatQuadRot(arr, cx, cz, w, d, y, color, yaw = 0) {
  const c = typeof color === 'string' ? hexRgb(color) : color;
  const col = shade(c, 1.0);
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const hw = w / 2, hd = d / 2;
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [
    cx + x * cos + z * sin,
    y,
    cz - x * sin + z * cos,
  ]);
  const n = [0, 1, 0];
  for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
    for (const vi of [i, j, k]) {
      arr.push(corners[vi][0], corners[vi][1], corners[vi][2]);
      arr.push(n[0], n[1], n[2]);
      arr.push(col[0], col[1], col[2]);
      arr.push(SWAY_W);
    }
  }
}

// Round 6 — a vertical quad on a building wall (a window, a door):
// face 'z+' / 'z-' is a wall facing +/-z (spans x and y), face 'x+' /
// 'x-' faces +/-x (spans z and y). The renderer never enables face
// culling, so winding does not matter here.
export function pushWallQuad(arr, cx, cy, cz, w, h, color, face) {
  const c = typeof color === 'string' ? hexRgb(color) : color;
  const col = shade(c, face === 'z+' ? 0.85 : face === 'z-' ? 0.7 : 0.8);
  const n = face === 'z+' ? [0, 0, 1] : face === 'z-' ? [0, 0, -1]
    : face === 'x+' ? [1, 0, 0] : [-1, 0, 0];
  const hw = w / 2, hh = h / 2;
  const verts = face[0] === 'z'
    ? [[cx - hw, cy - hh, cz], [cx + hw, cy - hh, cz], [cx + hw, cy + hh, cz], [cx - hw, cy + hh, cz]]
    : [[cx, cy - hh, cz - hw], [cx, cy - hh, cz + hw], [cx, cy + hh, cz + hw], [cx, cy + hh, cz - hw]];
  for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
    for (const vi of [i, j, k]) {
      arr.push(verts[vi][0], verts[vi][1], verts[vi][2]);
      arr.push(n[0], n[1], n[2]);
      arr.push(col[0], col[1], col[2]);
      arr.push(SWAY_W); // round 6: sway weight (packet 12)
    }
  }
}

// ------------------------------------------------------------------ shaders
const MAIN_VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
attribute float aSway; uniform float uTime;
uniform mat4 uProj; uniform mat4 uView;
varying vec3 vColor; varying vec3 vNormal; varying float vDepth;
void main() {
  // Round 6 (packet 12): vegetation sway — vertices with a sway
  // weight drift gently with time (palm fronds and tree crowns).
  // The weight varies along the vertex position so neighbouring
  // fronds do not move in lockstep.
  vec3 p = aPos;
  float sw = aSway * (0.6 + 0.4 * sin(uTime * 0.7 + aPos.x * 0.15 + aPos.z * 0.17));
  p.x += sin(uTime * 0.9 + aPos.y * 0.35 + aPos.z * 0.11) * sw * 0.45;
  p.z += cos(uTime * 0.8 + aPos.y * 0.3 + aPos.x * 0.13) * sw * 0.3;
  vec4 view = uView * vec4(p, 1.0);
  vDepth = -view.z;
  vColor = aColor; vNormal = aNormal;
  gl_Position = uProj * view;
}`;
const MAIN_FRAG = `
precision mediump float;
varying vec3 vColor; varying vec3 vNormal; varying float vDepth;
uniform vec3 uSunDir; uniform vec3 uFogColor;
uniform float uAmbient; uniform float uFogNear; uniform float uFogFar;
void main() {
  float diff = max(dot(normalize(vNormal), normalize(uSunDir)), 0.0);
  // Round 7 (packet 4): the flat light floor follows the day phase
  // — 0.55 at noon, 0.30 at night — so the city dims after dark
  // instead of staying sunset-bright forever.
  float light = uAmbient + (1.0 - uAmbient) * diff;
  vec3 col = vColor * light;
  // Round 7 (packet 15): the fog band follows the phase too —
  // morning haze and night murk close in, noon stays clear.
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
}`;
const SKY_VERT = `
attribute vec2 aPos; varying vec2 vUv;
void main() { vUv = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const SKY_FRAG = `
precision mediump float; varying vec2 vUv;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow;
uniform vec2 uSunPos; uniform vec3 uSunColor;
uniform vec2 uMoonPos; uniform float uNight;
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  // Round 7 (packet 16): the sky is no longer one fixed sunset —
  // its three gradient stops, the sun disc and the moon all come
  // from the day phase (see dayPhaseAt in config.js).
  float h = vUv.y * 0.5 + 0.5;
  vec3 col = h > 0.62 ? mix(uMid, uTop, smoothstep(0.62, 1.0, h))
                       : mix(uLow, uMid, smoothstep(0.0, 0.62, h));
  float d = distance(vUv, uSunPos);
  col += uSunColor * smoothstep(0.28, 0.0, d) * 0.9;
  col += vec3(1.0, 0.95, 0.8) * smoothstep(0.06, 0.0, d) * step(0.01, length(uSunColor));
  // Moon: a pale disc with a faint halo, only after dark.
  float dm = distance(vUv, uMoonPos);
  col += vec3(0.9, 0.93, 1.0) * smoothstep(0.05, 0.0, dm) * uNight * 0.9;
  col += vec3(0.5, 0.55, 0.7) * smoothstep(0.16, 0.0, dm) * uNight * 0.35;
  // Stars: a hashed grid of pinpricks above the horizon, faded in
  // by uNight so the noon sky stays clean.
  vec2 sp = vUv * vec2(60.0, 34.0);
  vec2 cell = floor(sp);
  float hs = hash21(cell);
  float star = step(0.992, hs) * smoothstep(0.35, 0.0, distance(fract(sp), vec2(0.5)));
  col += vec3(0.9, 0.95, 1.0) * star * uNight * smoothstep(0.45, 0.62, h);
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

// ------------------------------------------------------------------ renderer
export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true });
  if (!gl) throw new Error('WebGL is not available in this browser');
  const main = program(gl, MAIN_VERT, MAIN_FRAG);
  const sky = program(gl, SKY_VERT, SKY_FRAG);
  const loc = {
    proj: gl.getUniformLocation(main, 'uProj'),
    view: gl.getUniformLocation(main, 'uView'),
    sun: gl.getUniformLocation(main, 'uSunDir'),
    fog: gl.getUniformLocation(main, 'uFogColor'),
    time: gl.getUniformLocation(main, 'uTime'), // round 6: sway clock
    // Round 7: day/night uniforms (packets 4/15/16).
    ambient: gl.getUniformLocation(main, 'uAmbient'),
    fogNear: gl.getUniformLocation(main, 'uFogNear'),
    fogFar: gl.getUniformLocation(main, 'uFogFar'),
  };
  // Round 7: the sky program's uniforms — gradient stops, sun and
  // moon positions, night factor for the stars and the moon.
  const skyLoc = {
    top: gl.getUniformLocation(sky, 'uTop'),
    mid: gl.getUniformLocation(sky, 'uMid'),
    low: gl.getUniformLocation(sky, 'uLow'),
    sunPos: gl.getUniformLocation(sky, 'uSunPos'),
    sunColor: gl.getUniformLocation(sky, 'uSunColor'),
    moonPos: gl.getUniformLocation(sky, 'uMoonPos'),
    night: gl.getUniformLocation(sky, 'uNight'),
  };
  const posLoc = gl.getAttribLocation(main, 'aPos');
  const nrmLoc = gl.getAttribLocation(main, 'aNormal');
  const colLoc = gl.getAttribLocation(main, 'aColor');
  const swayLoc = gl.getAttribLocation(main, 'aSway'); // round 6
  const staticBuf = gl.createBuffer();
  const dynBuf = gl.createBuffer();
  const skyBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const skyPos = gl.getAttribLocation(sky, 'aPos');

  const renderer = { gl, canvas, staticCount: 0, staticReady: false };

  renderer.bakeCity = (city) => {
    const arr = [];
    SWAY_W = 0; // round 6: sway weights are set per-section below
    const hx = city.halfX, hz = city.halfZ;
    // Ground: grass base, then sand on the beach and water beyond the shore.
    pushFlatQuad(arr, -hx - 30, -hz - 30, hx + 44, hz + 34, 0, '#4d7a3a');
    pushFlatQuad(arr, -hx - 30, city.beach.z0, hx + 44, city.beach.z1, 0.05, '#eed9a0');
    pushFlatQuad(arr, hx + 2, -hz - 30, hx + 44, hz + 34, 0.02, '#1c6f9e');
    pushFlatQuad(arr, -hx - 30, city.beach.z1, hx + 44, hz + 34, 0.02, '#1c6f9e');
    // Roads: dark asphalt strips with lighter sidewalks on each side.
    for (const rx of city.roadXs) {
      pushFlatQuad(arr, rx - 6, -hz, rx + 6, hz, 0.08, '#26262e');
      pushFlatQuad(arr, rx - 8.4, -hz, rx - 6, hz, 0.1, '#9a938a');
      pushFlatQuad(arr, rx + 6, -hz, rx + 8.4, hz, 0.1, '#9a938a');
    }
    for (const rz of city.roadZs) {
      pushFlatQuad(arr, -hx, rz - 6, hx, rz + 6, 0.08, '#26262e');
      pushFlatQuad(arr, -hx, rz - 8.4, hx, rz - 6, 0.1, '#9a938a');
      pushFlatQuad(arr, -hx, rz + 6, hx, rz + 8.4, 0.1, '#9a938a');
    }
    // Round 7 (packet 10) — ROAD MARKINGS, done properly: a dashed
    // yellow centre line on BOTH road directions (round 6 only did
    // the vertical avenues), solid white edge lines, a stop line on
    // every approach, and a lane arrow at every third intersection.
    for (const rx of city.roadXs) {
      for (let z = -hz + 8; z < hz; z += 14) {
        pushFlatQuad(arr, rx - 0.35, z, rx + 0.35, z + 5, 0.12, '#e8d24a');
      }
      pushFlatQuad(arr, rx - 5.7, -hz, rx - 5.4, hz, 0.12, '#e8e8e8');
      pushFlatQuad(arr, rx + 5.4, -hz, rx + 5.7, hz, 0.12, '#e8e8e8');
    }
    for (const rz of city.roadZs) {
      for (let x = -hx + 8; x < hx; x += 14) {
        pushFlatQuad(arr, x, rz - 0.35, x + 5, rz + 0.35, 0.12, '#e8d24a');
      }
      pushFlatQuad(arr, -hx, rz - 5.7, hx, rz - 5.4, 0.12, '#e8e8e8');
      pushFlatQuad(arr, -hx, rz + 5.4, hx, rz + 5.7, 0.12, '#e8e8e8');
    }
    // Stop lines + lane arrows, one per approach at every
    // intersection; arrows point along the road, shaft + head.
    for (const cw of city.crosswalks) {
      pushFlatQuad(arr, cw.x - 5.5, cw.z + 6.2, cw.x + 5.5, cw.z + 6.8, 0.13, '#ffffff');
      pushFlatQuad(arr, cw.x - 5.5, cw.z - 6.8, cw.x + 5.5, cw.z - 6.2, 0.13, '#ffffff');
      pushFlatQuad(arr, cw.x + 6.2, cw.z - 5.5, cw.x + 6.8, cw.z + 5.5, 0.13, '#ffffff');
      pushFlatQuad(arr, cw.x - 6.8, cw.z - 5.5, cw.x - 6.2, cw.z + 5.5, 0.13, '#ffffff');
      const ix = Math.round(cw.x / CONFIG.pitch), iz = Math.round(cw.z / CONFIG.pitch);
      if ((ix + iz) % 3 === 0) {
        pushFlatQuad(arr, cw.x - 0.3, cw.z + 14, cw.x + 0.3, cw.z + 17, 0.13, '#e8e8e8');
        pushFlatQuad(arr, cw.x - 1.1, cw.z + 17, cw.x + 1.1, cw.z + 18.4, 0.13, '#e8e8e8');
        pushFlatQuad(arr, cw.x + 14, cw.z - 0.3, cw.x + 17, cw.z + 0.3, 0.13, '#e8e8e8');
        pushFlatQuad(arr, cw.x + 17, cw.z - 1.1, cw.x + 18.4, cw.z + 1.1, 0.13, '#e8e8e8');
      }
    }
    // Round 7 (packet 10) — ZEBRA CROSSINGS, THE CORRECT WAY: the
    // user's reference photo (Toyota "Arti Marka Zebra Cross") shows
    // MANY thin white lines, close together, spanning the whole road
    // width — not 4 fat bars, and NOT the diagonal ±41° stripes round
    // 6 drew. Each intersection gets two bands (one across each
    // road, just outside the intersection square — see zebraBands in
    // city.js): 16 thin stripes per band, 0.55 m wide, 0.7 m apart,
    // running WITH the traffic they cross.
    for (const b of zebraBands(city)) {
      if (b.x1 - b.x0 > b.z1 - b.z0) {
        // Stripes run along z (across the vertical road), spaced in x.
        for (let i = 0; i < 16; i++) {
          const sx0 = b.x0 + i * 0.7;
          pushFlatQuad(arr, sx0, b.z0, sx0 + 0.55, b.z1, 0.13, '#f5f5f5');
        }
      } else {
        // Stripes run along x (across the horizontal road), spaced in z.
        for (let i = 0; i < 16; i++) {
          const sz0 = b.z0 + i * 0.7;
          pushFlatQuad(arr, b.x0, sz0, b.x1, sz0 + 0.55, 0.13, '#f5f5f5');
        }
      }
    }
    // Round 7 (packet 11) — CURBS + CORNER RAMPS: a low raised curb
    // along the outer edge of every sidewalk (one long thin box per
    // side, so the sidewalk reads as raised from the road), and a
    // pale ramp quad on each intersection corner where the curb drops
    // to the crossing.
    for (const rx of city.roadXs) {
      pushBox(arr, rx - 8.15, 0.22, 0, 0.5, 0.24, hz * 2, '#b0a89e');
      pushBox(arr, rx + 8.15, 0.22, 0, 0.5, 0.24, hz * 2, '#b0a89e');
    }
    for (const rz of city.roadZs) {
      pushBox(arr, 0, 0.22, rz - 8.15, hx * 2, 0.24, 0.5, '#b0a89e');
      pushBox(arr, 0, 0.22, rz + 8.15, hx * 2, 0.24, 0.5, '#b0a89e');
    }
    for (const cw of city.crosswalks) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        pushFlatQuad(arr, cw.x + sx * 7.4 - 1, cw.z + sz * 7.4 - 1, cw.x + sx * 7.4 + 1, cw.z + sz * 7.4 + 1, 0.13, '#c9c2b8');
      }
    }
    // Round 7 (packet 13) — PARKS: a brighter lawn than the base
    // grass, a pale path cross through each park, and the flower beds
    // from city.flowers as small coloured patches. Taman Senja is the
    // big one; the hideout plaza is the second green.
    for (const park of city.parks ?? []) {
      pushFlatQuad(arr, park.x - park.w / 2, park.z - park.d / 2, park.x + park.w / 2, park.z + park.d / 2, 0.06, '#5a9e4a');
      pushFlatQuad(arr, park.x - 1.2, park.z - park.d / 2, park.x + 1.2, park.z + park.d / 2, 0.07, '#c9c2b8');
      pushFlatQuad(arr, park.x - park.w / 2, park.z - 1.2, park.x + park.w / 2, park.z + 1.2, 0.07, '#c9c2b8');
    }
    for (const fl of city.flowers ?? []) {
      pushFlatQuad(arr, fl.x - fl.w / 2, fl.z - fl.d / 2, fl.x + fl.w / 2, fl.z + fl.d / 2, 0.09, fl.color);
    }
    // Buildings: pastel body, darker roof slab, and — round 6 — a real
    // facade: individual windows on both long faces (about half lit
    // warm at dusk, the rest dark glass), a ground-floor door with a
    // frame, a canopy over some doors, and a balcony on some tall ones.
    // Everything still merges into the one static buffer, so the extra
    // detail costs no draw calls at all.
    for (const b of city.buildings) {
      pushBox(arr, b.x, b.h / 2, b.z, b.w, b.h, b.d, b.color);
      pushBox(arr, b.x, b.h + 0.3, b.z, b.w * 0.92, 0.6, b.d * 0.92, b.roof);
      const cols = b.winCols ?? 3;
      const floors = b.winFloors ?? Math.max(1, Math.floor(b.h / 5));
      const spacing = (b.w - 3) / cols;
      for (const face of [1, -1]) {
        const wz = b.z + face * (b.d / 2 + 0.06);
        const fName = face === 1 ? 'z+' : 'z-';
        for (let f = 0; f < floors; f++) {
          const wy = 2.6 + f * 4.2;
          if (wy + 0.85 > b.h) break;
          for (let c = 0; c < cols; c++) {
            const wx = b.x - b.w / 2 + 1.5 + (c + 0.5) * spacing;
            const lit = b.winLit ? !!b.winLit[f * cols + c] : (f + c) % 2 === 0;
            // Round 7 (packet 7): glass offices wear big blue glass
            // instead of the warm small windows of the other types.
            if (b.glass) pushWallQuad(arr, wx, wy, wz, 1.7, 2.4, lit ? '#cfeeff' : '#3a6a8a', fName);
            else pushWallQuad(arr, wx, wy, wz, 1.2, 1.7, lit ? '#ffd76a' : '#274b63', fName);
          }
        }
        // Door on one face, with a light frame around it.
        if ((b.doorFace ?? 1) === face) {
          const dx = b.x + (b.doorDx ?? 0);
          pushWallQuad(arr, dx, 1.55, wz, 2.3, 3.1, '#f5e6c8', fName);
          pushWallQuad(arr, dx, 1.4, wz + face * 0.02, 1.8, 2.8, '#3a2b3f', fName);
          if (b.canopy) {
            pushBox(arr, dx, 3.2, b.z + face * (b.d / 2 + 0.7), 3.0, 0.22, 1.5, b.roof);
          }
        }
      }
      // Balcony on the sunny face, second floor: slab + railing posts.
      if (b.balcony) {
        const by = 6.0;
        pushBox(arr, b.x, by, b.z + b.d / 2 + 0.7, 3.4, 0.22, 1.5, '#e8e8e8');
        pushBox(arr, b.x, by + 0.55, b.z + b.d / 2 + 1.35, 3.4, 0.9, 0.1, '#22303e');
      }
      // Round 6 (packet 13) — VEGAS NEON: hot-coloured strips, corner
      // tubes and a glowing sign panel, all merged into the static
      // buffer (a few boxes per building, zero extra draw calls).
      // The colours are "hot" (components > 1) so they survive the
      // lighting and read as glowing at dusk. No gambling content:
      // the signs are fictional music / food / cinema venues.
      if (b.neon) {
        const nc = hexRgb(b.neon.color);
        const hot = [Math.min(1.8, nc[0] * 1.7 + 0.15), Math.min(1.8, nc[1] * 1.7 + 0.15), Math.min(1.8, nc[2] * 1.7 + 0.15)];
        if (b.neon.style === 'top' || b.neon.style === 'sign') {
          pushBox(arr, b.x, b.h + 0.1, b.z + b.d / 2 + 0.05, b.w * 0.9, 0.28, 0.28, hot);
          pushBox(arr, b.x, b.h + 0.1, b.z - b.d / 2 - 0.05, b.w * 0.9, 0.28, 0.28, hot);
        }
        if (b.neon.style === 'corners' || b.neon.style === 'sign') {
          for (const sx of [-1, 1]) {
            pushBox(arr, b.x + sx * (b.w / 2 - 0.1), b.h / 2, b.z + b.d / 2 + 0.05, 0.28, b.h * 0.9, 0.28, hot);
          }
        }
        if (b.neon.style === 'sign') {
          const sy = Math.min(b.h - 2, Math.max(4.5, b.h * 0.55));
          pushBox(arr, b.x, sy, b.z + b.d / 2 + 0.1, 3.6, 1.7, 0.18, hot);
          pushBox(arr, b.x, sy - 0.2, b.z + b.d / 2 + 0.22, 2.2, 0.35, 0.1, [1.8, 1.8, 1.8]);
        }
      }
      // Round 7 (packet 8) — ROOF DETAILS: AC units, water tank,
      // antenna, chimney and parapet, from b.roofDetail. Positions
      // come from a hash of the building's coordinates, so the same
      // building always wears the same roof. Pitched roofs (rumah)
      // get two stepped slabs above the flat slab; the landmark
      // tower gets a helipad and a red beacon on top.
      const rd = b.roofDetail ?? {};
      const roofY = b.h + 0.6;
      const rHash = (n) => {
        const s = Math.sin(b.x * 12.9898 + b.z * 78.233 + n * 37.7) * 43758.5453;
        return s - Math.floor(s);
      };
      if (b.roofType === 'pitched') {
        pushBox(arr, b.x, b.h + 0.85, b.z, b.w * 0.66, 0.5, b.d * 0.66, b.roof);
        pushBox(arr, b.x, b.h + 1.3, b.z, b.w * 0.36, 0.5, b.d * 0.36, b.roof);
      }
      if (rd.parapet) {
        pushBox(arr, b.x, roofY + 0.25, b.z + b.d / 2 - 0.15, b.w * 0.92, 0.5, 0.3, b.roof);
        pushBox(arr, b.x, roofY + 0.25, b.z - b.d / 2 + 0.15, b.w * 0.92, 0.5, 0.3, b.roof);
        pushBox(arr, b.x + b.w / 2 - 0.15, roofY + 0.25, b.z, 0.3, 0.5, b.d * 0.92, b.roof);
        pushBox(arr, b.x - b.w / 2 + 0.15, roofY + 0.25, b.z, 0.3, 0.5, b.d * 0.92, b.roof);
      }
      for (let i = 0; i < (rd.ac ?? 0); i++) {
        const ax = b.x + (rHash(i) - 0.5) * (b.w - 3);
        const az = b.z + (rHash(i + 9) - 0.5) * (b.d - 3);
        pushBox(arr, ax, roofY + 0.45, az, 0.9, 0.9, 0.9, '#8a97a3');
      }
      if (rd.tank) {
        pushBox(arr, b.x + b.w * 0.25, roofY + 0.8, b.z - b.d * 0.2, 1.3, 1.6, 1.3, '#7a8a99');
        pushBox(arr, b.x + b.w * 0.25, roofY + 1.75, b.z - b.d * 0.2, 1.5, 0.3, 1.5, '#5a6a79');
      }
      if (rd.antenna) {
        const ah = 3 + rHash(5) * 2;
        pushBox(arr, b.x - b.w * 0.3, roofY + ah / 2, b.z + b.d * 0.25, 0.12, ah, 0.12, '#3a3a44');
        pushBox(arr, b.x - b.w * 0.3, roofY + ah + 0.2, b.z + b.d * 0.25, 0.3, 0.3, 0.3, [1.8, 0.3, 0.3]);
      }
      if (rd.chimney) {
        pushBox(arr, b.x + b.w * 0.32, roofY + 0.9, b.z - b.d * 0.3, 0.7, 1.8, 0.7, '#9a5a4a');
      }
      if (b.helipad) {
        pushBox(arr, b.x, roofY + 0.15, b.z, 12, 0.3, 12, '#3a3a44');
        pushBox(arr, b.x, roofY + 0.32, b.z, 1.2, 0.1, 6, '#ffd23d');
        pushBox(arr, b.x, roofY + 0.32, b.z, 6, 0.1, 1.2, '#ffd23d');
      }
      if (b.beacon) {
        pushBox(arr, b.x, roofY + 1.2, b.z, 0.8, 0.8, 0.8, [1.8, 0.25, 0.25]);
      }
    }
    // Round 6 — trees: a trunk and a lumpy rounded crown built from
    // three overlapping boxes in two greens, so the silhouette reads
    // like a real street tree instead of a Christmas cone.
    const TREE_GREENS = ['#3f9e4d', '#57b25e', '#2e7d46', '#6fbf5a'];
    const TREE_DARK = ['#2e7d46', '#3f9e4d', '#256b38', '#57b25e'];
    for (const t of city.trees ?? []) {
      const trunkH = t.h * 0.45;
      const green = TREE_GREENS[t.variant ?? 0];
      const dark = TREE_DARK[t.variant ?? 0];
      // Round 6 (packet 12): trunks barely move, crowns sway.
      SWAY_W = 0.1;
      pushBox(arr, t.x, trunkH / 2, t.z, 0.42, trunkH, 0.42, '#6a4a2b');
      SWAY_W = 0.55;
      const cy = trunkH + t.crownR * 0.7;
      pushBox(arr, t.x + t.lean, cy, t.z, t.crownR * 2, t.crownR * 1.4, t.crownR * 2, green);
      pushBox(arr, t.x - t.crownR * 0.5, cy + t.crownR * 0.5, t.z + t.crownR * 0.3, t.crownR * 1.2, t.crownR * 0.9, t.crownR * 1.2, dark);
      pushBox(arr, t.x + t.crownR * 0.5, cy + t.crownR * 0.4, t.z - t.crownR * 0.3, t.crownR * 1.0, t.crownR * 0.8, t.crownR * 1.0, green);
      SWAY_W = 0;
    }
    // Palms (round 6): a gently curved two-part trunk and a crown of
    // 5–7 fronds fanning out in every direction, plus coconuts.
    for (const p of city.palms) {
      const trunkLow = p.h * 0.55;
      // Round 6 (packet 12): trunks barely move, fronds sway most.
      SWAY_W = 0.1;
      pushBox(arr, p.x, trunkLow / 2, p.z, 0.34, trunkLow, 0.34, '#7a5230');
      pushBox(arr, p.x + p.lean * p.h, trunkLow + (p.h - trunkLow) / 2, p.z, 0.3, p.h - trunkLow, 0.3, '#8a6238');
      SWAY_W = 0;
      const topX = p.x + p.lean * p.h, topY = p.h + 0.4;
      pushBox(arr, topX, topY, p.z, 0.5, 0.4, 0.5, '#6a4a2b');
      SWAY_W = 0.9;
      const fronds = p.fronds ?? 6;
      for (let i = 0; i < fronds; i++) {
        const yaw = (i / fronds) * Math.PI * 2 + p.lean * 4;
        const fx = topX + Math.sin(yaw) * p.crownR * 0.55;
        const fz = p.z + Math.cos(yaw) * p.crownR * 0.55;
        pushBox(arr, fx, topY + 0.15, fz, p.crownR * 1.7, 0.12, 0.75, i % 2 ? '#3f9e4d' : '#57b25e', yaw);
      }
      SWAY_W = 0;
    }
    // Street lamps: pole + glowing head.
    // Round 6 (packet 13): the heads are bigger and "hot" (brighter
    // than white) so the avenues read as lit at dusk, Vegas style.
    for (const l of city.lamps) {
      pushBox(arr, l.x, 2.6, l.z, 0.18, 5.2, 0.18, '#2b2b33');
      pushBox(arr, l.x, 5.3, l.z, 1.1, 0.35, 0.6, [1.6, 1.4, 0.9]);
    }
    // Round 6 (packet 11) — billboards: two posts, a big bright
    // panel facing the road, and a contrasting band + bars on both
    // faces as the ad design. All merged into the static buffer, so
    // 8 boards cost a few dozen boxes, not a draw call each.
    for (const bb of city.billboards ?? []) {
      const nx = Math.sin(bb.yaw), nz = Math.cos(bb.yaw);
      const topY = 8.6;
      // Posts offset along the panel's width axis (cos yaw, -sin yaw).
      pushBox(arr, bb.x + Math.cos(bb.yaw) * 3, topY - 4.4, bb.z - Math.sin(bb.yaw) * 3, 0.4, 6.4, 0.4, '#2b2b33');
      pushBox(arr, bb.x - Math.cos(bb.yaw) * 3, topY - 4.4, bb.z + Math.sin(bb.yaw) * 3, 0.4, 6.4, 0.4, '#2b2b33');
      pushBox(arr, bb.x, topY, bb.z, bb.w, bb.h, 0.5, bb.color, bb.yaw);
      for (const side of [1, -1]) {
        const fx = bb.x + nx * 0.32 * side, fz = bb.z + nz * 0.32 * side;
        pushBox(arr, fx, topY + 0.6, fz, bb.w * 0.92, 1.1, 0.12, bb.accent, bb.yaw);
        pushBox(arr, fx - Math.cos(bb.yaw) * bb.w * 0.18, topY - 1.4, fz + Math.sin(bb.yaw) * bb.w * 0.18, bb.w * 0.3, 0.7, 0.12, '#ffffff', bb.yaw);
        pushBox(arr, fx + Math.cos(bb.yaw) * bb.w * 0.22, topY - 1.4, fz - Math.sin(bb.yaw) * bb.w * 0.22, bb.w * 0.22, 0.7, 0.12, '#ffffff', bb.yaw);
      }
    }
    // Traffic lights (round 5): pole + head with a green lamp, at every
    // other intersection — cheap street detail that reads while driving.
    for (const t of city.trafficLights ?? []) {
      pushBox(arr, t.x, 3, t.z, 0.22, 6, 0.22, '#2b2b33');
      pushBox(arr, t.x, 6.1, t.z, 0.6, 1.4, 0.4, '#181820');
      pushBox(arr, t.x, 6.45, t.z + 0.22, 0.3, 0.3, 0.06, '#37d67a');
    }
    // Round 7 (packet 12) — STREET PROPS, all merged into the static
    // buffer: red hydrants on sidewalk corners, traffic signs (pole +
    // panel), dark-green bins against walls, wooden benches in the
    // parks / on the beachfront / on wide sidewalks, and three
    // bus-stop shelters (posts + roof + bench + sign). Positions come
    // from city.props, which city.js planted with the road/building
    // guards — nothing here stands on asphalt or inside a wall.
    for (const pr of city.props ?? []) {
      if (pr.kind === 'hydrant') {
        pushBox(arr, pr.x, 0.45, pr.z, 0.5, 0.9, 0.5, '#d94f3d');
        pushBox(arr, pr.x, 0.95, pr.z, 0.6, 0.2, 0.6, '#b03a2d');
        pushBox(arr, pr.x, 0.45, pr.z + 0.28, 0.2, 0.2, 0.12, '#e8e8e8');
      } else if (pr.kind === 'sign') {
        pushBox(arr, pr.x, 1.3, pr.z, 0.12, 2.6, 0.12, '#5a5a66');
        pushBox(arr, pr.x, 2.8, pr.z, 0.9, 0.9, 0.08, '#e8e8e8', pr.yaw);
        pushBox(arr, pr.x, 2.8, pr.z, 0.5, 0.5, 0.1, '#d94f3d', pr.yaw);
      } else if (pr.kind === 'bin') {
        pushBox(arr, pr.x, 0.45, pr.z, 0.7, 0.9, 0.7, '#2e5a3a');
        pushBox(arr, pr.x, 0.95, pr.z, 0.76, 0.12, 0.76, '#24462d');
      } else if (pr.kind === 'bench') {
        pushBox(arr, pr.x, 0.5, pr.z, 1.9, 0.12, 0.6, '#8a6a42', pr.yaw);
        pushBox(arr, pr.x, 0.85, pr.z - 0.28, 1.9, 0.7, 0.1, '#8a6a42', pr.yaw);
        pushBox(arr, pr.x - 0.75, 0.25, pr.z, 0.12, 0.5, 0.5, '#2b2b33', pr.yaw);
        pushBox(arr, pr.x + 0.75, 0.25, pr.z, 0.12, 0.5, 0.5, '#2b2b33', pr.yaw);
      } else if (pr.kind === 'busstop') {
        pushBox(arr, pr.x - 1.6, 1.3, pr.z, 0.18, 2.6, 0.18, '#2b2b33');
        pushBox(arr, pr.x + 1.6, 1.3, pr.z, 0.18, 2.6, 0.18, '#2b2b33');
        pushBox(arr, pr.x, 2.7, pr.z, 3.8, 0.18, 1.8, '#3fa7d6', pr.yaw);
        pushBox(arr, pr.x, 0.5, pr.z + 0.5, 3.0, 0.12, 0.6, '#8a6a42', pr.yaw);
        pushBox(arr, pr.x, 3.1, pr.z - 0.8, 0.9, 0.9, 0.08, '#ffd23d', pr.yaw);
      }
    }
    // Hideout: a small pink house with a neon sign slab.
    pushBox(arr, city.hideout.x, 2, city.hideout.z - 6, 10, 4, 6, '#e58bb1');
    pushBox(arr, city.hideout.x, 4.6, city.hideout.z - 6, 8, 0.8, 0.4, '#ff2e88');
    // Harbour pier: wooden planks reaching into the water.
    for (let i = 0; i < 6; i++) {
      pushFlatQuad(arr, city.halfX + 2, -120 + i * 30, city.halfX + 30, -104 + i * 30, 0.4, '#8a6a42');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, staticBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    renderer.staticCount = arr.length / 10; // round 6: 10 floats/vertex
    renderer.staticReady = true;
    SWAY_W = 0; // never leak a sway weight into the next bake
  };

  function drawBuffer(buf, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(posLoc);
    gl.enableVertexAttribArray(nrmLoc);
    gl.enableVertexAttribArray(colLoc);
    gl.enableVertexAttribArray(swayLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 40, 0);
    gl.vertexAttribPointer(nrmLoc, 3, gl.FLOAT, false, 40, 12);
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 40, 24);
    gl.vertexAttribPointer(swayLoc, 1, gl.FLOAT, false, 40, 36);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  renderer.render = (world, camera) => {
    const w = canvas.clientWidth || 960, h = canvas.clientHeight || 600;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    // Round 7 (packets 4/15/16): the day phase drives every lighting
    // value this frame — sky gradient, sun/moon position and colour,
    // fog colour and band, ambient floor and the sun direction. The
    // title screen freezes the clock at sunset (17:40), so the menu
    // keeps its postcard sky; in play the sun climbs, sets and the
    // stars come out.
    const phase = dayPhaseAt(world.clockHours ?? CONFIG.dayStartHours);
    const elev = phase.sunElev;
    const sunUp = elev > -0.05;
    const sunT = Math.min(1, Math.max(0, elev)); // 0 = horizon, 1 = high noon
    const sunColor = sunUp
      ? [1.0, 0.75 + 0.23 * sunT, 0.45 + 0.45 * sunT]
      : [0, 0, 0];
    const sunPos = [0.3, Math.min(0.85, Math.max(0.04, 0.14 + elev * 0.42))];
    const nightF = phase.night ? 1 : (phase.name === 'dusk' || phase.name === 'dawn' ? 0.4 : 0);
    const fogNear = 55 + phase.ambient * 110;
    const fogFar = fogNear + 180 + phase.ambient * 120;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(phase.fog[0], phase.fog[1], phase.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Sky first, without depth.
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(sky);
    gl.uniform3f(skyLoc.top, phase.top[0], phase.top[1], phase.top[2]);
    gl.uniform3f(skyLoc.mid, phase.mid[0], phase.mid[1], phase.mid[2]);
    gl.uniform3f(skyLoc.low, phase.low[0], phase.low[1], phase.low[2]);
    gl.uniform2f(skyLoc.sunPos, sunPos[0], sunPos[1]);
    gl.uniform3f(skyLoc.sunColor, sunColor[0], sunColor[1], sunColor[2]);
    gl.uniform2f(skyLoc.moonPos, 0.72, 0.55);
    gl.uniform1f(skyLoc.night, nightF);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.enableVertexAttribArray(skyPos);
    gl.vertexAttribPointer(skyPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);

    const proj = perspective((camera.fov ?? (camera.aim ? 55 : 62)) * Math.PI / 180, canvas.width / canvas.height, 0.1, 600);
    const view = lookAt(camera.eye, camera.target, [0, 1, 0]);
    gl.useProgram(main);
    gl.uniformMatrix4fv(loc.proj, false, proj);
    gl.uniformMatrix4fv(loc.view, false, view);
    // Sun direction follows the elevation; after dark the moon (a
    // fixed high direction) lights the scene instead, dimly.
    if (sunUp) gl.uniform3f(loc.sun, Math.cos(elev) * 0.6, Math.max(0.08, Math.sin(elev)), 0.35);
    else gl.uniform3f(loc.sun, -0.4, 0.6, -0.3);
    gl.uniform3f(loc.fog, phase.fog[0], phase.fog[1], phase.fog[2]);
    gl.uniform1f(loc.ambient, phase.ambient);
    gl.uniform1f(loc.fogNear, fogNear);
    gl.uniform1f(loc.fogFar, fogFar);
    gl.uniform1f(loc.time, world.time); // round 6: sway clock (packet 12)
    if (renderer.staticReady) drawBuffer(staticBuf, renderer.staticCount);

    const dyn = [];
    drawWorldDynamic(world, dyn);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dyn), gl.DYNAMIC_DRAW);
    drawBuffer(dynBuf, dyn.length / 10); // round 6: 10 floats/vertex
  };
  return renderer;
}

// ------------------------------------------------------------------ dynamic
function drawCar(arr, c, lightsOn = false) {
  const body = c.color;
  const dark = '#181820';
  pushBox(arr, c.x, 0.75, c.z, c.w, 0.75, c.l, body, c.angle);
  const cabinZ = c.model === 'truck' ? -c.l * 0.28 : 0.2;
  const cabinL = c.model === 'van' ? c.l * 0.72 : c.model === 'truck' ? c.l * 0.22 : c.l * 0.42;
  const cabinH = c.model === 'truck' ? 1.1 : 0.75;
  // Cabin offset along the car's forward axis.
  const fx = Math.sin(c.angle), fz = Math.cos(c.angle);
  const ccx = c.x - fx * cabinZ, ccz = c.z - fz * cabinZ;
  pushBox(arr, ccx, 1.35 + cabinH / 2 - 0.35, ccz, c.w * 0.86, cabinH, cabinL, c.model === 'van' ? body : '#2e4a66', c.angle);
  // Wheels.
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wx = c.x + fx * sz * c.l * 0.32 + Math.cos(c.angle) * sx * (c.w / 2 + 0.05);
    const wz = c.z + fz * sz * c.l * 0.32 - Math.sin(c.angle) * sx * (c.w / 2 + 0.05);
    pushBox(arr, wx, 0.35, wz, 0.28, 0.7, 0.9, dark, c.angle);
  }
  // Headlights and tail lights.
  const hx = c.x + fx * (c.l / 2 + 0.02), hz = c.z + fz * (c.l / 2 + 0.02);
  // Round 7 (packet 6): headlights. On they burn "hot" (brighter
  // than white, so they survive the night lighting) and throw two
  // light pools on the road ahead; off they are the plain pale lamps
  // of round 5.
  const headCol = lightsOn ? [1.8, 1.7, 1.0] : '#fff6c8';
  pushBox(arr, hx - Math.cos(c.angle) * 0.6, 0.7, hz + Math.sin(c.angle) * 0.6, 0.5, 0.22, 0.1, headCol, c.angle);
  pushBox(arr, hx + Math.cos(c.angle) * 0.6, 0.7, hz - Math.sin(c.angle) * 0.6, 0.5, 0.22, 0.1, headCol, c.angle);
  if (lightsOn) {
    for (const side of [-1, 1]) {
      const bx = hx + fx * 5 - Math.cos(c.angle) * side * 0.6;
      const bz = hz + fz * 5 + Math.sin(c.angle) * side * 0.6;
      pushFlatQuadRot(arr, bx, bz, 1.7, 10, 0.15, [1.8, 1.7, 1.0], c.angle);
    }
  }
  const tx = c.x - fx * (c.l / 2 + 0.02), tz = c.z - fz * (c.l / 2 + 0.02);
  pushBox(arr, tx, 0.7, tz, c.w * 0.7, 0.22, 0.1, '#ff2e2e', c.angle);
  if (c.model === 'taxi') {
    pushBox(arr, c.x, 2.15, c.z, 0.9, 0.35, 0.5, '#ffd23d', c.angle);
  }
  if (c.model === 'sport') {
    const sx = c.x - fx * (c.l / 2 - 0.1), sz = c.z - fz * (c.l / 2 - 0.1);
    pushBox(arr, sx, 1.25, sz, c.w * 0.95, 0.12, 0.4, dark, c.angle);
  }
  if (c.owner === 'police') {
    pushBox(arr, c.x, 2.05, c.z, 1.1, 0.3, 0.5, '#ff2e2e', c.angle);
    pushBox(arr, c.x, 1.05, c.z, c.w * 0.9, 0.3, c.l * 0.6, '#e8e8e8', c.angle);
    // Round 7 (packet 17): the officer is visible in the patrol car
    // — head + peaked cap rising above the cabin roof on the driver's
    // side, so a chase reads as a chase, not an empty car.
    const rx2 = Math.cos(c.angle), rz2 = -Math.sin(c.angle);
    const ox = ccx - rx2 * 0.42 + fx * 0.25;
    const oz = ccz - rz2 * 0.42 + fz * 0.25;
    pushBox(arr, ox, 1.95, oz, 0.36, 0.36, 0.36, '#c98d5f', c.angle);
    pushBox(arr, ox, 2.14, oz, 0.42, 0.12, 0.42, '#22303e', c.angle);
    pushBox(arr, ox + fx * 0.2, 2.12, oz + fz * 0.2, 0.44, 0.06, 0.16, '#22303e', c.angle);
  }
  if (c.smoking) {
    pushBox(arr, c.x, 2.2, c.z, 0.7, 0.7, 0.7, '#555', c.angle);
  }
}

function drawPerson(arr, x, z, y, angle, shirt, skin, walkPhase, running, opts = {}) {
  const swing = Math.sin(walkPhase) * (running ? 0.55 : 0.35);
  const fx = Math.sin(angle), fz = Math.cos(angle);
  const rx = Math.cos(angle), rz = -Math.sin(angle);
  // Round 7 (packet 17): NPC VARIETY — trousers, hair, accessories
  // and height, from the pedestrian's own fields (world.js). Cops
  // pass a cap, enemies pass nothing (the defaults keep their old
  // look), so no existing character changes silhouette.
  const hs = opts.heightScale ?? 1;
  const pants = opts.pants ?? '#2b2b33';
  // Legs swing with the walk cycle.
  pushBox(arr, x + fx * swing * 0.4, 0.45 * hs + y, z + fz * swing * 0.4, 0.22, 0.9 * hs, 0.22, pants, angle);
  pushBox(arr, x - fx * swing * 0.4, 0.45 * hs + y, z - fz * swing * 0.4, 0.22, 0.9 * hs, 0.22, pants, angle);
  // Torso and head.
  pushBox(arr, x, 1.25 * hs + y, z, 0.62, 0.75 * hs, 0.36, shirt, angle);
  pushBox(arr, x, 1.85 * hs + y, z, 0.42, 0.42 * hs, 0.42, skin, angle);
  // Arms.
  pushBox(arr, x + rx * 0.4 - fx * swing * 0.3, 1.25 * hs + y, z + rz * 0.4 - fz * swing * 0.3, 0.18, 0.6 * hs, 0.18, shirt, angle);
  pushBox(arr, x - rx * 0.4 + fx * swing * 0.3, 1.25 * hs + y, z - rz * 0.4 + fz * swing * 0.3, 0.18, 0.6 * hs, 0.18, shirt, angle);
  // Hair: short (top slab), long (top + back), cap (top + brim),
  // hat (wide top + brim), bald (nothing — the head stays bare).
  const hair = opts.hairColor ?? '#1c1410';
  const hy = 2.06 * hs + y;
  if (opts.hairStyle === 'long') {
    pushBox(arr, x, hy, z, 0.44, 0.14, 0.42, hair, angle);
    pushBox(arr, x - fx * 0.16, 1.9 * hs + y, z - fz * 0.16, 0.44, 0.34, 0.1, hair, angle);
  } else if (opts.hairStyle === 'cap' || opts.hairStyle === 'hat') {
    const wide = opts.hairStyle === 'hat' ? 0.54 : 0.44;
    const mat = opts.hairStyle === 'hat' ? '#8a6a42' : hair;
    pushBox(arr, x, hy, z, wide, 0.14, 0.44, mat, angle);
    pushBox(arr, x + fx * 0.24, hy - 0.04, z + fz * 0.24, wide, 0.05, 0.2, mat, angle);
  } else if (opts.hairStyle !== 'bald') {
    pushBox(arr, x, hy, z, 0.44, 0.14, 0.42, hair, angle);
  }
  // Accessories: dark glasses across the face, or a bag on the back.
  if (opts.accessory === 'glasses') {
    pushBox(arr, x + fx * 0.2, 1.88 * hs + y, z + fz * 0.2, 0.34, 0.08, 0.05, '#181820', angle);
  } else if (opts.accessory === 'bag') {
    pushBox(arr, x - fx * 0.22, 1.3 * hs + y, z - fz * 0.22, 0.4, 0.5, 0.14, '#7a3b1e', angle);
  }
}

// Round 6 — RICO VEGA, rebuilt to read like a person instead of a
// robot: slimmer limbs with real joints (thigh + shin with a knee bend,
// upper arm + forearm with an elbow bend), a Hawaiian shirt with a
// flower print, khaki shorts, shoes, hair and a face with eyes —
// and motion to match: arms swing against the legs, knees and elbows
// bend through the stride, the chest rises and falls with his breath
// when he stands still, and the torso leans into a run. When he fires,
// the shooting arm snaps straight out (recoil) instead of hanging.
function drawRico(arr, world, p) {
  const x = p.x, z = p.z, y = p.y || 0, angle = p.angle;
  const fx = Math.sin(angle), fz = Math.cos(angle);
  const rx = Math.cos(angle), rz = -Math.sin(angle);
  const running = p.speed > 7;
  const moving = p.speed > 0.3;
  const swing = moving ? Math.sin(p.walkPhase) * (running ? 0.5 : 0.32) : 0;
  const breathe = moving ? 0 : Math.sin(world.time * 2) * 0.025;
  const lean = running ? 0.09 : 0;
  const skin = '#f2c89b';
  const shirt = '#e84a5f';
  const shorts = '#c9b078';
  // Legs: shorts thigh + skin shin, the shin trailing the thigh so
  // the knee reads as a bend; shoes point forward at the end.
  for (const side of [1, -1]) {
    const s = swing * side;
    const hipX = x + rx * 0.14 * side, hipZ = z + rz * 0.14 * side;
    pushBox(arr, hipX + fx * s * 0.3, 0.72 + y, hipZ + fz * s * 0.3, 0.17, 0.45, 0.17, shorts, angle);
    pushBox(arr, hipX + fx * s * 0.5 - fx * 0.06, 0.28 + y, hipZ + fz * s * 0.5 - fz * 0.06, 0.14, 0.42, 0.14, skin, angle);
    pushBox(arr, hipX + fx * (s * 0.55 + 0.08), 0.07 + y, hipZ + fz * (s * 0.55 + 0.08), 0.17, 0.13, 0.36, '#22222c', angle);
  }
  // Torso: Hawaiian shirt, leaning into a run, rising with each breath.
  const torsoY = 1.28 + y + breathe;
  pushBox(arr, x + fx * lean, torsoY, z + fz * lean, 0.56, 0.72, 0.33, shirt, angle);
  // Flower print: three little blooms on the front of the shirt.
  const printCols = ['#ffd23d', '#ffffff', '#7dd93d'];
  for (let i = 0; i < 3; i++) {
    const px = x + fx * lean + rx * (i - 1) * 0.15 + fx * 0.18;
    const pz = z + fz * lean + rz * (i - 1) * 0.15 + fz * 0.18;
    pushBox(arr, px, torsoY + (i % 2 ? 0.14 : -0.12), pz, 0.11, 0.11, 0.05, printCols[i], angle);
  }
  // Arms: shirt sleeve + skin forearm; the forearm bends forward at
  // the elbow. The right arm is the gun arm — while the recoil is up
  // it points straight ahead, holding the gun out.
  const shooting = p.recoil > 0.25 && p.weapon !== 'fists';
  for (const side of [1, -1]) {
    const armSwing = -swing * 0.8;
    if (shooting && side === 1) {
      pushBox(arr, x + rx * 0.3 + fx * 0.22, 1.38 + y, z + rz * 0.3 + fz * 0.22, 0.15, 0.15, 0.5, shirt, angle);
      pushBox(arr, x + rx * 0.3 + fx * 0.48, 1.38 + y, z + rz * 0.3 + fz * 0.48, 0.13, 0.13, 0.34, skin, angle);
      continue;
    }
    const s = armSwing * side;
    const shX = x + rx * 0.34 * side, shZ = z + rz * 0.34 * side;
    pushBox(arr, shX + fx * s * 0.25, 1.42 + y + breathe, shZ + fz * s * 0.25, 0.15, 0.42, 0.15, shirt, angle);
    pushBox(arr, shX + fx * (s * 0.3 + 0.08), 1.06 + y + breathe, shZ + fz * (s * 0.3 + 0.08), 0.13, 0.38, 0.13, skin, angle);
  }
  // Head: skin, dark hair on top and at the back, two eyes on the face.
  pushBox(arr, x + fx * lean, 1.86 + y + breathe, z + fz * lean, 0.4, 0.4, 0.38, skin, angle);
  pushBox(arr, x + fx * lean, 2.06 + y + breathe, z + fz * lean, 0.42, 0.14, 0.4, '#1c1410', angle);
  pushBox(arr, x + fx * lean - fx * 0.16, 1.92 + y + breathe, z + fz * lean - fz * 0.16, 0.42, 0.3, 0.1, '#1c1410', angle);
  for (const side of [1, -1]) {
    pushBox(arr, x + rx * 0.09 * side + fx * 0.2, 1.9 + y + breathe, z + rz * 0.09 * side + fz * 0.2, 0.06, 0.06, 0.04, '#181820', angle);
  }
  // A gun in hand when armed.
  if (p.weapon !== 'fists') {
    const gy = shooting ? 1.38 : 1.3;
    const gd = shooting ? 0.62 : 0.5;
    pushBox(arr, x + rx * 0.3 + fx * gd, gy + y, z + rz * 0.3 + fz * gd, 0.11, 0.11, 0.5, '#181820', angle);
  }
}

function drawWorldDynamic(world, arr) {
  const city = world.city;
  const p = world.player;
  // Mission target beacon: a tall golden pillar, visible across the city.
  const target = missionTargetOf(world);
  if (target) {
    pushBox(arr, target.x, 14, target.z, 1.2, 28, 1.2, '#ffd23d');
    pushBox(arr, target.x, 0.4, target.z, target.r * 1.4, 0.5, target.r * 1.4, '#ffd23d');
  }
  // Pickups and collectibles.
  for (const h of city.healthPickups) {
    if (h.taken) continue;
    pushBox(arr, h.x, 0.8, h.z, 1.4, 1.4, 0.4, '#ffffff');
    pushBox(arr, h.x, 0.8, h.z, 0.45, 1.4, 0.45, '#e84a5f');
    pushBox(arr, h.x, 0.8, h.z, 1.4, 0.45, 0.45, '#e84a5f');
  }
  for (const a of city.armourPickups) {
    if (a.taken) continue;
    pushBox(arr, a.x, 0.8, a.z, 1.3, 1.3, 1.3, '#3fa7d6');
  }
  for (const col of city.collectibles) {
    if (col.taken) continue;
    pushBox(arr, col.x, 1.1 + Math.sin(world.time * 2 + col.id) * 0.25, col.z, 0.7, 0.7, 0.7, '#ffd23d');
  }
  for (const j of city.stuntJumps) {
    pushBox(arr, j.x, 0.5, j.z, 4, 1, 2, '#ff7b2d', j.angle);
  }
  // Cars: the player's car burns its headlights when world says so
  // (auto at night, or forced on); traffic and patrol cars light up
  // at night too. Every car also gets a cheap blob shadow — one dark
  // flat quad that follows its heading (packet 14: no shadow maps,
  // the phone budget stays flat).
  const night = world.dayPhase?.night ?? false;
  const playerCarId = world.player.inCar;
  for (const c of world.cars) {
    if (c.health <= 0) continue;
    const lights = (c.id === playerCarId && world.carLightsOn)
      || (night && (c.traffic || c.owner === 'police'));
    drawCar(arr, c, lights);
    pushFlatQuadRot(arr, c.x, c.z, c.w + 0.7, c.l + 0.7, 0.16, '#101018', c.angle);
  }
  // Round 6 — enterable-car marker (GTA 2 style): a pulsing red beam
  // and a spinning red diamond above the nearest car Rico can enter,
  // plus a red ring on the ground around it. world.nearCar is null
  // while Rico drives or when no car is within 5 m, so the marker
  // appears and disappears exactly when it should.
  if (world.nearCar) {
    const nc = world.nearCar;
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 6);
    pushBox(arr, nc.x, 0.15, nc.z, 3.4, 0.14, 3.4, '#ff2e2e');
    pushBox(arr, nc.x, 4.2, nc.z, 0.35 + 0.3 * pulse, 8.4, 0.35 + 0.3 * pulse, '#ff2e2e');
    const dy = nc.h + 1.7 + Math.sin(world.time * 3) * 0.15;
    pushBox(arr, nc.x, dy, nc.z, 0.9, 0.9, 0.9, '#ff2e2e', world.time * 1.5);
  }
  // Pedestrians — each with their own look (packet 17) and their
  // own blob shadow (packet 14).
  for (const pd of world.peds) {
    drawPerson(arr, pd.x, pd.z, 0, pd.angle, pd.shirt, pd.skin, pd.walkPhase, pd.state === 'flee',
      { hairStyle: pd.hairStyle, hairColor: pd.hairColor, pants: pd.pants, accessory: pd.accessory, heightScale: pd.heightScale });
    pushFlatQuadRot(arr, pd.x, pd.z, 1.1, 1.1, 0.16, '#101018', pd.angle);
  }
  // Police on foot: dark blue uniforms, peaked caps (packet 17).
  for (const cop of world.police) {
    if (cop.dead) continue;
    drawPerson(arr, cop.x, cop.z, 0, cop.angle, '#22303e', '#c98d5f', world.time * 10, true,
      { hairStyle: 'cap', hairColor: '#22303e', pants: '#22303e' });
    pushBox(arr, cop.x, 2.1, cop.z, 0.44, 0.16, 0.44, '#22303e', cop.angle);
    pushFlatQuadRot(arr, cop.x, cop.z, 1.1, 1.1, 0.16, '#101018', cop.angle);
  }
  // Enemies: red shirts.
  for (const e of world.enemies) {
    if (e.dead) continue;
    drawPerson(arr, e.x, e.z, 0, e.angle, '#c22a2a', '#c98d5f', world.time * 9, true);
    pushFlatQuadRot(arr, e.x, e.z, 1.1, 1.1, 0.16, '#101018', e.angle);
  }
  // The player, unless driving (then the car is the body).
  // Round 6: Rico gets his own model (drawRico) — the generic
  // box-person is kept for pedestrians, cops and enemies only.
  if (p.inCar === null) {
    drawRico(arr, world, p);
    // Round 7 (packet 14): Rico's own blob shadow, on the ground
    // under him — it grounds him in the scene at every hour.
    pushFlatQuadRot(arr, p.x, p.z, 1.3, 1.3, 0.16, '#101018', p.angle);
  }
  // Round 6 — muzzle flash: a bright star at the gun tip while the
  // flash lives (0.09 s), plus the bullet tracers: thin glowing
  // streaks from muzzle to impact, fading with their remaining life.
  if (world.muzzle) {
    const m = world.muzzle;
    const s = 0.25 + 0.75 * (m.life / 0.09);
    pushBox(arr, m.x, m.y, m.z, 0.7 * s, 0.7 * s, 0.7 * s, '#ffe9a8');
    pushBox(arr, m.x, m.y, m.z, 0.4 * s, 0.4 * s, 0.4 * s, '#ff7b2d', 0.8);
  }
  for (const tr of world.tracers ?? []) {
    const mx = (tr.x0 + tr.x1) / 2, my = (tr.y0 + tr.y1) / 2, mz = (tr.z0 + tr.z1) / 2;
    const len = Math.hypot(tr.x1 - tr.x0, tr.y1 - tr.y0, tr.z1 - tr.z0) || 0.1;
    const yaw = Math.atan2(tr.x1 - tr.x0, tr.z1 - tr.z0);
    const thick = 0.07 + 0.08 * (tr.life / tr.maxLife);
    pushBox(arr, mx, my, mz, thick, thick, len, '#ffe9a8', yaw);
  }
  // Particles.
  for (const pt of world.particles) {
    pushBox(arr, pt.x, Math.max(0.2, pt.y), pt.z, pt.size, pt.size, pt.size, pt.color);
  }
}

// The renderer needs the mission target without importing world.js
// (which would make a cycle); the same switch lives there.
function missionTargetOf(world) {
  const m = world.mission;
  if (!m.active) return null;
  const c = world.city;
  switch (m.index) {
    case 0: return m.stage === 1 ? { x: c.hideout.x, z: c.hideout.z, r: 8 } : null;
    case 1: return m.stage === 0 ? { x: c.warehouse.x, z: c.warehouse.z, r: 7 } : { x: c.downtownDrop.x, z: c.downtownDrop.z, r: 8 };
    case 2: {
      const fares = [{ x: -140, z: 130 }, { x: -60, z: 150 }, { x: 20, z: 120 }];
      return m.stage === 0 ? { x: fares[m.sub].x, z: fares[m.sub].z, r: 6 } : { x: c.downtownDrop.x, z: c.downtownDrop.z, r: 8 };
    }
    case 3: return { x: c.warehouse.x, z: c.warehouse.z, r: 9 };
    case 4: return world.targetCar ? { x: world.targetCar.x, z: world.targetCar.z, r: 5 } : null;
    case 5: { const cp = c.raceCheckpoints[Math.min(m.checkpoints, 2)]; return { x: cp.x, z: cp.z, r: 10 }; }
    case 6: { const s = c.collectorSpots[m.collected] ?? c.collectorSpots[0]; return { x: s.x, z: s.z, r: 6 }; }
    case 7: return { x: c.hideout.x, z: c.hideout.z, r: 12 };
    default: return null;
  }
}

export { CONFIG };

// Round 7 complete (2026-11-19): day/night sky + fog + ambient per
// phase, stars + moon, road markings + 16-stripe zebras, curbs +
// corner ramps, parks + flowers, street props, glass offices,
// pitched roofs, roof details, landmark helipad + beacon, headlight
// beams, blob shadows, NPC variety, officer in patrol cars.
