// Kota Seja — keyboard and mouse input.
// One object holds the whole control state; the world update reads it
// every frame. Pointer lock gives the mouse-look its deltas, and the
// canvas click re-locks when the browser drops it.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    forward: false, back: false, left: false, right: false,
    run: false, jump: false, interact: false, enterCar: false,
    shoot: false, shootPulse: false, aim: false, reload: false, weaponSlot: 0,
    lookDX: 0, lookDY: 0,
    mouseX: 0, mouseY: 0,
    locked: false,
  };
  let jumpQueued = false;
  let interactQueued = false;
  let enterQueued = false;
  let reloadQueued = false;

  function refresh() {
    input.forward = keys.has('KeyW') || keys.has('ArrowUp');
    input.back = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    // One-shot actions are sticky until the game loop consumes them:
    // a fast key press (down + up between two frames) must not be lost.
    input.jump = input.jump || jumpQueued;
    input.interact = input.interact || interactQueued;
    input.enterCar = input.enterCar || enterQueued;
    input.reload = input.reload || reloadQueued;
    jumpQueued = false;
    interactQueued = false;
    enterQueued = false;
    reloadQueued = false;
  }

  const KEY_ACTIONS = {
    KeyE: () => { interactQueued = true; },
    KeyF: () => { enterQueued = true; },
    KeyR: () => { reloadQueued = true; },
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
    // shootPulse is sticky until the game loop consumes it: a click that
    // lands between two slow frames must still fire one shot.
    if (e.button === 0) { input.shoot = true; input.shootPulse = true; }
    if (e.button === 2) input.aim = true;
    if (!input.locked) canvas.requestPointerLock?.();
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

// A blank input object for headless tests and for the title screen,
// where no keys are held.
export function blankInput() {
  return {
    forward: false, back: false, left: false, right: false,
    run: false, jump: false, interact: false, enterCar: false,
    shoot: false, shootPulse: false, aim: false, reload: false, weaponSlot: 0,
    lookDX: 0, lookDY: 0, locked: false,
  };
}
