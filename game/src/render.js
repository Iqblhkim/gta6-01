// Kota Seja — a raw WebGL renderer written from scratch.
// No library, no downloaded code: one shader pair, vertex-coloured
// low-poly boxes, a gradient sunset sky, simple sun lighting and fog.
// The city geometry is baked once into a static buffer; cars, people
// and effects are rebuilt into a dynamic buffer every frame.
import { CONFIG } from './config.js';

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
  return [Math.min(1, rgb[0] * f), Math.min(1, rgb[1] * f), Math.min(1, rgb[2] * f)];
}

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
    }
  }
}

// ------------------------------------------------------------------ shaders
const MAIN_VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uProj; uniform mat4 uView;
varying vec3 vColor; varying vec3 vNormal; varying float vDepth;
void main() {
  vec4 view = uView * vec4(aPos, 1.0);
  vDepth = -view.z;
  vColor = aColor; vNormal = aNormal;
  gl_Position = uProj * view;
}`;
const MAIN_FRAG = `
precision mediump float;
varying vec3 vColor; varying vec3 vNormal; varying float vDepth;
uniform vec3 uSunDir; uniform vec3 uFogColor;
void main() {
  float diff = max(dot(normalize(vNormal), normalize(uSunDir)), 0.0);
  float light = 0.45 + 0.55 * diff;
  vec3 col = vColor * light;
  float fog = smoothstep(90.0, 320.0, vDepth);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
}`;
const SKY_VERT = `
attribute vec2 aPos; varying vec2 vUv;
void main() { vUv = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const SKY_FRAG = `
precision mediump float; varying vec2 vUv;
void main() {
  float h = vUv.y * 0.5 + 0.5;
  vec3 top = vec3(0.32, 0.15, 0.48);
  vec3 mid = vec3(0.98, 0.45, 0.32);
  vec3 low = vec3(1.0, 0.72, 0.42);
  vec3 col = h > 0.62 ? mix(mid, top, smoothstep(0.62, 1.0, h))
                       : mix(low, mid, smoothstep(0.0, 0.62, h));
  vec2 sunDir = vec2(0.25, 0.42);
  float d = distance(vUv, sunDir);
  col += vec3(1.0, 0.85, 0.55) * smoothstep(0.28, 0.0, d) * 0.9;
  col += vec3(1.0, 0.95, 0.8) * smoothstep(0.06, 0.0, d);
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
  };
  const posLoc = gl.getAttribLocation(main, 'aPos');
  const nrmLoc = gl.getAttribLocation(main, 'aNormal');
  const colLoc = gl.getAttribLocation(main, 'aColor');
  const staticBuf = gl.createBuffer();
  const dynBuf = gl.createBuffer();
  const skyBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const skyPos = gl.getAttribLocation(sky, 'aPos');

  const renderer = { gl, canvas, staticCount: 0, staticReady: false };

  renderer.bakeCity = (city) => {
    const arr = [];
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
    // Centre dashes and crosswalk stripes.
    for (const rx of city.roadXs) {
      for (let z = -hz + 8; z < hz; z += 14) {
        pushFlatQuad(arr, rx - 0.35, z, rx + 0.35, z + 5, 0.12, '#e8d24a');
      }
    }
    for (const cw of city.crosswalks) {
      for (let i = -2; i <= 2; i++) {
        pushFlatQuad(arr, cw.x - 5 + i * 2.1, cw.z - 5.4, cw.x - 3.9 + i * 2.1, cw.z + 5.4, 0.12, '#e8e8e8');
      }
    }
    // Buildings: pastel body, darker roof slab, window strips.
    for (const b of city.buildings) {
      pushBox(arr, b.x, b.h / 2, b.z, b.w, b.h, b.d, b.color);
      pushBox(arr, b.x, b.h + 0.3, b.z, b.w * 0.92, 0.6, b.d * 0.92, b.roof);
      const floors = Math.max(1, Math.floor(b.h / 5));
      for (let f = 0; f < floors; f++) {
        const wy = 2.5 + f * 5;
        if (wy > b.h - 1) break;
        pushFlatQuad(arr, b.x - b.w / 2 - 0.06, b.z - b.d / 2 + 0.8, b.x + b.w / 2 + 0.06, b.z - b.d / 2 + 0.8, wy, '#ffd76a');
      }
    }
    // Palms: trunk + a crossed pair of frond slabs.
    for (const p of city.palms) {
      pushBox(arr, p.x, p.h / 2, p.z, 0.35, p.h, 0.35, '#7a5230');
      pushBox(arr, p.x + p.lean, p.h + 0.4, p.z, 3.4, 0.25, 1.1, '#3f9e4d');
      pushBox(arr, p.x + p.lean, p.h + 0.4, p.z, 1.1, 0.25, 3.4, '#57b25e');
    }
    // Street lamps: pole + glowing head.
    for (const l of city.lamps) {
      pushBox(arr, l.x, 2.6, l.z, 0.18, 5.2, 0.18, '#2b2b33');
      pushBox(arr, l.x, 5.3, l.z, 0.9, 0.3, 0.5, '#ffe9a8');
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
    renderer.staticCount = arr.length / 9;
    renderer.staticReady = true;
  };

  function drawBuffer(buf, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(posLoc);
    gl.enableVertexAttribArray(nrmLoc);
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(nrmLoc, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 36, 24);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  renderer.render = (world, camera) => {
    const w = canvas.clientWidth || 960, h = canvas.clientHeight || 600;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.98, 0.45, 0.32, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Sky first, without depth.
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(sky);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.enableVertexAttribArray(skyPos);
    gl.vertexAttribPointer(skyPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);

    const proj = perspective((camera.aim ? 55 : 62) * Math.PI / 180, canvas.width / canvas.height, 0.1, 600);
    const view = lookAt(camera.eye, camera.target, [0, 1, 0]);
    gl.useProgram(main);
    gl.uniformMatrix4fv(loc.proj, false, proj);
    gl.uniformMatrix4fv(loc.view, false, view);
    gl.uniform3f(loc.sun, 0.5, 0.75, 0.35);
    gl.uniform3f(loc.fog, 0.94, 0.55, 0.42);
    if (renderer.staticReady) drawBuffer(staticBuf, renderer.staticCount);

    const dyn = [];
    drawWorldDynamic(world, dyn);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dyn), gl.DYNAMIC_DRAW);
    drawBuffer(dynBuf, dyn.length / 9);
  };
  return renderer;
}

// ------------------------------------------------------------------ dynamic
function drawCar(arr, c) {
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
  pushBox(arr, hx - Math.cos(c.angle) * 0.6, 0.7, hz + Math.sin(c.angle) * 0.6, 0.5, 0.22, 0.1, '#fff6c8', c.angle);
  pushBox(arr, hx + Math.cos(c.angle) * 0.6, 0.7, hz - Math.sin(c.angle) * 0.6, 0.5, 0.22, 0.1, '#fff6c8', c.angle);
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
  }
  if (c.smoking) {
    pushBox(arr, c.x, 2.2, c.z, 0.7, 0.7, 0.7, '#555', c.angle);
  }
}

function drawPerson(arr, x, z, y, angle, shirt, skin, walkPhase, running) {
  const swing = Math.sin(walkPhase) * (running ? 0.55 : 0.35);
  const fx = Math.sin(angle), fz = Math.cos(angle);
  const rx = Math.cos(angle), rz = -Math.sin(angle);
  // Legs swing with the walk cycle.
  pushBox(arr, x + fx * swing * 0.4, 0.45 + y, z + fz * swing * 0.4, 0.22, 0.9, 0.22, '#2b2b33', angle);
  pushBox(arr, x - fx * swing * 0.4, 0.45 + y, z - fz * swing * 0.4, 0.22, 0.9, 0.22, '#2b2b33', angle);
  // Torso and head.
  pushBox(arr, x, 1.25 + y, z, 0.62, 0.75, 0.36, shirt, angle);
  pushBox(arr, x, 1.85 + y, z, 0.42, 0.42, 0.42, skin, angle);
  // Arms.
  pushBox(arr, x + rx * 0.4 - fx * swing * 0.3, 1.25 + y, z + rz * 0.4 - fz * swing * 0.3, 0.18, 0.6, 0.18, shirt, angle);
  pushBox(arr, x - rx * 0.4 + fx * swing * 0.3, 1.25 + y, z - rz * 0.4 + fz * swing * 0.3, 0.18, 0.6, 0.18, shirt, angle);
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
  // Cars.
  for (const c of world.cars) {
    if (c.health <= 0) continue;
    drawCar(arr, c);
  }
  // Pedestrians.
  for (const pd of world.peds) {
    drawPerson(arr, pd.x, pd.z, 0, pd.angle, pd.shirt, pd.skin, pd.walkPhase, pd.state === 'flee');
  }
  // Police on foot: dark blue uniforms.
  for (const cop of world.police) {
    if (cop.dead) continue;
    drawPerson(arr, cop.x, cop.z, 0, cop.angle, '#22303e', '#c98d5f', world.time * 10, true);
    pushBox(arr, cop.x, 2.1, cop.z, 0.44, 0.16, 0.44, '#22303e', cop.angle);
  }
  // Enemies: red shirts.
  for (const e of world.enemies) {
    if (e.dead) continue;
    drawPerson(arr, e.x, e.z, 0, e.angle, '#c22a2a', '#c98d5f', world.time * 9, true);
  }
  // The player, unless driving (then the car is the body).
  if (p.inCar === null) {
    drawPerson(arr, p.x, p.z, p.y, p.angle, '#e84a5f', '#f2c89b', world.time * 9, p.speed > 7);
    // A gun in hand when armed.
    if (p.weapon !== 'fists') {
      const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
      pushBox(arr, p.x + fx * 0.5, 1.3 + p.y, p.z + fz * 0.5, 0.12, 0.12, 0.55, '#181820', p.angle);
    }
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
