// Kota Seja — hand-written software 3D renderer on a 2D canvas.
// Perspective projection, painter's algorithm (far to near), flat shading
// from a low dusk sun. No WebGL, no libraries, no network. Pure canvas 2D.
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}
export function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

// Sun sits low in the west at golden hour: warm light from (-x, +y, -z).
export const SUN = { x: -0.55, y: 0.62, z: -0.35 };
const SUN_LEN = Math.hypot(SUN.x, SUN.y, SUN.z);
export const SUN_N = { x: SUN.x / SUN_LEN, y: SUN.y / SUN_LEN, z: SUN.z / SUN_LEN };

export class Renderer3D {
  constructor(ctx, width, height) {
    this.ctx = ctx; this.w = width; this.h = height;
    this.cx = width / 2; this.cy = height / 2;
    this.focal = height * 0.92;
    this.polys = [];
    this.cam = { x: 0, y: 8, z: -14, yaw: 0, pitch: 0.12 };
  }
  setCamera(x, y, z, yaw, pitch) {
    this.cam = { x, y, z, yaw, pitch };
  }
  clear() { this.polys.length = 0; }
  // Push one flat-shaded polygon. pts: [[x,y,z],...], normal: [nx,ny,nz].
  // base: hex color. bright: extra multiplier. alpha: 1 opaque.
  poly(pts, normal, base, bright = 1, alpha = 1) {
    let d = 0;
    for (const p of pts) d += p[2] - this.cam.z;
    const dot = Math.max(0, normal[0] * SUN_N.x + normal[1] * SUN_N.y + normal[2] * SUN_N.z);
    const f = (0.52 + 0.48 * dot) * bright;
    this.polys.push({ pts, color: shade(base, f), depth: d / pts.length, alpha });
  }
  // Unshaded polygon (sky glow, light cones, UI-ish overlays in world space).
  polyFlat(pts, color, depth, alpha = 1) {
    this.polys.push({ pts, color, depth, alpha });
  }
  project(p) {
    const c = this.cam;
    const dx = p[0] - c.x, dy = p[1] - c.y, dz = p[2] - c.z;
    const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
    const fwd = dx * sy + dz * cy;          // depth along view
    const right = dx * cy - dz * sy;        // lateral
    const sp = Math.sin(c.pitch), cp = Math.cos(c.pitch);
    const dep = fwd * cp + dy * sp;         // pitched depth
    const up = dy * cp - fwd * sp;          // pitched height
    if (dep < 0.6) return null;
    return [this.cx + (this.focal * right) / dep, this.cy - (this.focal * up) / dep, dep];
  }
  // A box centred at (x, yBase, z), size w (x) h (y) d (z), rotated by yaw.
  // Only faces that can face the camera are emitted; each face flat-shaded.
  box(x, yBase, z, w, h, d, yaw, colors, bright = 1) {
    const hw = w / 2, hd = d / 2;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const corner = (lx, lz) => [x + lx * cy + lz * sy, z - lx * sy + lz * cy];
    const c = [corner(-hw, -hd), corner(hw, -hd), corner(hw, hd), corner(-hw, hd)];
    const y0 = yBase, y1 = yBase + h;
    const top = [c[0][0], y1, c[0][1]], t1 = [c[1][0], y1, c[1][1]], t2 = [c[2][0], y1, c[2][1]], t3 = [c[3][0], y1, c[3][1]];
    this.poly([top, t1, t2, t3], [0, 1, 0], colors.top, bright);
    const faces = [
      { pts: [[c[0][0], y0, c[0][1]], [c[1][0], y0, c[1][1]], [c[1][0], y1, c[1][1]], [c[0][0], y1, c[0][1]]], n: [-sy, 0, -cy], col: colors.side },
      { pts: [[c[1][0], y0, c[1][1]], [c[2][0], y0, c[2][1]], [c[2][0], y1, c[2][1]], [c[1][0], y1, c[1][1]]], n: [cy, 0, -sy], col: colors.side },
      { pts: [[c[2][0], y0, c[2][1]], [c[3][0], y0, c[3][1]], [c[3][0], y1, c[3][1]], [c[2][0], y1, c[2][1]]], n: [sy, 0, cy], col: colors.side },
      { pts: [[c[3][0], y0, c[3][1]], [c[0][0], y0, c[0][1]], [c[0][0], y1, c[0][1]], [c[3][0], y1, c[3][1]]], n: [-cy, 0, sy], col: colors.side },
    ];
    for (const f of faces) {
      // Back-face cull: skip faces pointing away from the camera.
      const mx = (f.pts[0][0] + f.pts[2][0]) / 2 - this.cam.x;
      const mz = (f.pts[0][2] + f.pts[2][2]) / 2 - this.cam.z;
      if (f.n[0] * mx + f.n[2] * mz > 0) continue;
      this.poly(f.pts, f.n, f.col, bright);
    }
  }
  // Ground quad (flat, y constant), shaded by its up normal.
  ground(x0, z0, x1, z1, y, base, bright = 1) {
    this.poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, 1, 0], base, bright);
  }
  // Vertical billboard quad facing the camera yaw (for signs, glow).
  billboard(x, y, z, w, h, color, alpha = 1) {
    const sy = Math.sin(this.cam.yaw), cy = Math.cos(this.cam.yaw);
    const rx = cy, rz = -sy;
    const p = [
      [x - rx * w / 2, y, z - rz * w / 2], [x + rx * w / 2, y, z + rz * w / 2],
      [x + rx * w / 2, y + h, z + rz * w / 2], [x - rx * w / 2, y + h, z - rz * w / 2],
    ];
    this.polyFlat(p, color, z - this.cam.z, alpha);
  }
  drawSky(sunX, sunY) {
    const g = this.ctx.createLinearGradient(0, 0, 0, this.h * 0.72);
    g.addColorStop(0, '#3d2060'); g.addColorStop(0.34, '#8a3a72');
    g.addColorStop(0.62, '#e85d6b'); g.addColorStop(0.85, '#ff9a3c');
    g.addColorStop(1, '#ffc46b');
    this.ctx.fillStyle = g; this.ctx.fillRect(0, 0, this.w, this.h * 0.72);
    // Warm haze band right at the horizon so the skyline melts into the dusk.
    const hz = this.ctx.createLinearGradient(0, this.h * 0.60, 0, this.h * 0.72);
    hz.addColorStop(0, 'rgba(255,180,110,0)'); hz.addColorStop(1, 'rgba(255,180,110,0.35)');
    this.ctx.fillStyle = hz; this.ctx.fillRect(0, this.h * 0.60, this.w, this.h * 0.12);
    // Sun disc + glow.
    const sg = this.ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    sg.addColorStop(0, 'rgba(255,236,170,0.95)'); sg.addColorStop(0.25, 'rgba(255,190,90,0.55)');
    sg.addColorStop(1, 'rgba(255,150,60,0)');
    this.ctx.fillStyle = sg; this.ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    this.ctx.fillStyle = '#fff3c4';
    this.ctx.beginPath(); this.ctx.arc(sunX, sunY, 30, 0, Math.PI * 2); this.ctx.fill();
  }
  drawCloud(cx, cy, s, alpha) {
    this.ctx.fillStyle = `rgba(255,190,170,${alpha})`;
    for (const [ox, oy, r] of [[0, 0, 26], [26, 6, 20], [-26, 8, 18], [10, -10, 18]]) {
      this.ctx.beginPath(); this.ctx.arc(cx + ox * s, cy + oy * s, r * s, 0, Math.PI * 2); this.ctx.fill();
    }
  }
  flush() {
    this.polys.sort((a, b) => b.depth - a.depth);
    const ctx = this.ctx;
    for (const p of this.polys) {
      const pts = [];
      let ok = true;
      for (const v of p.pts) { const q = this.project(v); if (!q) { ok = false; break; } pts.push(q); }
      if (!ok || pts.length < 3) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
