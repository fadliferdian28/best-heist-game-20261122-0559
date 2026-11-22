// cameras.js — sweeping security cameras and toggling tripwire laser grids.
// A camera's cone sweeps back and forth; a laser grid is ON for part of its
// period and OFF for the rest — cross while it is on and the alarm jumps.
import { CAMERA, ALARM } from './config.js';
import { hasLineOfSight, dist, angleTo, angDiff } from './world.js';
import { castRay } from './guards.js';

export function makeCamera(def) {
  return { x: def.x, y: def.y, base: def.base, sweep: def.sweep, t: Math.random() * 6, disabledT: 0, angle: def.base };
}
export function makeLaser(def) {
  return { x1: def.x1, y1: def.y1, x2: def.x2, y2: def.y2, period: def.period, phase: def.phase, on: true, t: def.phase };
}
export function cameraCone(cam, walls) {
  const pts = [{ x: cam.x, y: cam.y }];
  const rays = 10;
  for (let i = 0; i <= rays; i++) {
    const a = cam.angle - CAMERA.half + (2 * CAMERA.half * i) / rays;
    pts.push(castRay(cam.x, cam.y, a, CAMERA.range, walls));
  }
  return pts;
}
export function cameraSees(cam, thief, walls, smoke) {
  if (cam.disabledT > 0) return 0;
  const d = dist(cam.x, cam.y, thief.x, thief.y);
  if (d > CAMERA.range) return 0;
  if (Math.abs(angDiff(angleTo(cam.x, cam.y, thief.x, thief.y), cam.angle)) > CAMERA.half) return 0;
  if (!hasLineOfSight(cam.x, cam.y, thief.x, thief.y, walls)) return 0;
  if (smoke && dist(thief.x, thief.y, smoke.x, smoke.y) < smoke.r) return 0;
  return 0.5 + 0.5 * (1 - d / CAMERA.range);
}
export function updateCamera(cam, dt) {
  cam.t += dt;
  if (cam.disabledT > 0) cam.disabledT -= dt;
  cam.angle = cam.base + Math.sin(cam.t * CAMERA.sweep) * 0.85;
}
export function updateLaser(laser, dt) {
  laser.t += dt;
  laser.on = (laser.t % laser.period) < laser.period * 0.55;
}
// Did the thief cross the laser segment this frame? Segment-to-point distance.
export function laserTripped(laser, thief, prev) {
  if (!laser.on) return false;
  const d = segPointDist(laser.x1, laser.y1, laser.x2, laser.y2, thief.x, thief.y);
  const pd = segPointDist(laser.x1, laser.y1, laser.x2, laser.y2, prev.x, prev.y);
  return d < 16 && pd >= 16;
}
function segPointDist(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
