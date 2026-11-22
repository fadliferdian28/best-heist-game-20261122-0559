// thief.js — the player: movement (walk / sneak / sprint), noise, loot grabs,
// lockpicking, and the three tools, each bought with loot points.
import { THIEF, TOOLS } from './config.js';
import { moveCircle, dist } from './world.js';

export function makeThief(start) {
  return {
    x: start.x, y: start.y, px: start.x, py: start.y,
    sneaking: false, sprinting: false, noise: 0, facing: 0,
    tools: { smoke: 1, emp: 1, lockpick: 2 }, selected: 'smoke',
    spent: 0, loot: 0, lootTaken: 0, spotted: false,
    channel: null, // {kind:'loot'|'door', t, need, target}
    smokeCloud: null, empT: 0, stepT: 0,
  };
}

export function updateThief(t, dt, input, walls, level, hooks) {
  t.px = t.x; t.py = t.y;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx || my) {
    const len = Math.hypot(mx, my); mx /= len; my /= len;
    t.facing = Math.atan2(my, mx);
  }
  t.sneaking = !!input.sneak;
  t.sprinting = !!input.sprint && !t.sneaking;
  const speed = t.sneaking ? THIEF.sneak : t.sprinting ? THIEF.sprint : THIEF.walk;
  t.noise = (mx || my)
    ? (t.sneaking ? THIEF.noiseSneak : t.sprinting ? THIEF.noiseSprint : THIEF.noiseWalk)
    : 0;
  if (t.channel) {
    // Channeling (grabbing loot / picking a lock) roots you in place.
    t.channel.t += dt;
    if (t.channel.t >= t.channel.need) {
      const done = t.channel; t.channel = null;
      if (done.kind === 'loot') hooks.onLoot?.(done.target);
      else if (done.kind === 'door') hooks.onDoor?.(done.target);
    }
    return;
  }
  moveCircle(t, mx * speed * dt, my * speed * dt, THIEF.radius, walls);
  // Footstep ticks for the audio layer.
  if ((mx || my) && (t.stepT -= dt) <= 0) {
    t.stepT = t.sneaking ? 0.55 : t.sprinting ? 0.28 : 0.4;
    hooks.onStep?.(t.sneaking, t.sprinting);
  }
  if (t.empT > 0) t.empT -= dt;
  if (t.smokeCloud) { t.smokeCloud.t -= dt; if (t.smokeCloud.t <= 0) t.smokeCloud = null; }
}

// Start a grab / lockpick channel when the player presses E near something.
export function tryInteract(t, level) {
  if (t.channel) return 'busy';
  const loot = level.loot;
  if (!loot.taken && dist(t.x, t.y, loot.x, loot.y) < 46) {
    t.channel = { kind: 'loot', t: 0, need: 1.0, target: loot };
    return 'loot';
  }
  for (const w of level.walls) {
    if (w.kind === 'door' && w.locked && !w.open) {
      const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
      if (dist(t.x, t.y, cx, cy) < 70) {
        if (t.tools.lockpick <= 0) return 'nolockpick';
        t.channel = { kind: 'door', t: 0, need: 2.2, target: w };
        return 'door';
      }
    }
  }
  return 'nothing';
}

// Use the selected tool. Returns a message for the HUD toast.
export function useTool(t, level) {
  const key = t.selected;
  if (key === 'smoke') {
    if (t.tools.smoke <= 0) return 'No smoke bombs left';
    t.tools.smoke -= 1; t.spent += TOOLS.smoke.cost;
    t.smokeCloud = { x: t.x, y: t.y, r: 110, t: 5 };
    return 'Smoke bomb — sight broken for 5s (−150)';
  }
  if (key === 'emp') {
    if (t.tools.emp <= 0) return 'No EMP charges left';
    t.tools.emp -= 1; t.spent += TOOLS.emp.cost;
    t.empT = 6;
    for (const c of level.cameras) c.disabledT = 6;
    return 'EMP — cameras + lasers dead 6s (−200)';
  }
  if (key === 'lockpick') return 'Lockpick: press E at a locked door';
  return '';
}
export function score(t, ghostBonus) {
  return t.loot - t.spent + (ghostBonus ? 500 : 0);
}
