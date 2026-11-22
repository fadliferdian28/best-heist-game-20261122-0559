// world.js — the museum itself: level layouts, walls, doors, vents, loot,
// exits, and the geometry helpers (circle-vs-wall, line-of-sight) every
// other system uses. Three heists, three floors, several routes each.
import { PLAY, LEVELS } from './config.js';

// A wall is {x,y,w,h, kind} — kind: 'wall' | 'case' (display case, blocks
// movement + sight) | 'pillar' (blocks movement + sight) | 'rope' (blocks
// movement only, low velvet rope — you can see over it).
function wall(x, y, w, h, kind = 'wall') { return { x, y, w, h, kind }; }
function border() {
  return [
    wall(PLAY.x, PLAY.y, PLAY.w, 14), wall(PLAY.x, PLAY.h - 14, PLAY.w, 14),
    wall(PLAY.x, PLAY.y, 14, PLAY.h), wall(PLAY.w - 14, PLAY.y, 14, PLAY.h),
  ];
}
// A locked door is a wall segment that a lockpick can open (slow, silent).
function lockedDoor(x, y, w, h) { return { x, y, w, h, kind: 'door', locked: true, open: false }; }

export function buildLevel(index) {
  const L = LEVELS[index];
  const walls = [...border()];
  let guards = [], cameras = [], lasers = [], vents = [];
  let loot, exit, start; let lockdown = 0;
  if (index === 0) {
    // THE GALLERY — open hall, pillars to hide behind, cases down the middle.
    walls.push(
      wall(300, 150, 26, 220, 'pillar'), wall(300, 470, 26, 140, 'pillar'),
      wall(620, 120, 26, 200, 'pillar'), wall(620, 430, 26, 170, 'pillar'),
      wall(430, 330, 150, 22, 'case'), wall(760, 520, 130, 22, 'case'),
      wall(180, 560, 180, 22, 'case'), wall(830, 180, 120, 22, 'case'),
      wall(470, 80, 200, 16, 'rope'), wall(470, 620, 200, 16, 'rope'),
    );
    loot = { x: 905, y: 95, name: L.loot, value: L.lootValue, taken: false };
    exit = { x: 60, y: 640, w: 90, h: 46, label: 'SERVICE EXIT' };
    start = { x: 70, y: 90 };
    guards = [
      { x: 250, y: 300, waypoints: [[250, 300], [250, 560], [520, 560], [520, 300]], speed: 62 },
      { x: 700, y: 250, waypoints: [[700, 250], [700, 480], [900, 480], [900, 250]], speed: 62 },
      { x: 480, y: 120, waypoints: [[480, 120], [480, 620], [560, 620], [560, 120]], speed: 55 },
    ];
    cameras = [{ x: 505, y: 30, base: Math.PI / 2, sweep: 1.1 }];
    lasers = [{ x1: 330, y1: 360, x2: 990, y2: 360, period: 3.2, phase: 0 }];
    vents = [{ x: 40, y: 330, w: 60, h: 40, label: 'VENT' }, { x: 920, y: 330, w: 60, h: 40, label: 'VENT' }];
  } else if (index === 1) {
    // THE VAULT FLOOR — tighter corridors, a locked vault door, heavier patrols.
    walls.push(
      wall(240, 14, 22, 260, 'wall'), wall(240, 400, 22, 306, 'wall'),
      wall(560, 14, 22, 200, 'wall'), wall(560, 340, 22, 366, 'wall'),
      wall(760, 14, 22, 260, 'wall'), wall(760, 430, 22, 276, 'wall'),
      wall(380, 300, 180, 22, 'case'), wall(620, 520, 160, 22, 'case'),
      wall(420, 120, 26, 130, 'pillar'), wall(660, 420, 26, 130, 'pillar'),
      lockedDoor(560, 214, 22, 126),
    );
    loot = { x: 930, y: 120, name: L.loot, value: L.lootValue, taken: false };
    exit = { x: 60, y: 640, w: 90, h: 46, label: 'SERVICE EXIT' };
    start = { x: 70, y: 90 };
    guards = [
      { x: 140, y: 350, waypoints: [[140, 350], [140, 620], [200, 620], [200, 350]], speed: 66 },
      { x: 400, y: 100, waypoints: [[400, 100], [400, 620], [520, 620], [520, 100]], speed: 66 },
      { x: 660, y: 120, waypoints: [[660, 120], [660, 620], [720, 620], [720, 120]], speed: 70 },
      { x: 880, y: 350, waypoints: [[880, 350], [880, 620], [960, 620], [960, 350]], speed: 66 },
    ];
    cameras = [
      { x: 262, y: 30, base: Math.PI / 2, sweep: 0.9 },
      { x: 782, y: 30, base: Math.PI / 2, sweep: 1.2 },
    ];
    lasers = [
      { x1: 262, y1: 340, x2: 560, y2: 340, period: 2.6, phase: 0 },
      { x1: 582, y1: 480, x2: 1000, y2: 480, period: 3.4, phase: 1.2 },
    ];
    vents = [{ x: 40, y: 300, w: 60, h: 40, label: 'VENT' }, { x: 900, y: 640, w: 60, h: 40, label: 'VENT' }];
  } else {
    // THE ROOFTOP GETAWAY — open roof, skylight shaft, lockdown after the grab.
    walls.push(
      wall(280, 120, 26, 180, 'pillar'), wall(280, 450, 26, 140, 'pillar'),
      wall(640, 120, 26, 180, 'pillar'), wall(640, 450, 26, 140, 'pillar'),
      wall(440, 300, 140, 22, 'case'), wall(120, 520, 150, 22, 'case'),
      wall(780, 520, 150, 22, 'case'), wall(440, 90, 140, 16, 'rope'),
      lockedDoor(470, 340, 110, 18),
    );
    loot = { x: 505, y: 200, name: L.loot, value: L.lootValue, taken: false };
    exit = { x: 830, y: 640, w: 150, h: 46, label: 'GETAWAY VAN' };
    start = { x: 70, y: 90 };
    lockdown = LEVELS[2].time;
    guards = [
      { x: 200, y: 300, waypoints: [[200, 300], [200, 600], [340, 600], [340, 300]], speed: 72 },
      { x: 560, y: 100, waypoints: [[560, 100], [560, 620], [700, 620], [700, 100]], speed: 72 },
      { x: 880, y: 200, waypoints: [[880, 200], [880, 560], [960, 560], [960, 200]], speed: 72 },
      { x: 430, y: 480, waypoints: [[430, 480], [430, 640], [600, 640], [600, 480]], speed: 66 },
    ];
    cameras = [
      { x: 505, y: 30, base: Math.PI / 2, sweep: 1.3 },
      { x: 950, y: 30, base: Math.PI * 0.75, sweep: 1.0 },
    ];
    lasers = [
      { x1: 300, y1: 400, x2: 990, y2: 400, period: 2.4, phase: 0 },
      { x1: 120, y1: 250, x2: 640, y2: 250, period: 3.0, phase: 0.8 },
    ];
    vents = [{ x: 40, y: 620, w: 60, h: 40, label: 'SKYLIGHT' }, { x: 920, y: 90, w: 60, h: 40, label: 'SKYLIGHT' }];
  }
  return { index, name: L.name, lootName: L.loot, lootValue: L.lootValue, walls, guards, cameras, lasers, vents, loot, exit, start, lockdown };
}

// --- geometry helpers -------------------------------------------------------
export function circleHitsWall(x, y, r, walls) {
  for (const w of walls) {
    if (w.kind === 'door' && w.open) continue;
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return w;
  }
  return null;
}
export function moveCircle(pos, dx, dy, r, walls) {
  if (!circleHitsWall(pos.x + dx, pos.y, r, walls)) pos.x += dx;
  if (!circleHitsWall(pos.x, pos.y + dy, r, walls)) pos.y += dy;
}
function segHitsRect(x1, y1, x2, y2, w) {
  // Sample the segment every few pixels: robust, cheap, no slab edge cases.
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(len / 5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
    if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) return true;
  }
  return false;
}
// Sight-blocking walls: solid walls, cases, pillars, closed doors. Ropes don't block sight.
export function hasLineOfSight(x1, y1, x2, y2, walls) {
  for (const w of walls) {
    if (w.kind === 'rope') continue;
    if (w.kind === 'door' && w.open) continue;
    if (segHitsRect(x1, y1, x2, y2, w)) return false;
  }
  return true;
}
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
