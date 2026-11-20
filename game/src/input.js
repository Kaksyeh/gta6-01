// SOLMAR — input.js: keyboard + mouse state, polled once a frame. Keys are tracked by
// code (KeyW, ArrowUp, ...) so layouts do not matter. The mouse is tracked in screen
// space and converted to world space by main.js through the camera.

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, rightDown: false };

  function onKeyDown(e) {
    if (!e.repeat) {
      keys.add(e.code);
      justPressed.add(e.code);
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
    if (e.button === 2) mouse.rightDown = true;
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rightDown = false;
  }
  function onContextMenu(e) {
    e.preventDefault();
  }
  function onBlur() {
    keys.clear();
    mouse.down = false;
    mouse.rightDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('blur', onBlur);

  return {
    keys,
    mouse,
    // True while any of the given codes is held.
    held(codes) {
      for (const c of codes) if (keys.has(c)) return true;
      return false;
    },
    // True only on the frame the key went down.
    pressed(code) {
      return justPressed.has(code);
    },
    // True if any of the given codes was pressed this frame.
    pressedAny(codes) {
      for (const c of codes) if (justPressed.has(c)) return true;
      return false;
    },
    // Called by main.js at the end of each frame.
    endFrame() {
      justPressed.clear();
      mouse.clicked = false;
    },
  };
}
