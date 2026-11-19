// Kota Seja — keyboard, mouse and touch input.
// One object holds the whole control state; the world update reads it
// every frame. Pointer lock gives the mouse-look its deltas, and the
// canvas click re-locks when the browser drops it.
// Round 5 (2026-11-19): the game shipped with NO touch controls at all —
// on a phone nothing but tap-to-shoot worked. This file now also owns
// the touch layer: a virtual joystick, look-drag on the canvas, and the
// SENJATA / MISI / MOBIL / TEMBAK / REM buttons wired in index.html.
// Round 7 (2026-11-19) — HALCYON CONTROLS: the two big touch buttons
// are now contextual A and B (E / F on the keyboard). A does whatever
// the situation calls for (MASUK / KELUAR / AMBIL / MULAI / SERANG —
// see computeContext in world.js); B shoots on foot and honks in a
// car. The old MOBIL button is gone (A replaces it), TEMBAK is B,
// LARI + JALAN collapsed into one LARI toggle, and MUSIK became
// STASIUN (cycle the 3 radio stations). H = horn, C = camera mode,
// L = headlights.
export function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
}

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    forward: false, back: false, left: false, right: false,
    run: false, jump: false, interact: false, enterCar: false,
    shoot: false, shootPulse: false, aim: false, reload: false, weaponSlot: 0,
    lookDX: 0, lookDY: 0,
    mouseX: 0, mouseY: 0,
    locked: false,
    // Touch state (round 5): analog stick, action one-shots, handbrake.
    joyX: 0, joyY: 0, steer: 0, throttle: 0, handbrake: false,
    cycleWeapon: false, missionTap: false,
    // Round 6: walk/run mode from the LARI / JALAN HUD buttons.
    // 'walk' = normal speed, 'run' = SHIFT speed without holding SHIFT.
    // Round 7: the two buttons collapsed into ONE LARI toggle — the
    // mode flag is unchanged, only the button is single now.
    moveMode: 'walk',
    // Round 7 — Halcyon one-shots: A (context action), B (shoot /
    // horn), H (horn), C (camera mode), L (headlights). Sticky until
    // the game loop (or main.js, for the UI toggles) consumes them.
    // bHeld is NOT sticky: it is true only while the B button (or
    // the mouse) is physically held down.
    actionA: false, actionB: false, horn: false,
    cameraToggle: false, lightsToggle: false, bHeld: false,
  };
  let jumpQueued = false;
  let interactQueued = false;
  let enterQueued = false;
  let reloadQueued = false;
  // Round 7: the Halcyon one-shot queues (E/F/H/C/L).
  let actionAQueued = false;
  let actionBQueued = false;
  let hornQueued = false;
  let cameraToggleQueued = false;
  let lightsToggleQueued = false;

  function refresh() {
    // The joystick feeds the same movement flags as the keys, so on foot
    // and in the car the world reads one set of directions.
    input.forward = keys.has('KeyW') || keys.has('ArrowUp') || input.joyY < -0.25;
    input.back = keys.has('KeyS') || keys.has('ArrowDown') || input.joyY > 0.25;
    input.left = keys.has('KeyA') || keys.has('ArrowLeft') || input.joyX < -0.25;
    input.right = keys.has('KeyD') || keys.has('ArrowRight') || input.joyX > 0.25;
    // Round 6: LARI mode runs without holding SHIFT; SHIFT still runs
    // even in JALAN mode, so desktop behaviour is unchanged.
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || input.moveMode === 'run';
    // One-shot actions are sticky until the game loop consumes them:
    // a fast key press (down + up between two frames) must not be lost.
    input.jump = input.jump || jumpQueued;
    input.interact = input.interact || interactQueued;
    input.enterCar = input.enterCar || enterQueued;
    input.reload = input.reload || reloadQueued;
    // Round 7: Halcyon one-shots, same sticky rule.
    input.actionA = input.actionA || actionAQueued;
    input.actionB = input.actionB || actionBQueued;
    input.horn = input.horn || hornQueued;
    input.cameraToggle = input.cameraToggle || cameraToggleQueued;
    input.lightsToggle = input.lightsToggle || lightsToggleQueued;
    jumpQueued = false;
    interactQueued = false;
    enterQueued = false;
    reloadQueued = false;
    actionAQueued = false;
    actionBQueued = false;
    hornQueued = false;
    cameraToggleQueued = false;
    lightsToggleQueued = false;
  }

  const KEY_ACTIONS = {
    // Round 7: E = A (context action: MASUK / KELUAR / AMBIL /
    // MULAI / SERANG), F = B (shoot on foot, horn in a car). The old
    // E = interact and F = enterCar mappings are retired — the
    // context button is the only way to enter/exit a car or start a
    // mission now, so there is no second button doing the same job.
    KeyE: () => { actionAQueued = true; },
    KeyF: () => { actionBQueued = true; },
    KeyR: () => { reloadQueued = true; },
    KeyH: () => { hornQueued = true; },
    KeyC: () => { cameraToggleQueued = true; },
    KeyL: () => { lightsToggleQueued = true; },
    Space: () => { jumpQueued = true; },
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
    const action = KEY_ACTIONS[e.code];
    if (action) action();
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 4) input.weaponSlot = n;
    }
    refresh();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    refresh();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    refresh();
  });

  canvas.addEventListener('mousedown', (e) => {
    // Touch taps reach here as a compatibility mousedown too — but on a
    // phone the TEMBAK button shoots, so a tap on the look area must
    // not also fire the gun (and a look-drag must not shoot at all).
    if (e.sourceCapabilities?.firesTouchEvents) return;
    // shootPulse is sticky until the game loop consumes it: a click that
    // lands between two slow frames must still fire one shot.
    if (e.button === 0) { input.shoot = true; input.shootPulse = true; }
    if (e.button === 2) input.aim = true;
    // Pointer lock is a desktop idea: on a phone it can only fail, and
    // a failed lock request spams the console on some browsers.
    if (!input.locked && !isTouchDevice()) canvas.requestPointerLock?.();
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.shoot = false;
    if (e.button === 2) input.aim = false;
  });
  window.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    if (document.pointerLockElement === canvas) {
      input.lookDX += e.movementX || 0;
      input.lookDY += e.movementY || 0;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch look: dragging a finger across the canvas turns the camera.
  // The deltas land in the same lookDX/lookDY the mouse uses, and the
  // world consumes them exactly once per frame (round 5 fixed the old
  // sticky-delta bug that spun the camera forever after one drag).
  let lookPointer = null;
  let lookLastX = 0, lookLastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || lookPointer !== null) return;
    lookPointer = e.pointerId;
    lookLastX = e.clientX; lookLastY = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookPointer) return;
    const dx = e.clientX - lookLastX;
    const dy = e.clientY - lookLastY;
    lookLastX = e.clientX; lookLastY = e.clientY;
    input.lookDX += dx;
    input.lookDY += dy;
  });
  const endLook = (e) => {
    if (e.pointerId === lookPointer) lookPointer = null;
  };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  // The world consumes the accumulated look deltas once per frame.
  input.consumeLook = () => {
    const dx = input.lookDX, dy = input.lookDY;
    input.lookDX = 0;
    input.lookDY = 0;
    return { dx, dy };
  };
  input.refresh = refresh;
  return input;
}

