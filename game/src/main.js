// Kota Seja — Golden Hour Pursuit: the playable game.
// WASD drive/walk, mouse drag to look, E enter/steal a car, SPACE handbrake,
// Q/E/R crew abilities, M map, ESC pause. Saves to localStorage.
// ?shot=1..4 renders one frozen staged screenshot and sets window.__sejaReady.
import { buildCity, drawGround, drawBuilding, drawCar, drawHeli, drawPalm, drawPerson } from './city.js';
import { renderShot1, renderShot2, renderShot3, renderShot4 } from './shots.js';
import { drawHud, HUD_STATE } from './hud.js';
import { Renderer3D } from './renderer3d.js';

const W = 1280, H = 720;
const canvas = document.getElementById('game');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');
const city = buildCity(20261121);
const params = new URLSearchParams(location.search);
const shot = Number(params.get('shot') || 0);

const state = {
  mode: 'title', // title | play | map | pause
  onFoot: false,
  px: 0, pz: 20, pyaw: 0, speed: 0,
  carX: 0, carZ: 26, carYaw: 0, carSpeed: 0, carColor: '#d33a2c',
  camYaw: 0, camPitch: 0.16,
  wanted: 0, money: 48250, mission: 0, time: 18 * 60 + 42,
  keys: {}, heliAngle: 0.7, t: 0,
};
const MISSIONS = [
  { name: 'GOLDEN HOUR PURSUIT', next: 'Lose the KSPD tail — reach the Marina safehouse' },
  { name: 'MEET THE CREW', next: 'Talk to Dre by the blue coupe, then grab the package' },
  { name: 'THE MARINA HEIST', next: 'Steal the cartel speedboat at the docks' },
];

function beep(freq = 660, ms = 90) {
  try {
    const ac = state.audio || (state.audio = new (window.AudioContext || window.webkitAudioContext)());
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; g.gain.value = 0.05;
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + ms / 1000);
  } catch { /* audio is optional */ }
}
function saveGame() {
  try { localStorage.setItem('kota-seja-save', JSON.stringify({ money: state.money, mission: state.mission, wanted: state.wanted, time: state.time })); } catch { /* no storage */ }
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem('kota-seja-save') || 'null');
    if (s) { state.money = s.money; state.mission = s.mission; state.wanted = s.wanted; state.time = s.time; }
  } catch { /* no save */ }
}

function renderPlay(dt) {
  const r = new Renderer3D(ctx, W, H);
  const px = state.onFoot ? state.px : state.carX;
  const pz = state.onFoot ? state.pz : state.carZ;
  const yaw = state.onFoot ? state.pyaw : state.carYaw;
  // Chase camera: behind and above the player, mouse yaw offsets it.
  const camYaw = yaw + Math.PI + state.camYaw;
  const camDist = 13 + Math.abs(state.onFoot ? state.speed : state.carSpeed) * 0.06;
  const cx = px + Math.sin(camYaw) * -camDist, cz = pz + Math.cos(camYaw) * -camDist;
  r.setCamera(cx, 7.2, cz, yaw + state.camYaw, state.camPitch);
  r.drawSky(330, 300);
  r.drawCloud(180, 96, 1.1, 0.5); r.drawCloud(1020, 70, 0.9, 0.45);
  drawGround(r);
  for (const b of city.buildings) drawBuilding(r, b);
  for (const p of city.palms) drawPalm(r, p);
  for (const c of city.traffic) {
    c.z += Math.sin(c.yaw) * c.speed * dt;
    if (c.z > 100) c.z = -130; if (c.z < -130) c.z = 100;
    drawCar(r, c.x, c.z, c.yaw, c.color);
  }
  for (const p of city.peds) drawPerson(r, p.x, p.z, Math.PI * 0.5, p.shirt, p.skin, state.t + p.phase);
  drawCar(r, state.carX, state.carZ, state.carYaw, state.carColor, { smoke: Math.abs(state.carSpeed) > 26 });
  if (state.onFoot) drawPerson(r, state.px, state.pz, state.pyaw, '#e84a5f', '#c68e5e', state.t * 6);
  if (state.wanted >= 2) {
    drawCar(r, px - 4, pz - 18, yaw, '#1c2f4a', { police: true });
    drawHeli(r, px + 16, 34, pz + 26, 0.35, state.heliAngle);
  }
  r.flush();
  const st = JSON.parse(JSON.stringify(HUD_STATE));
  st.wanted = state.wanted;
  st.money = state.money;
  st.mission = { ...HUD_STATE.mission, name: MISSIONS[state.mission].name, next: MISSIONS[state.mission].next };
  st.speed = Math.round(Math.abs(state.onFoot ? state.speed * 3.6 : state.carSpeed * 3.6));
  st.car = state.onFoot ? 'ON FOOT — RICO VEGA' : 'SEJA GT COUPE';
  const hh = String(Math.floor(state.time / 60)).padStart(2, '0'), mm = String(state.time % 60).padStart(2, '0');
  st.time = `${hh}:${mm}`;
  drawHud(ctx, W, H, st);
  // Controls hint.
  ctx.font = '400 13px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('WASD drive/walk • E enter car • SPACE handbrake • M map • ESC pause', 14, H - 24);
}

