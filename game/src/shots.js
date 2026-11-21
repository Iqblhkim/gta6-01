// Kota Seja — the four staged screenshots. Each shot is a frozen,
// deterministic staging: fixed camera, fixed props, fixed HUD values.
// Re-capturing a shot renders the same pixels every time.
import { buildCity, drawGround, drawBuilding, drawCar, drawHeli, drawPalm, drawPerson, DISTRICTS } from './city.js';
import { drawHud, HUD_STATE } from './hud.js';
import { Renderer3D } from './renderer3d.js';

function drawWorld(r, city, sunX, sunY) {
  r.drawSky(sunX, sunY);
  r.drawCloud(150, 80, 0.9, 0.5); r.drawCloud(1080, 70, 1.0, 0.45); r.drawCloud(950, 195, 1.1, 0.35);
  drawGround(r);
  for (const b of city.buildings) drawBuilding(r, b);
  for (const p of city.palms) drawPalm(r, p);
}
function drawTrafficAndPeds(r, city, t, skip = null) {
  for (const c of city.traffic) {
    if (skip && Math.hypot(c.x - skip.x, c.z - skip.z) < skip.r) continue;
    drawCar(r, c.x, c.z + Math.sin(t + c.speed) * 0, c.yaw, c.color);
  }
  for (const p of city.peds) {
    if (skip && Math.hypot(p.x - skip.x, p.z - skip.z) < skip.r) continue;
    drawPerson(r, p.x, p.z, Math.PI * 0.5, p.shirt, p.skin, t + p.phase);
  }
}

// SHOT 1 — chase on the beach boulevard at golden hour.
export function renderShot1(ctx, W, H, city) {
  const r = new Renderer3D(ctx, W, H);
  r.setCamera(2, 7, -2, -0.03, -0.05);
  drawWorld(r, city, 330, 300);
  drawTrafficAndPeds(r, city, 1.2, { x: 0, z: 34, r: 9 });
  // Player car (centre, fleeing down the boulevard) with tire smoke.
  drawCar(r, 0, 34, 0, '#d33a2c', { smoke: true });
  // Police in pursuit: one close behind, one flanking.
  drawCar(r, -3.5, 20, 0, '#1c2f4a', { police: true });
  drawCar(r, 5, 48, 0.12, '#1c2f4a', { police: true });
  drawCar(r, -7.5, 58, -0.08, '#e8b73a');
  // Heli overhead, spotlight on the player.
  drawHeli(r, 0, 22, 58, 0.35, 0.7);
  // On-foot crew member on the sidewalk.
  drawPerson(r, -13.2, 30, Math.PI / 2, '#2ec4b6', '#8d5524', 2.1);
  r.flush();
  drawHud(ctx, W, H, HUD_STATE);
}

// SHOT 2 — on foot: Rico faces a crew member beside a parked car.
export function renderShot2(ctx, W, H, city) {
  const r = new Renderer3D(ctx, W, H);
  r.setCamera(-3, 3.0, 13, 0.10, 0.05);
  drawWorld(r, city, 950, 290);
  drawTrafficAndPeds(r, city, 2.4, { x: 0, z: 26, r: 10 });
  drawCar(r, 5, 30, 0.06, '#2c6ed3');
  drawPerson(r, -1.5, 26, 0.5, '#e84a5f', '#c68e5e', 0.6);   // Rico
  drawPerson(r, 2.5, 28, -1.1, '#ffd166', '#8d5524', 1.8);  // Dre
  drawPerson(r, -13, 26, Math.PI / 2, '#f4f4f4', '#e8b88a', 3.0);
  drawCar(r, -4, 36, 0.1, '#1c2f4a', { police: true });
  drawHeli(r, -16, 32, 58, -0.3, 2.2);
  r.flush();
  const st = { ...HUD_STATE, speed: 0, car: 'ON FOOT — RICO VEGA', condition: 100, mission: { ...HUD_STATE.mission, name: 'MEET THE CREW', stage: 1, stages: 5, progress: 22, next: 'Talk to Dre by the blue coupe, then grab the package', story: 3, storyTotal: 12, side: 4 } };
  drawHud(ctx, W, H, st);
}