// ------------------------------------------------------------------ touch UI
// Wires the on-screen controls from index.html (#touch-ui) to the input
// object. Buttons answer on pointerdown (a tap must feel instant on a
// phone, not wait for a click), and every tap sets a flag the world
// consumes — so a tap always produces visible feedback, even when the
// action itself cannot run (locked weapon, mission far away).
// actions: { onMap, onPause, onMute, onStation, onCamera, onLights } —
// screen, audio and camera functions owned by main.js. (Round 7
// replaced onMusic with onStation, and added onCamera + onLights.)
export function attachTouch(input, actions) {
  const $ = (id) => document.getElementById(id);
  const stick = $('stick');
  const knob = $('stick-knob');
  if (!stick || !knob) return;

  // --- virtual joystick: push up to drive / walk forward, sideways to steer.
  const R = 44; // knob travel in px
  let stickPointer = null;
  let cx = 0, cy = 0;
  function setKnob(dx, dy) {
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  function applyStick(dx, dy) {
    const len = Math.hypot(dx, dy);
    const cl = len > R ? R / len : 1;
    const nx = dx * cl, ny = dy * cl;
    setKnob(nx, ny);
    input.joyX = nx / R;
    input.joyY = ny / R;
    // Round 6 — JOYSTICK STEERING FIX: the stick's X was fed straight
    // into car.steer, but the keyboard maps LEFT (A) to steer +1
    // (car.angle grows = the car turns left, see world.js driving).
    // So pushing the stick RIGHT (joyX +1) also steered LEFT — the
    // user saw the car turn the wrong way on a real phone. The fix is
    // a sign flip here, and ONLY here: on foot the stick still sets
    // input.left/right (joyX > 0 = strafe right), which was already
    // correct, and the keyboard path never touches input.steer.
    input.steer = -input.joyX;
    input.throttle = -input.joyY;
    input.refresh();
  }
  function releaseStick() {
    stickPointer = null;
    input.joyX = 0; input.joyY = 0;
    input.steer = 0; input.throttle = 0;
    input.refresh();
    setKnob(0, 0);
  }
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickPointer = e.pointerId;
    stick.setPointerCapture?.(e.pointerId);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    applyStick(e.clientX - cx, e.clientY - cy);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointer) return;
    e.preventDefault();
    applyStick(e.clientX - cx, e.clientY - cy);
  });
  const stickUp = (e) => { if (e.pointerId === stickPointer) releaseStick(); };
  stick.addEventListener('pointerup', stickUp);
  stick.addEventListener('pointercancel', stickUp);

  // --- buttons
  function tapButton(el, fn) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      fn();
      setTimeout(() => el.classList.remove('pressed'), 160);
    });
  }
  // Buttons that CHANGE THE SCREEN answer on 'click', not pointerdown:
  // on touch, the tap that opens a screen would otherwise land its
  // synthesized click on the newly opened screen — the tap that opened
  // the map closed it again at once, because the click hit the full
  // map's canvas (which sets a waypoint and resumes). The click fires
  // while the old screen is still up, so it targets the button itself.
  // (No preventDefault on pointerdown here: cancelling it would also
  // cancel the click this relies on.)
  function screenButton(el, fn) {
    if (!el) return;
    el.addEventListener('pointerdown', () => el.classList.add('pressed'));
    el.addEventListener('pointerup', () => el.classList.remove('pressed'));
    el.addEventListener('pointercancel', () => el.classList.remove('pressed'));
    el.addEventListener('click', (e) => {
      e.preventDefault();
      fn();
    });
  }
  function holdButton(el, onDown, onUp) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      onDown();
    });
    const release = () => { el.classList.remove('pressed'); onUp(); };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  // Round 7 — HALCYON A / B (the two BIG buttons, bottom right):
  // A = the context action (MASUK / KELUAR / AMBIL / MULAI / SERANG,
  // E on the keyboard). One tap, one action — the world decides what
  // A means from the situation (computeContext in world.js). The old
  // MOBIL button is gone: A is the only way in and out of a car.
  tapButton($('btn-touch-a'), () => { input.actionA = true; });
  // B = shoot on foot (HOLD, like the mouse button — the SMG keeps
  // firing while the finger is down), horn in a car (one tap, F on
  // the keyboard). The world reads input.actionB once and decides
  // which (see update()); input.bHeld tells it the finger is still
  // down, so a held B keeps firing and a tapped F fires once.
  holdButton($('btn-touch-b'),
    () => { input.actionB = true; input.bHeld = true; },
    () => { input.bHeld = false; input.shoot = false; });
  // REM: handbrake while held — sharp drift turns, strong decel.
  // (Only shown while driving; see the in-car CSS in index.html.)
  holdButton($('btn-touch-brake'),
    () => { input.handbrake = true; },
    () => { input.handbrake = false; });
  // SENJATA: cycle to the next OWNED weapon (locked slots are skipped,
  // so every tap visibly changes the weapon or says why it cannot).
  tapButton($('btn-touch-weapon'), () => { input.cycleWeapon = true; });
  // MISI: always answers — starts the mission near the hideout, or
  // shows the objective, the distance and a waypoint when far away.
  tapButton($('btn-touch-mission'), () => { input.missionTap = true; });
  // Round 7 — LARI is ONE toggle now (round 6 had two buttons):
  // tap to run, tap again to walk back. The active mode lights up
  // (class 'active'), so the player always sees which speed is on.
  // The joystick still steers the movement; this only picks speed.
  function setMoveMode(mode) {
    input.moveMode = mode;
    input.refresh();
    const runBtn = $('btn-touch-run');
    if (runBtn) {
      runBtn.classList.toggle('active', mode === 'run');
      runBtn.textContent = mode === 'run' ? 'LARI ●' : 'LARI';
    }
  }
  tapButton($('btn-touch-run'), () => setMoveMode(input.moveMode === 'run' ? 'walk' : 'run'));
  setMoveMode(input.moveMode || 'walk');
  // PETA / JEDA / SUARA: main.js owns the screens and the audio, so
  // these call straight in — on 'click', so the tap cannot fall through
  // onto the screen they open (see screenButton above).
  screenButton($('btn-touch-map'), () => actions.onMap());
  screenButton($('btn-touch-pause'), () => actions.onPause());
  screenButton($('btn-touch-mute'), () => actions.onMute());
  // Round 7 — STASIUN cycles the 3 radio stations (1→2→3→off→1),
  // KAMERA toggles chase / top-down, LAMPU cycles auto → on → off.
  // STASIUN and KAMERA live in the top column; LAMPU shares the
  // LARI slot and only shows while driving (in-car CSS).
  screenButton($('btn-touch-station'), () => actions.onStation && actions.onStation());
  screenButton($('btn-touch-camera'), () => actions.onCamera && actions.onCamera());
  screenButton($('btn-touch-light'), () => actions.onLights && actions.onLights());
}

// A blank input object for headless tests and for the title screen,
// where no keys are held.
export function blankInput() {
  return {
    forward: false, back: false, left: false, right: false,
    run: false, jump: false, interact: false, enterCar: false,
    shoot: false, shootPulse: false, aim: false, reload: false, weaponSlot: 0,
    lookDX: 0, lookDY: 0, locked: false,
    joyX: 0, joyY: 0, steer: 0, throttle: 0, handbrake: false,
    cycleWeapon: false, missionTap: false,
    // Round 6: walk/run HUD mode (LARI / JALAN), default JALAN.
    moveMode: 'walk',
    // Round 7: Halcyon one-shots (A / B / horn / camera / lights).
    actionA: false, actionB: false, horn: false,
    cameraToggle: false, lightsToggle: false, bHeld: false,
  };
}

// Round 7 complete (2026-11-19): Halcyon A/B controls (E = A, F = B,
// H = horn, C = camera, L = lights), one LARI toggle, STASIUN /
// KAMERA / LAMPU touch buttons; MOBIL, TEMBAK and JALAN retired.
