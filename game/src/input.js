// Keyboard and mouse state. Keys are tracked by code (KeyW, KeyE, ...)
// so layouts do not matter. The mouse position is kept in screen pixels
// and converted to world coordinates by the caller.
export function createInput(canvas) {
  const input = {
    keys: {},
    pressed: {},
    // Injected keys: the screenshot staging holds W down for the chase shot.
    inject: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    anyKey: false,
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.endFrame = () => {
    input.pressed = {};
    input.mousePressed = false;
    input.anyKey = false;
  };
  input.isDown = (code) => !!input.keys[code] || !!input.inject[code];
  input.wasPressed = (code) => !!input.pressed[code];
  return input;
}
