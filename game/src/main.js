// Kota Seja — game loop, screens, HUD wiring.
// This module owns the DOM: title, pause, map, busted/wasted and
// mission-complete screens, the HUD bars and the circular minimap.
// The simulation itself lives in world.js; this file only drives it.
import { CONFIG, districtAt } from './config.js';
import { createWorld, update, startMission, missionObjectiveText, missionTarget, missionDef, serialize, deserialize, playerCar, exitCar, WEAPON_ORDER } from './world.js';
import { createInput, blankInput } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'kota-seja-save-v1';
const $ = (id) => document.getElementById(id);

export function startGame() {
  const canvas = $('game');
  const world = createWorld(CONFIG.seed);
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  const audio = createAudio();
  renderer.bakeCity(world.city);

  let last = performance.now();
  let shotApplied = false;
  const params = new URLSearchParams(location.search);
  const shotName = params.get('shot');

  // ------------------------------------------------------------ screens
  function showScreen(name) {
    for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
    const el = $('screen-' + name);
    if (el) el.classList.remove('hidden');
    if (name === 'title') updateTitleButtons();
  }
  function updateTitleButtons() {
    const hasSave = !!localStorage.getItem(SAVE_KEY);
    $('btn-continue').style.display = hasSave ? '' : 'none';
  }
  function startPlaying(fresh) {
    if (fresh) {
      const w = createWorld(CONFIG.seed);
      Object.keys(world).forEach((k) => { world[k] = w[k]; });
      renderer.bakeCity(world.city);
    }
    world.screen = 'playing';
    showScreen('none');
    $('hud').classList.remove('hidden');
    audio.unlock();
    audio.startMusic();
  }
  function loadSave() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw && deserialize(world, raw)) {
      startPlaying(false);
      world.screen = 'playing';
      showScreen('none');
      $('hud').classList.remove('hidden');
    }
  }
  function saveGame() {
    try { localStorage.setItem(SAVE_KEY, serialize(world)); } catch { /* storage full or blocked */ }
  }

  $('btn-new').addEventListener('click', () => { audio.click(); startPlaying(true); });
  $('btn-continue').addEventListener('click', () => { audio.click(); loadSave(); });
  $('btn-controls').addEventListener('click', () => { audio.click(); showScreen('controls'); });
  $('btn-controls-back').addEventListener('click', () => { audio.click(); showScreen('title'); });
  $('btn-resume').addEventListener('click', () => { audio.click(); resumeGame(); });
  $('btn-quit').addEventListener('click', () => { audio.click(); saveGame(); world.screen = 'title'; showScreen('title'); $('hud').classList.add('hidden'); });
  $('btn-map-close').addEventListener('click', () => { audio.click(); resumeGame(); });
  $('btn-busted').addEventListener('click', () => { audio.click(); respawn(); });
  $('btn-wasted').addEventListener('click', () => { audio.click(); respawn(); });
  $('btn-complete').addEventListener('click', () => { audio.click(); world.screen = 'playing'; showScreen('none'); saveGame(); });
  $('btn-mission').addEventListener('click', () => { audio.click(); world.screen = 'playing'; showScreen('none'); saveGame(); });
  $('btn-mute').addEventListener('click', () => {
    const muted = audio.toggleMute();
    $('btn-mute').textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
  });

  function respawn() {
    const p = world.player;
    p.health = 100; p.armour = 0; p.invulnerable = 3;
    p.x = world.city.spawn.x; p.z = world.city.spawn.z; p.y = 0;
    if (p.inCar !== null) exitCar(world);
    world.wanted = 0;
    world.police = [];
    world.screen = 'playing';
    showScreen('none');
  }
  function resumeGame() {
    world.screen = 'playing';
    showScreen('none');
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (world.screen === 'playing') {
        world.screen = 'paused';
        showScreen('pause');
        saveGame();
      } else if (world.screen === 'paused') resumeGame();
      else if (world.screen === 'map') resumeGame();
    }
    if (e.code === 'KeyM') {
      if (world.screen === 'playing') { world.screen = 'map'; showScreen('map'); drawFullMap(); }
      else if (world.screen === 'map') resumeGame();
    }
    if (e.code === 'KeyE' && world.screen === 'playing' && !world.mission.active) {
      const d = Math.hypot(world.player.x - world.city.hideout.x, world.player.z - world.city.hideout.z);
      if (d < 10) startMission(world);
    }
  });

  // ------------------------------------------------------------ minimap
  const mini = $('minimap');
  const mctx = mini.getContext('2d');
  function drawMinimap() {
    const S = 180, cx = S / 2, cy = S / 2;
    const scale = S / (world.city.halfX * 2 + 80);
    const px = (x) => cx + x * scale;
    const pz = (z) => cy + z * scale;
    mctx.clearRect(0, 0, S, S);
    mctx.save();
    mctx.beginPath();
    mctx.arc(cx, cy, S / 2 - 2, 0, Math.PI * 2);
    mctx.clip();
    mctx.fillStyle = '#2c4a2e';
    mctx.fillRect(0, 0, S, S);
    mctx.fillStyle = '#eed9a0';
    mctx.fillRect(0, pz(world.city.beach.z0), S, S);
    mctx.fillStyle = '#1c6f9e';
    mctx.fillRect(px(world.city.halfX), 0, S, S);
    mctx.strokeStyle = '#26262e';
    mctx.lineWidth = 4;
    for (const rx of world.city.roadXs) {
      mctx.beginPath(); mctx.moveTo(px(rx), 0); mctx.lineTo(px(rx), S); mctx.stroke();
    }
    for (const rz of world.city.roadZs) {
      mctx.beginPath(); mctx.moveTo(0, pz(rz)); mctx.lineTo(S, pz(rz)); mctx.stroke();
    }
    const t = missionTarget(world);
    if (t && world.mission.active) {
      mctx.fillStyle = '#ffd23d';
      mctx.beginPath(); mctx.arc(px(t.x), pz(t.z), 6, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.stroke();
    }
    mctx.fillStyle = '#ff5a7a';
    mctx.beginPath(); mctx.arc(px(world.city.hideout.x), pz(world.city.hideout.z), 4, 0, Math.PI * 2); mctx.fill();
    // Player arrow.
    const p = world.player;
    const car = playerCar(world);
    const ang = car ? car.angle : p.angle;
    mctx.save();
    mctx.translate(px(p.x), pz(p.z));
    mctx.rotate(-ang);
    mctx.fillStyle = '#fff';
    mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(6, 6); mctx.lineTo(-6, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
    mctx.restore();
    mctx.strokeStyle = '#fff';
    mctx.lineWidth = 3;
    mctx.beginPath(); mctx.arc(cx, cy, S / 2 - 2, 0, Math.PI * 2); mctx.stroke();
  }

  // ------------------------------------------------------------ full map
  const mapCanvas = $('fullmap');
  function drawFullMap() {
    const S = 520;
    mapCanvas.width = S; mapCanvas.height = S;
    const ctx = mapCanvas.getContext('2d');
    const scale = S / (world.city.halfX * 2 + 80);
    const px = (x) => S / 2 + x * scale;
    const pz = (z) => S / 2 + z * scale;
    ctx.fillStyle = '#2c4a2e'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#eed9a0'; ctx.fillRect(0, pz(world.city.beach.z0), S, S);
    ctx.fillStyle = '#1c6f9e'; ctx.fillRect(px(world.city.halfX), 0, S, S);
    ctx.strokeStyle = '#26262e'; ctx.lineWidth = 10;
    for (const rx of world.city.roadXs) { ctx.beginPath(); ctx.moveTo(px(rx), 0); ctx.lineTo(px(rx), S); ctx.stroke(); }
    for (const rz of world.city.roadZs) { ctx.beginPath(); ctx.moveTo(0, pz(rz)); ctx.lineTo(S, pz(rz)); ctx.stroke(); }
    ctx.fillStyle = '#7fb8d9';
    for (const b of world.city.buildings) {
      ctx.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * scale, b.d * scale);
    }
    const t = missionTarget(world);
    if (t) {
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath(); ctx.arc(px(t.x), pz(t.z), 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(t.label || 'TARGET', px(t.x) + 14, pz(t.z) + 5);
    }
    ctx.fillStyle = '#ff5a7a';
    ctx.beginPath(); ctx.arc(px(world.city.hideout.x), pz(world.city.hideout.z), 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText('HIDEOUT', px(world.city.hideout.x) + 12, pz(world.city.hideout.z) + 5);
    const p = world.player;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px(p.x), pz(p.z), 7, 0, Math.PI * 2); ctx.fill();
  }
  mapCanvas.addEventListener('click', (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * (world.city.halfX * 2 + 80);
    const z = ((e.clientY - rect.top) / rect.height - 0.5) * (world.city.halfX * 2 + 80);
    world.waypoint = { x, z };
    resumeGame();
  });

  // ------------------------------------------------------------ HUD
  function fmtClock() {
    const h = Math.floor(world.clockHours);
    const m = Math.floor((world.clockHours - h) * 60);
    return 'DAY ' + world.day + ' · ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function updateHUD() {
    const p = world.player;
    const car = playerCar(world);
    $('hud-clock').textContent = fmtClock();
    $('hud-money').textContent = '$' + world.money.toLocaleString('en-US');
    $('hud-debt').textContent = 'DEBT $' + (CONFIG.debt - world.debtPaid).toLocaleString('en-US');
    $('hud-stars').textContent = '★'.repeat(world.wanted) + '☆'.repeat(5 - world.wanted);
    $('hud-stars').style.color = world.wanted > 0 ? '#ffdf3d' : '#ffffff88';
    $('bar-health').style.width = p.health + '%';
    $('bar-armour').style.width = p.armour + '%';
    $('bar-respect').style.width = world.respect + '%';
    $('hud-health-num').textContent = Math.ceil(p.health);
    $('hud-district').textContent = districtAt(p.x, p.z).toUpperCase();
    const def = missionDef(world);
    $('hud-mission').textContent = def
      ? 'MISSION ' + (world.mission.index + 1) + '/8 · ' + def.name + ' — ' + missionObjectiveText(world)
      : 'ALL MISSIONS COMPLETE';
    $('hud-stage').textContent = def
      ? 'STAGE ' + (world.mission.stage + 1) + '/2 · NEXT ▸ ' + (missionTarget(world)?.label ?? 'Explore the city')
      : 'Kota Seja is yours';
    const wdef = CONFIG.weapons[p.weapon];
    $('hud-weapon').textContent = wdef.name + (wdef.mag === Infinity ? '' : '  ' + p.ammo[p.weapon] + '/' + (p.reserve[p.weapon] ?? 0));
    $('hud-speed').textContent = car ? Math.round(Math.abs(car.speed) * 3.6) + ' km/h' : Math.round(p.speed * 3.6) + ' km/h';
    $('hud-msg').textContent = world.messageTimer > 0 ? world.message : '';
    $('hud-radio').textContent = world.radioTimer > 0 ? world.radio : '';
    for (const key of WEAPON_ORDER) {
      const el = $('slot-' + key);
      if (!el) continue;
      el.classList.toggle('active', p.weapon === key);
      el.classList.toggle('locked', !p.owned[key]);
      el.textContent = (CONFIG.weapons[key].slot) + ' ' + CONFIG.weapons[key].name + (p.owned[key] ? '' : ' —');
    }
    drawMinimap();
  }

  // ------------------------------------------------------------ camera
  function cameraFor() {
    const p = world.player;
    const car = playerCar(world);
    const cx = car ? car.x : p.x;
    const cz = car ? car.z : p.z;
    const yaw = world.cameraYaw;
    // A higher, further camera while driving: less road fills the bottom
    // of the frame and more of the street ahead is visible.
    const dist = car ? 11 : (input.aim ? 5.5 : 9.5);
    const height = (car ? 4.2 : 3.2) + world.cameraPitch * 6;
    const eye = [
      cx - Math.sin(yaw) * dist,
      height + (p.y || 0),
      cz - Math.cos(yaw) * dist,
    ];
    const target = [cx + Math.sin(yaw) * 2, 1.6 + (p.y || 0), cz + Math.cos(yaw) * 2];
    return { eye, target, aim: input.aim };
  }

  // ------------------------------------------------------------ loop
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const look = input.consumeLook();
    input.lookDX = look.dx;
    input.lookDY = look.dy;
    if (world.screen !== 'playing') {
      // Drop one-shot actions pressed on a menu so they do not fire later.
      input.enterCar = false; input.interact = false; input.reload = false; input.jump = false;
    }
    if (!shotApplied && shotName) {
      shotApplied = true;
      applyShot(world, shotName);
      world.screen = 'playing';
      showScreen('none');
      $('hud').classList.remove('hidden');
      audio.unlock();
    }
    if (world.screen === 'playing') {
      const prevWeapon = world.player.weapon;
      const prevAmmo = world.player.ammo[world.player.weapon];
      update(world, input, dt);
      if (world.player.weapon !== prevWeapon) audio.click();
      if (world.player.ammo[world.player.weapon] < prevAmmo) audio.shot(world.player.weapon);
      if (world.screen === 'missionComplete') { showScreen('mission'); audio.mission(); }
      if (world.screen === 'busted') showScreen('busted');
      if (world.screen === 'wasted') showScreen('wasted');
      if (world.screen === 'complete') showScreen('complete');
      updateHUD();
    } else if (world.screen === 'title') {
      // Slow orbit around the hideout behind the title screen.
      world.time += dt;
      world.cameraYaw += dt * 0.05;
    }
    if (world.screen === 'playing' || world.screen === 'title' || world.screen === 'paused' || world.screen === 'map') {
      renderer.render(world, cameraFor());
    }
    // Autosave every 10 seconds of play.
    if (world.screen === 'playing' && Math.floor(world.time) % 10 === 0 && world.time - (frame._lastSave || 0) > 9) {
      frame._lastSave = world.time;
      saveGame();
    }
  }

  showScreen('title');
  $('hud').classList.add('hidden');
  requestAnimationFrame(frame);
  return { world, input, renderer, audio };
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    window.__kotaSeja = startGame();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<pre style="color:#fff;padding:2em">Kota Seja failed to start:\n' + String(err && err.stack || err) + '</pre>';
  }
});