// SHOT 3 — full island map + career + garage.
export function renderShot3(ctx, W, H, city) {
  const r = new Renderer3D(ctx, W, H);
  r.setCamera(0, 26, -40, 0, 0.32);
  drawWorld(r, city, 640, 200);
  r.flush();
  ctx.fillStyle = 'rgba(10,8,20,0.72)'; ctx.fillRect(0, 0, W, H);
  // Map panel.
  ctx.fillStyle = 'rgba(16,20,34,0.96)'; ctx.fillRect(40, 30, 780, 660);
  ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2; ctx.strokeRect(40.5, 30.5, 780, 660);
  ctx.font = '700 26px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('KOTA SEJA — ISLAND MAP', 66, 52);
  ctx.font = '400 13px Arial'; ctx.fillStyle = '#ffd166';
  ctx.fillText('4 districts  •  12 story missions  •  8 side jobs  •  zoom with mouse wheel', 66, 86);
  // Island: sea, sand rim, land, roads, districts.
  const cx = 430, cy = 400, s = 2.1;
  ctx.fillStyle = '#274a7d'; ctx.beginPath(); ctx.ellipse(cx, cy, 330, 250, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c88a'; ctx.beginPath(); ctx.ellipse(cx, cy, 296, 222, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3d4458'; ctx.beginPath(); ctx.ellipse(cx, cy, 278, 206, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5a5a6e'; ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx + i * 72, cy - 200); ctx.lineTo(cx + i * 72, cy + 200); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 270, cy + i * 58); ctx.lineTo(cx + 270, cy + i * 58); ctx.stroke();
  }
  // District labels (offset above their point) + markers (on the point).
  ctx.font = '700 15px Arial'; ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.color; ctx.fillText(d.name, cx + d.x * s, cy + d.z * s - 24);
  }
  const markers = [
    { x: 0, z: 30, c: '#ffd166', l: 'M — SAFEHOUSE' },
    { x: -95, z: -60, c: '#ff5a5a', l: 'M — THE HEIST' },
    { x: 30, z: 65, c: '#7ee081', l: 'GARAGE' },
    { x: 100, z: -55, c: '#7fb3ff', l: 'SIDE JOB' },
    { x: -100, z: 75, c: '#ffffff', l: 'YOU' },
  ];
  for (const m of markers) {
    const mx = cx + m.x * s, my = cy + m.z * s;
    ctx.fillStyle = m.c; ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '700 11px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText(m.l, mx + 12, my - 5);
  }
  // Right column: career stats + garage.
  ctx.fillStyle = 'rgba(16,20,34,0.96)'; ctx.fillRect(844, 30, 396, 660);
  ctx.strokeStyle = '#ff9a3c'; ctx.strokeRect(844.5, 30.5, 396, 660);
  ctx.font = '700 20px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.fillText('CAREER — RICO VEGA', 868, 52);
  const stats = [
    ['MONEY', '$48,250'], ['RANK', 'STREET KING — RP 71%'], ['STORY', '3 / 12 missions'],
    ['SIDE JOBS', '4 done'], ['WANTED', '★★★ (3 stars)'], ['CARS OWNED', '5'], ['TIME', 'FRI 18:42'],
  ];
  ctx.font = '400 15px Arial';
  stats.forEach(([k, v], i) => {
    ctx.fillStyle = '#ffd166'; ctx.fillText(k, 868, 96 + i * 30);
    ctx.fillStyle = '#fff'; ctx.fillText(v, 1000, 96 + i * 30);
  });
  ctx.font = '700 18px Arial'; ctx.fillStyle = '#ff9a3c';
  ctx.fillText('GARAGE — PALM ROW', 868, 330);
  const cars = [['SEJA GT COUPE', 'OWNED — equipped'], ['MARINA SPYDER', 'OWNED'], ['DOCK HAULER', 'OWNED'], ['HELI — AIR ONE', 'STOLEN — parked'], ['POLICE CRUISER', 'WANTED TO STEAL']];
  ctx.font = '400 14px Arial';
  cars.forEach(([n, s], i) => {
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(n, 868, 362 + i * 28);
    ctx.fillStyle = '#7ee081'; ctx.textAlign = 'right'; ctx.fillText(s, 1216, 362 + i * 28);
  });
  ctx.font = '400 13px Arial'; ctx.fillStyle = '#c8c8d8';
  ctx.fillText('M — map   •   TAB — missions   •   ESC — pause', 868, 620);
  ctx.fillText('Save: auto-saves after every mission (slot 1).', 868, 644);
}

