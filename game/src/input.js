// input.js — keyboard + mouse, one small job: turn raw events into a
// plain input state the simulation reads. WASD/arrows move, Shift sneak,
// Ctrl/Alt sprint, E interact, Space/click use tool, 1/2/3 select tool,
// Esc pause, M mute.
export function makeInput() {
  return {
    up: false, down: false, left: false, right: false,
    sneak: false, sprint: false, interact: false, useTool: false,
    select: null, pause: false, mute: false, click: null,
  };
}
export function bindInput(input, canvas, hooks) {
  const down = (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (k === 'w' || k === 'arrowup') input.up = true;
    if (k === 's' || k === 'arrowdown') input.down = true;
    if (k === 'a' || k === 'arrowleft') input.left = true;
    if (k === 'd' || k === 'arrowright') input.right = true;
    if (k === 'shift') input.sneak = true;
    if (k === 'control' || k === 'alt') input.sprint = true;
    if (k === 'e') input.interact = true;
    if (k === ' ') input.useTool = true;
    if (k === '1' || k === '2' || k === '3') input.select = k;
    if (k === 'escape') input.pause = true;
    if (k === 'm') input.mute = true;
    if (k === 'enter') hooks.onConfirm?.();
  };
  const up = (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') input.up = false;
    if (k === 's' || k === 'arrowdown') input.down = false;
    if (k === 'a' || k === 'arrowleft') input.left = false;
    if (k === 'd' || k === 'arrowright') input.right = false;
    if (k === 'shift') input.sneak = false;
    if (k === 'control' || k === 'alt') input.sprint = false;
    // NOTE: interact / useTool are edge-triggered and stay set until the
    // simulation consumes them — clearing them here on keyup would drop a
    // quick tap that lands between two animation frames.
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    input.click = { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    input.useTool = true;
  });
  window.addEventListener('blur', () => hooks.onBlur?.());
  document.addEventListener('visibilitychange', () => { if (document.hidden) hooks.onBlur?.(); });
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}
