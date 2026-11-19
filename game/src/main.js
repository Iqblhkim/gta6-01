// Kota Seja — game loop, screens, HUD wiring.
// This module owns the DOM: title, pause, map, busted/wasted and
// mission-complete screens, the HUD bars and the circular minimap.
// The simulation itself lives in world.js; this file only drives it.
import { CONFIG, districtAt } from './config.js';
import { createWorld, update, updateTitleBackdrop, startMission, missionObjectiveText, missionTarget, missionDef, serialize, deserialize, playerCar, exitCar, WEAPON_ORDER, angleLerp, showMessage, radio } from './world.js';
import { createInput, blankInput, attachTouch, isTouchDevice } from './input.js';
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
  let lastManualLookMs = 0;
  let prevHornTimer = 0; // round 7: rising edge of the horn timer
  const params = new URLSearchParams(location.search);
  const shotName = params.get('shot');
  // Touch controls (round 5): only on touch devices (or ?touch=1 for
  // testing). The touch layer is hidden on the title screen — its
  // buttons only make sense while playing — and PETA / JEDA call the
  // same screen functions as the M / ESC keys.
  const touchMode = isTouchDevice() || params.get('touch') === '1';
  if (touchMode) {
    document.body.classList.add('touch');
    attachTouch(input, {
      onMap: () => {
        if (world.screen === 'playing') { world.screen = 'map'; showScreen('map'); drawFullMap(); }
        else if (world.screen === 'map') resumeGame();
      },
      onPause: () => {
        if (world.screen === 'playing') {
          world.screen = 'paused';
          showScreen('pause');
          saveGame();
        } else if (world.screen === 'paused') resumeGame();
      },
      onMute: () => toggleMute(),
      // Round 7: STASIUN cycles the 3 radio stations, KAMERA
      // toggles chase / top-down, LAMPU cycles auto → on → off.
      onStation: () => cycleStation(),
      onCamera: () => toggleCamera(),
      onLights: () => toggleLights(),
    });
  }

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
    // Round 7 (packet 1): the cinematic fade — the screen dips to
    // black for a beat, then the city fades in behind the HUD.
    const fade = $('fade');
    if (fade) {
      fade.classList.add('on');
      setTimeout(() => fade.classList.remove('on'), 60);
    }
  }
  function loadSave() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw && deserialize(world, raw)) {
      // Round 7: the saved radio station and settings come back
      // with the save (camera mode, lights, station, clock hour).
      audio.setStation(world.settings.station);
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
    toggleMute();
  });

  function toggleMute() {
    const muted = audio.toggleMute();
    $('btn-mute').textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
  }

  // Round 7 — radio stations (STASIUN button on the HUD, STASIUN
  // touch button, N key). cycleStation returns the live state; the
  // HUD label always shows the station name or OFF, and the choice
  // is saved with the game (world.settings.station). The old MUSIK
  // on/off toggle is retired — cycling through the stations reaches
  // OFF as its last step, so no second button is needed.
  function cycleStation() {
    const st = audio.cycleStation();
    world.settings.station = st.station;
    const label = st.on ? 'STASIUN: ' + st.name : 'STASIUN: OFF';
    const hudBtn = $('btn-station');
    if (hudBtn) hudBtn.textContent = label;
    if (world.screen === 'playing') {
      radio(world, st.on ? 'Radio: ' + st.name + ' — sekarang diputar.' : 'Radio mati.');
    }
    return st;
  }
  $('btn-station').addEventListener('click', () => {
    audio.click();
    cycleStation();
  });

  // Round 7 — CAMERA (packet 3): chase / top-down, C key, KAMERA
  // button (HUD + touch). The mode is saved with the game.
  function toggleCamera() {
    const modes = CONFIG.camModes;
    const i = modes.indexOf(world.settings.camMode);
    world.settings.camMode = modes[(i + 1) % modes.length];
    showMessage(world, 'Kamera: ' + (world.settings.camMode === 'top' ? 'TOP-DOWN' : 'CHASE'), 2);
  }
  $('btn-camera').addEventListener('click', () => {
    audio.click();
    toggleCamera();
  });

  // Round 7 — LIGHTS (packet 6): auto → on → off, L key, LAMPU
  // button (HUD + touch). Auto means the headlights switch on by
  // themselves at night and off at dawn.
  function toggleLights() {
    const modes = CONFIG.lightsModes;
    const i = modes.indexOf(world.settings.lights);
    world.settings.lights = modes[(i + 1) % modes.length];
    showMessage(world, 'Lampu: ' + world.settings.lights.toUpperCase()
      + (world.settings.lights === 'auto' ? ' (nyala otomatis saat malam)' : ''), 2);
  }
  $('btn-light').addEventListener('click', () => {
    audio.click();
    toggleLights();
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

  // Round 6 — autoplay rule: the AudioContext is created/resumed on
  // the player's FIRST gesture (pointer or key), and the radio starts
  // then too — on the title screen as well as in play, so the living
  // title (packet 12) has its sunset radio. Nothing plays before a
  // gesture, and the radio is ON by default once it can play (MUSIK /
  // N turns it off again).
  const firstGesture = () => {
    audio.unlock();
    if (world.screen === 'playing' || world.screen === 'title') audio.startMusic();
  };
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

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
    // Round 7: N cycles the radio stations (STASIUN). E / F / H /
    // C / L are owned by input.js (E = A, F = B, H = horn, C =
    // camera, L = lights) — main.js consumes the camera/lights
    // one-shots in the frame loop below, and the world consumes A/B
    // and the horn. The old E = start-mission-near-hideout shortcut
    // is retired: A shows MULAI there now, one button, one job.
    if (e.code === 'KeyN' && world.screen === 'playing') cycleStation();
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
    // Waypoint set by the MISI button (or by clicking the full map).
    if (world.waypoint) {
      mctx.fillStyle = '#fff';
      mctx.beginPath(); mctx.arc(px(world.waypoint.x), pz(world.waypoint.z), 4, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#ffd23d'; mctx.lineWidth = 2; mctx.stroke();
    }
    mctx.fillStyle = '#ff5a7a';
    mctx.beginPath(); mctx.arc(px(world.city.hideout.x), pz(world.city.hideout.z), 4, 0, Math.PI * 2); mctx.fill();
    // Round 7 (packet 9): the landmark tower gets a gold star on the
    // minimap, so the skyline's tallest point is findable at a glance.
    if (world.city.landmark) {
      mctx.fillStyle = '#ffd23d';
      mctx.beginPath(); mctx.arc(px(world.city.landmark.x), pz(world.city.landmark.z), 5, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5; mctx.stroke();
    }
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
    // Round 7 (packet 9): the landmark tower on the full map too.
    if (world.city.landmark) {
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath(); ctx.arc(px(world.city.landmark.x), pz(world.city.landmark.z), 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText('MENARA SEJA', px(world.city.landmark.x) + 12, pz(world.city.landmark.z) + 5);
    }
    if (world.waypoint) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px(world.waypoint.x), pz(world.waypoint.z), 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 2; ctx.stroke();
    }
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
    // Round 7 (packet 4): the clock shows the phase too — PAGI,
    // SIANG, SENJA, MALAM — so the day/night cycle is readable.
    const phase = (world.dayPhase?.name ?? 'sunset').toUpperCase();
    return 'DAY ' + world.day + ' · ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' · ' + phase;
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
    // Round 7 — Halcyon labels: the two big buttons always show what
    // A and B will do RIGHT NOW (world.contextA/B are refreshed every
    // update), and the station / camera / lights labels show live
    // state, so the player never has to guess what a button does.
    const btnA = $('btn-touch-a');
    if (btnA) btnA.textContent = world.contextA.label;
    const btnB = $('btn-touch-b');
    if (btnB) btnB.textContent = world.contextB.label;
    const stBtn = $('btn-station');
    if (stBtn) stBtn.textContent = 'STASIUN: ' + (audio.musicOn ? audio.stationName() : 'OFF');
    const camBtn = $('btn-camera');
    if (camBtn) camBtn.textContent = 'KAMERA: ' + world.settings.camMode.toUpperCase();
    const lightBtn = $('btn-light');
    if (lightBtn) lightBtn.textContent = 'LAMPU: ' + world.settings.lights.toUpperCase();
    const runBtn = $('btn-touch-run');
    if (runBtn) {
      runBtn.classList.toggle('active', input.moveMode === 'run');
      runBtn.textContent = input.moveMode === 'run' ? 'LARI ●' : 'LARI';
    }
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
    const onTitle = world.screen === 'title';
    // Round 7 (packet 1) — CINEMATIC MENU: the title camera no longer
    // sits on one intersection — it sweeps the city on a slow loop:
    // the busy intersection, the landmark tower, the beachfront, the
    // harbour, and back. The orbit rate stays 0.05 rad/s (round 6),
    // but the focus drifts between viewpoints and the height breathes,
    // so the menu feels like a film shot, not a still. world.time is
    // the clock here (it advances on the title screen, see the frame
    // loop), one stop every 12 s, a full sweep every 48 s.
    const titleStops = [
      { x: 26, z: 26, r: 13, h: 5.5 },   // busy intersection
      { x: 0, z: -104, r: 26, h: 12 },  // landmark tower
      { x: -52, z: 130, r: 20, h: 8 },  // beachfront
      { x: 160, z: 0, r: 22, h: 9 },    // harbour
    ];
    const titleT = (world.time / 12) % titleStops.length;
    // Round 7: clamp the stop index into range — a negative or NaN
    // world.time (a clock glitch at load) used to pick stop -1 and
    // throw here every frame; the sweep just sits on stop 0 instead.
    const ti = Math.max(0, Math.min(titleStops.length - 1, Math.floor(titleT)));
    const tf = Math.max(0, Math.min(1, titleT - ti));
    const tA = titleStops[ti], tB = titleStops[(ti + 1) % titleStops.length];
    const cx = onTitle ? tA.x + (tB.x - tA.x) * tf : (car ? car.x : p.x);
    const cz = onTitle ? tA.z + (tB.z - tA.z) * tf : (car ? car.z : p.z);
    const titleR = tA.r + (tB.r - tA.r) * tf;
    const titleH = tA.h + (tB.h - tA.h) * tf;
    const yaw = world.cameraYaw;
    // Round 7 (packet 3) — TOP-DOWN CAMERA: a steep high view with
    // north up, following the player or the car. The eye sits
    // camTopHeight above the target and a little south, so the lookAt
    // math never degenerates; the chase camera below is untouched.
    if (world.settings.camMode === 'top' && !onTitle) {
      return {
        eye: [cx, CONFIG.camTopHeight, cz + CONFIG.camTopTilt],
        target: [cx, 0, cz],
        aim: false,
        fov: CONFIG.camTopFov,
      };
    }
    // Round 5 chase camera: while driving the camera pulls back and
    // rises a little with speed, and the FOV widens, so the drive feels
    // fast; on foot it stays close and steady.
    const speed = car ? Math.abs(car.speed) : 0;
    const dist = onTitle ? titleR : (car
      ? 11 + Math.min(2.5, speed * CONFIG.camDistSpeed)
      : (input.aim ? 5.5 : 9.5));
    const height = (onTitle ? titleH : (car ? 4.2 + Math.min(0.6, speed * CONFIG.camHeightSpeed) : 3.2)) + world.cameraPitch * 6;
    const eye = [
      cx - Math.sin(yaw) * dist,
      height + (p.y || 0),
      cz - Math.cos(yaw) * dist,
    ];
    const target = [cx + Math.sin(yaw) * 2, 1.6 + (p.y || 0), cz + Math.cos(yaw) * 2];
    // Round 6 — camera shake: while world.shake is up (a shot was
    // just fired) the eye jitters a little, so the gun feels like it
    // kicks. The shake decays in world.update, so it never lingers.
    if (world.shake > 0) {
      const s = world.shake * 0.55;
      eye[0] += (Math.random() - 0.5) * s;
      eye[1] += (Math.random() - 0.5) * s * 0.6;
      eye[2] += (Math.random() - 0.5) * s;
    }
    return {
      eye, target, aim: input.aim,
      fov: car ? Math.min(CONFIG.camFovMax, CONFIG.camFovBase + speed * CONFIG.camFovSpeed) : undefined,
    };
  }

  // ------------------------------------------------------------ loop
  function frame(now) {
    requestAnimationFrame(frame);
    // Round 7: dt is clamped to [0, 0.05] — the rAF timestamp can
    // arrive EARLIER than `last` (headless clocks disagree on the
    // first frames after load), and a negative dt used to drive
    // world.time below zero, which made the title camera's stop
    // index -1 and threw in cameraFor every frame until the clock
    // recovered (caught by the round-7 playtest: 3 page errors).
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    // Round 5: the old code consumed the look deltas here and wrote
    // them straight back into the input, so update() applied the same
    // delta every frame — one drag spun the camera forever and the
    // character could never walk straight. Now the world consumes each
    // delta once (see world.js); this frame only notes when the player
    // last looked by hand, so the chase camera knows when to leave the
    // view alone.
    if (input.lookDX || input.lookDY) lastManualLookMs = now;
    document.body.classList.toggle('touch-playing', touchMode && world.screen === 'playing');
    // Round 7: the in-car buttons (REM, LAMPU) only show while Rico
    // is driving; the LARI toggle only shows on foot (see index.html).
    document.body.classList.toggle('in-car', touchMode && world.screen === 'playing' && world.player.inCar !== null);
    if (world.screen !== 'playing') {
      // Drop one-shot actions pressed on a menu so they do not fire later.
      input.enterCar = false; input.interact = false; input.reload = false; input.jump = false;
      input.cycleWeapon = false; input.missionTap = false;
      input.actionA = false; input.actionB = false; input.horn = false;
      input.cameraToggle = false; input.lightsToggle = false;
      input.lookDX = 0; input.lookDY = 0;
      // Silence the engine hum while paused or on the map (audio was
      // already unlocked by then, so this cannot create a context early).
      if (world.screen === 'paused' || world.screen === 'map') audio.engine(0);
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
      const prevInCar = world.player.inCar;
      const tappedWeapon = input.cycleWeapon;
      const tappedMission = input.missionTap;
      update(world, input, dt);
      // Round 7: UI toggles owned by main.js — camera mode and
      // headlights (the world consumes A/B and the horn itself).
      if (input.cameraToggle) { input.cameraToggle = false; toggleCamera(); }
      if (input.lightsToggle) { input.lightsToggle = false; toggleLights(); }
      // Round 7: the horn note plays on the RISING edge of the horn
      // timer — once per honk, not once per frame.
      if (world.hornTimer > 0 && prevHornTimer <= 0) audio.horn();
      prevHornTimer = world.hornTimer;
      // Every SENJATA / MISI tap answers with a sound, even when the
      // world had nothing to change — a tap must never feel dead.
      if (tappedWeapon) audio.ui();
      else if (world.player.weapon !== prevWeapon) audio.click();
      if (tappedMission) audio.ui();
      if (world.player.weapon !== prevWeapon) {
        const hw = $('hud-weapon');
        hw.classList.add('flash');
        setTimeout(() => hw.classList.remove('flash'), 300);
      }
      if (world.player.inCar !== prevInCar) audio.click();
      if (world.player.ammo[world.player.weapon] < prevAmmo) audio.shot(world.player.weapon);
      // Chase camera: swing behind the car once the player has not
      // looked around by hand for a beat — the GTA view that keeps
      // "forward" on screen while driving.
      // Round 6: the beat is now CONFIG.camLookGraceMs (5 s), and the
      // camera only re-engages while the car is actually moving — the
      // old 1.2 s snap-back is what made a full 360° look impossible
      // while driving, because every drag was yanked back to the car's
      // heading before the player could finish turning around.
      const carNow = playerCar(world);
      // Round 7: the chase camera follows the car's heading; the
      // top-down camera keeps north up and never follows.
      if (carNow && world.settings.camMode === 'chase' && now - lastManualLookMs > CONFIG.camLookGraceMs && Math.abs(carNow.speed) > 3) {
        world.cameraYaw = angleLerp(world.cameraYaw, carNow.angle, 1 - Math.exp(-CONFIG.camFollow * dt));
      }
      // Engine hum follows the car's speed; silent on foot.
      audio.engine(carNow ? Math.min(1, Math.abs(carNow.speed) / CONFIG.carMaxSpeed) : 0);
      if (world.screen === 'missionComplete') { showScreen('mission'); audio.mission(); }
      if (world.screen === 'busted') showScreen('busted');
      if (world.screen === 'wasted') showScreen('wasted');
      if (world.screen === 'complete') showScreen('complete');
      updateHUD();
    } else if (world.screen === 'title') {
      // Round 6 (packet 12) — the LIVING title screen: traffic rolls,
      // pedestrians stroll and the palms sway behind the menu, and the
      // camera orbits the intersection slowly. Cheap on purpose: the
      // backdrop update moves cars + peds only (no police, missions
      // or collisions), and the sway is one shader uniform.
      updateTitleBackdrop(world, dt);
      world.cameraYaw += dt * 0.05;
    }
    if (world.screen === 'playing' || world.screen === 'title' || world.screen === 'paused' || world.screen === 'map') {
      renderer.render(world, cameraFor());
      if (!window.__shotReady) window.__shotReady = true;
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

// Round 7 complete (2026-11-19): 17 packages — cinematic menu sweep,
// Halcyon A/B controls (E = A, F = B), top-down camera (C), full
// day/night cycle, 3 radio stations (N), horn + headlights (H / L),
// district building types, roof details, landmark skyline, road
// markings + correct zebra, sidewalks, street props, parks, blob
// shadows, fog + sky per phase, varied NPCs, officer in police cars.
