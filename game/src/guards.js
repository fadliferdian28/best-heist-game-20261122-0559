// guards.js — patrols, vision cones, suspicion → alert → search → recovery.
// A guard's cone is raycast-occluded by walls: the cone polygon is built by
// casting rays around the facing direction and stopping each at the first wall.
import { GUARD, ALARM } from './config.js';
import { hasLineOfSight, dist, angleTo, angDiff, moveCircle } from './world.js';

export const STATE_PATROL = 'patrol';
export const STATE_SUSPICIOUS = 'suspicious';
export const STATE_ALERT = 'alert';
export const STATE_SEARCH = 'search';

export function makeGuard(def) {
  return {
    x: def.x, y: def.y, waypoints: def.waypoints, wp: 0, speed: def.speed || GUARD.patrol,
    angle: 0, state: STATE_PATROL, suspicion: 0, lastSeen: null, searchT: 0,
    pauseT: 0, heard: null, flash: 0,
  };
}

// Cast one vision ray: march out until a wall blocks it, return the hit point.
export function castRay(x, y, angle, maxDist, walls) {
  const step = 8;
  for (let d = step; d <= maxDist; d += step) {
    const px = x + Math.cos(angle) * d, py = y + Math.sin(angle) * d;
    for (const w of walls) {
      if (w.kind === 'rope') continue;
      if (w.kind === 'door' && w.open) continue;
      if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) return { x: px, y: py };
    }
  }
  return { x: x + Math.cos(angle) * maxDist, y: y + Math.sin(angle) * maxDist };
}

// The cone polygon: the guard plus ray endpoints fanning across the view arc.
export function visionCone(g, walls) {
  const pts = [{ x: g.x, y: g.y }];
  const rays = 14;
  for (let i = 0; i <= rays; i++) {
    const a = g.angle - GUARD.viewHalf + (2 * GUARD.viewHalf * i) / rays;
    pts.push(castRay(g.x, g.y, a, GUARD.viewRange, walls));
  }
  return pts;
}

// Can this guard see the thief right now? Returns 0..1 visibility.
export function guardSees(g, thief, walls, smoke) {
  const d = dist(g.x, g.y, thief.x, thief.y);
  if (d > GUARD.viewRange) return 0;
  if (Math.abs(angDiff(angleTo(g.x, g.y, thief.x, thief.y), g.angle)) > GUARD.viewHalf) return 0;
  if (!hasLineOfSight(g.x, g.y, thief.x, thief.y, walls)) return 0;
  if (smoke && dist(thief.x, thief.y, smoke.x, smoke.y) < smoke.r) return 0;
  const near = 1 - d / GUARD.viewRange; // closer = spotted faster
  return 0.35 + 0.65 * near;
}

export function updateGuard(g, dt, ctx) {
  const { thief, walls, smoke, alarm } = ctx;
  if (g.flash > 0) g.flash -= dt;
  const seen = guardSees(g, thief, walls, smoke);
  const sneaking = thief.sneaking;
  if (seen > 0) {
    const rate = seen * (sneaking ? 0.55 : 1) * 1.6;
    g.suspicion = Math.min(1, g.suspicion + rate * dt);
    g.lastSeen = { x: thief.x, y: thief.y };
    if (g.suspicion >= 1 && g.state !== STATE_ALERT) {
      g.state = STATE_ALERT; alarm.value = Math.min(100, alarm.value + 18); ctx.onSpotted?.();
    } else if (g.suspicion > 0.35 && g.state === STATE_PATROL) {
      g.state = STATE_SUSPICIOUS;
    }
  } else if (g.state === STATE_SUSPICIOUS) {
    g.suspicion = Math.max(0, g.suspicion - 0.25 * dt);
    if (g.suspicion <= 0) g.state = STATE_PATROL;
  }
  // Noise: sprinting / running close by draws a guard to investigate.
  if (thief.noise > 0 && dist(g.x, g.y, thief.x, thief.y) < thief.noise && g.state === STATE_PATROL) {
    g.heard = { x: thief.x, y: thief.y };
    g.state = STATE_SUSPICIOUS; g.suspicion = Math.max(g.suspicion, 0.5);
  }
  // Movement by state.
  if (g.state === STATE_ALERT && g.lastSeen) {
    const a = angleTo(g.x, g.y, g.lastSeen.x, g.lastSeen.y);
    g.angle = turnToward(g.angle, a, 6 * dt);
    moveCircle(g, Math.cos(g.angle) * GUARD.chase * dt, Math.sin(g.angle) * GUARD.chase * dt, GUARD.radius, walls);
    if (dist(g.x, g.y, thief.x, thief.y) < GUARD.catchRange && guardSees(g, thief, walls, smoke) > 0) ctx.onCaught?.(g);
    if (seen === 0) {
      g.searchT += dt;
      if (g.searchT > 2.5) { g.state = STATE_SEARCH; g.searchT = 0; }
    } else g.searchT = 0;
  } else if (g.state === STATE_SEARCH) {
    const target = g.heard || g.lastSeen;
    if (target) {
      const a = angleTo(g.x, g.y, target.x, target.y);
      g.angle = turnToward(g.angle, a, 4 * dt);
      if (dist(g.x, g.y, target.x, target.y) > 30) {
        moveCircle(g, Math.cos(g.angle) * GUARD.search * dt, Math.sin(g.angle) * GUARD.search * dt, GUARD.radius, walls);
      } else {
        g.angle += 1.2 * dt; g.searchT += dt;
        if (g.searchT > 4) { g.state = STATE_PATROL; g.suspicion = 0; g.heard = null; g.searchT = 0; }
      }
    } else g.state = STATE_PATROL;
  } else if (g.state === STATE_SUSPICIOUS) {
    const target = g.heard || g.lastSeen;
    if (target) g.angle = turnToward(g.angle, angleTo(g.x, g.y, target.x, target.y), 3 * dt);
    if (g.suspicion <= 0) g.state = STATE_PATROL;
  } else {
    // Patrol: walk waypoints, pause briefly at each one and look around.
    if (g.pauseT > 0) { g.pauseT -= dt; g.angle += 0.9 * dt; return; }
    const wp = g.waypoints[g.wp];
    const a = angleTo(g.x, g.y, wp[0], wp[1]);
    g.angle = turnToward(g.angle, a, 5 * dt);
    moveCircle(g, Math.cos(g.angle) * g.speed * dt, Math.sin(g.angle) * g.speed * dt, GUARD.radius, walls);
    if (dist(g.x, g.y, wp[0], wp[1]) < 14) { g.wp = (g.wp + 1) % g.waypoints.length; g.pauseT = 0.8; }
  }
}

function turnToward(a, target, maxStep) {
  const d = angDiff(target, a);
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}
