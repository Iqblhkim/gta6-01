// SOLANO CITY boot and main loop: input every frame, the world in fixed
// 1/60 s steps, the renderer on top, and the title / pause / busted /
// wasted screens between them. ?seed= picks the city, ?shot= stages one
// of the four screenshot scenes and freezes it for the camera.

import { createWorld } from './world.js';
import { STEP } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { render, computeCamera } from './render.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'solano-city-save-v1';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1) || 1;
const shot = params.get('shot');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const world = createWorld(seed);
const input = createInput(canvas);
const audio = createAudio();

let screen = 'title';
let lastMissionsDone = 0;
let sirenTimer = 0;
let saveTimer = 0;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.cash,
      missionsDone: world.state.missionsDone,
      index: world.state.mission.index,
    }));
  } catch {
    // A browser that refuses storage still plays fine.
  }
}

let save = loadSave();

function startNew() {
  world.reset();
  lastMissionsDone = 0;
  screen = 'play';
  audio.unlock();
  audio.startMusic();
}

function continueSave() {
  if (!save) return;
  world.reset();
  world.state.cash = save.cash;
  world.state.missionsDone = save.missionsDone;
  world.state.mission.index = Math.min(save.index, 3);
  lastMissionsDone = save.missionsDone;
  screen = 'play';
  audio.unlock();
  audio.startMusic();
}

function frame(now) {
  requestAnimationFrame(frame);
  // The world only advances while playing: pause freezes it.
  if (screen === 'play') {
    world.step(STEP, input.move());
  }
  handleKeys();
  if (screen === 'play') {
    handleMouse();
    afterStep(STEP);
  }
  render(ctx, world, screen, {
    w: canvas.width,
    h: canvas.height,
    saveExists: save !== null,
  });
  input.endFrame();
}

function handleKeys() {
  if (input.take('Space')) {
    audio.unlock();
    if (screen === 'title') startNew();
    else if (screen === 'busted' || screen === 'wasted') startNew();
  }
  if (input.take('KeyC') && screen === 'title' && save) continueSave();
  if (input.take('KeyP')) {
    if (screen === 'play') {
      screen = 'paused';
      audio.engine(0);
    } else if (screen === 'paused') {
      screen = 'play';
    }
  }
  if (input.take('KeyM')) audio.setMuted(!audio.muted);
  if (screen !== 'play') return;
  if (input.take('Enter')) {
    if (world.startMission()) audio.pickup();
  }
  if (input.take('KeyE')) {
    const p = world.state.player;
    if (p.onFoot) {
      if (world.enterCar()) audio.pickup();
    } else {
      world.exitCar();
    }
  }
  if (input.take('KeyR')) world.reload();
}

function handleMouse() {
  if (screen !== 'play') return;
  if (!input.mouse.down) return;
  const p = world.state.player;
  if (!p.onFoot) return;
  const cam = computeCamera(world, canvas.width, canvas.height);
  const wx = input.mouse.x + cam.x;
  const wy = input.mouse.y + cam.y;
  if (world.shoot(wx, wy)) {
    audio.unlock();
    audio.shoot();
  }
}

function afterStep(dt) {
  const s = world.state;
  if (screen === 'play') {
    if (s.status === 'busted') {
      screen = 'busted';
      audio.busted();
      audio.stopMusic();
      saveGame();
    } else if (s.status === 'wasted') {
      screen = 'wasted';
      audio.wasted();
      audio.stopMusic();
      saveGame();
    }
    if (s.missionsDone > lastMissionsDone) {
      lastMissionsDone = s.missionsDone;
      audio.complete();
      saveGame();
    }
    if (s.wanted > 0 && s.police.length > 0) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 4;
        audio.siren();
      }
    }
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      saveGame();
    }
    const car = s.player.onFoot ? null : world.playerCar();
    audio.engine(car ? Math.abs(car.speed) : 0);
  }
}

// Screenshot mode: stage the scene, warm it up, render one frame and
// tell the camera the shot is ready. No loop runs after that.
if (shot) {
  screen = applyShot(world, shot);
  const warm = shot === 'mission' ? 30 : shot === 'start' ? 0 : 90;
  const drive = shot === 'drive' || shot === 'chase' ? { up: true } : {};
  for (let i = 0; i < warm; i += 1) world.step(STEP, drive);
  render(ctx, world, screen, {
    w: canvas.width,
    h: canvas.height,
    saveExists: save !== null,
  });
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}

// The handle the play-tests and the screenshot tool drive the game by.
window.__solano = {
  screen: () => (screen === 'paused' ? 'paused' : screen),
  world,
};