function update(dt) {
  state.t += dt;
  state.heliAngle += dt * 9;
  const k = state.keys;
  if (state.onFoot) {
    const sp = 6;
    let mx = 0, mz = 0;
    if (k.KeyW) mz += 1; if (k.KeyS) mz -= 1; if (k.KeyA) mx -= 1; if (k.KeyD) mx += 1;
    if (mx || mz) {
      const a = Math.atan2(mx, mz) + state.pyaw;
      state.px += Math.sin(a) * sp * dt; state.pz += Math.cos(a) * sp * dt;
      state.speed = sp; state.pyaw = a;
    } else state.speed = 0;
    if (Math.abs(state.px - state.carX) < 3 && Math.abs(state.pz - state.carZ) < 3 && k.KeyE) {
      state.onFoot = false; beep(520, 80);
    }
  } else {
    if (k.KeyW) state.carSpeed += 22 * dt;
    if (k.KeyS) state.carSpeed -= 26 * dt;
    if (k.KeyA) state.carYaw -= 1.9 * dt * Math.sign(state.carSpeed || 1);
    if (k.KeyD) state.carYaw += 1.9 * dt * Math.sign(state.carSpeed || 1);
    if (k.Space) state.carSpeed *= (1 - 3 * dt);
    state.carSpeed *= (1 - 0.6 * dt);
    state.carSpeed = Math.max(-14, Math.min(38, state.carSpeed));
    state.carX += Math.sin(state.carYaw) * state.carSpeed * dt;
    state.carZ += Math.cos(state.carYaw) * state.carSpeed * dt;
    state.carX = Math.max(-150, Math.min(150, state.carX));
    state.carZ = Math.max(-130, Math.min(95, state.carZ));
    if (k.KeyE && Math.abs(state.carSpeed) < 1) { state.onFoot = true; state.px = state.carX + 2; state.pz = state.carZ; beep(440, 80); }
  }
  // Wanted heat rises when speeding through the city, cools off slowly.
  if (!state.onFoot && Math.abs(state.carSpeed) > 30 && state.wanted < 3) state.wanted = 3;
  if (state.wanted > 0 && Math.abs(state.carSpeed) < 2) state.wanted = Math.max(0, state.wanted - dt * 0.02);
}

function renderTitle() {
  renderShot4(ctx, W, H, city);
}
function renderMap() {
  renderShot3(ctx, W, H, city);
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  if (state.mode === 'play') { update(dt); renderPlay(dt); }
  else if (state.mode === 'map') renderMap();
  else if (state.mode === 'pause') {
    renderPlay(0);
    ctx.fillStyle = 'rgba(10,8,20,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.font = '700 48px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('PAUSED', W / 2, 280);
    ctx.font = '400 18px Arial'; ctx.fillStyle = '#ffd166';
    ctx.fillText('ESC resume  •  progress auto-saves after every mission', W / 2, 350);
  } else renderTitle();
  requestAnimationFrame(frame);
}

addEventListener('keydown', (e) => {
  state.keys[e.code] = true;
  if (e.code === 'Enter' && state.mode === 'title') { state.mode = 'play'; loadGame(); beep(660, 100); }
  else if (e.code === 'KeyM') state.mode = state.mode === 'map' ? 'play' : 'map';
  else if (e.code === 'Escape') state.mode = state.mode === 'pause' ? 'play' : 'pause';
  else if (e.code === 'KeyQ' || e.code === 'KeyR') beep(880, 60);
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { state.keys[e.code] = false; });
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  state.camYaw += (e.clientX - lastX) * 0.004;
  state.camPitch = Math.max(-0.1, Math.min(0.5, state.camPitch + (e.clientY - lastY) * 0.002));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('click', () => {
  if (state.mode === 'title') { state.mode = 'play'; loadGame(); beep(660, 100); }
});
addEventListener('beforeunload', saveGame);

if (shot >= 1 && shot <= 4) {
  // Frozen staged shot: render once, no loop, no clock.
  if (shot === 1) renderShot1(ctx, W, H, city);
  else if (shot === 2) renderShot2(ctx, W, H, city);
  else if (shot === 3) renderShot3(ctx, W, H, city);
  else renderShot4(ctx, W, H, city);
  window.__sejaReady = true;
} else {
  loadGame();
  window.__sejaReady = true;
  requestAnimationFrame(frame);
}