// SHOT 4 — title screen over the sunset skyline.
export function renderShot4(ctx, W, H, city) {
  const r = new Renderer3D(ctx, W, H);
  r.setCamera(0, 30, -90, 0, 0.30);
  drawWorld(r, city, 640, 250);
  drawHeli(r, -24, 42, -20, 0.5, 1.1);
  drawCar(r, 0, 20, 0, '#d33a2c');
  drawCar(r, -4, 34, 0, '#1c2f4a', { police: true });
  r.flush();
  ctx.fillStyle = 'rgba(10,6,24,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '700 84px Arial'; ctx.fillStyle = '#ffd166';
  ctx.fillText('KOTA SEJA', W / 2, 84);
  ctx.font = '700 30px Arial'; ctx.fillStyle = '#fff';
  ctx.fillText('GOLDEN HOUR PURSUIT', W / 2, 176);
  ctx.font = '400 18px Arial'; ctx.fillStyle = '#ffe9c8';
  ctx.fillText('One island. One crew. One sunset to steal the city back.', W / 2, 222);
  // Story card.
  ctx.fillStyle = 'rgba(12,10,22,0.85)'; ctx.fillRect(120, 300, 420, 190);
  ctx.strokeStyle = '#ff9a3c'; ctx.strokeRect(120.5, 300.5, 420, 190);
  ctx.textAlign = 'left'; ctx.font = '700 16px Arial'; ctx.fillStyle = '#ff9a3c';
  ctx.fillText('THE STORY', 142, 318);
  ctx.font = '400 15px Arial'; ctx.fillStyle = '#fff';
  const lines = ['Rico Vega came home to Kota Seja', 'to find his brother\'s crew broken', 'and the harbor owned by the', 'Marina Cartel. Build the crew,', 'take the jobs, outrun the KSPD', '— and own the golden hour.'];
  lines.forEach((l, i) => ctx.fillText(l, 142, 344 + i * 22));
  // How to play.
  ctx.fillStyle = 'rgba(12,10,22,0.85)'; ctx.fillRect(740, 300, 420, 190);
  ctx.strokeStyle = '#ff9a3c'; ctx.strokeRect(740.5, 300.5, 420, 190);
  ctx.font = '700 16px Arial'; ctx.fillStyle = '#ff9a3c';
  ctx.fillText('HOW TO PLAY', 762, 318);
  ctx.font = '400 15px Arial'; ctx.fillStyle = '#fff';
  const keys = ['WASD — drive / walk', 'MOUSE — look around', 'E — enter / steal a car', 'SPACE — handbrake', 'Q / E / R — crew abilities', 'M — map    ESC — pause'];
  keys.forEach((l, i) => ctx.fillText(l, 762, 344 + i * 22));
  // Menu.
  ctx.textAlign = 'center'; ctx.font = '700 24px Arial';
  ctx.fillStyle = '#ff9a3c'; ctx.fillText('▶  CONTINUE — STORY 3/12', W / 2, 540);
  ctx.fillStyle = '#fff'; ctx.fillText('NEW GAME', W / 2, 580);
  ctx.fillStyle = '#c8c8d8'; ctx.font = '400 14px Arial';
  ctx.fillText('A save exists (slot 1, FRI 18:42)  •  v1.0  •  plays offline, keyboard + mouse', W / 2, 632);
  ctx.fillText('Kota Seja is an original city. No Rockstar names, art or assets.', W / 2, 656);
}
