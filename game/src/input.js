// Keyboard and mouse input for Solano City. Held keys give movement
// and driving; single presses are edges the main loop consumes once.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    held.delete(e.code);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    // The movement snapshot the world steps on.
    move() {
      return {
        up: held.has('KeyW') || held.has('ArrowUp'),
        down: held.has('KeyS') || held.has('ArrowDown'),
        left: held.has('KeyA') || held.has('ArrowLeft'),
        right: held.has('KeyD') || held.has('ArrowRight'),
        run: held.has('ShiftLeft') || held.has('ShiftRight'),
      };
    },
    // True once for the frame the key went down.
    take(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    takeClick() {
      if (!mouse.clicked) return false;
      mouse.clicked = false;
      return true;
    },
    // Drop edges that were never consumed, once a frame.
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
