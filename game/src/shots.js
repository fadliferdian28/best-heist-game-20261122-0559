// shots.js — the four screenshot scenes behind ?shot=cover|patrol|tools|getaway.
// Each one stages a real mid-game state through the game's own systems
// (real levels, real guards with live vision cones, real alarm and HUD) and
// returns the screen to draw, so the frame is what play really looks like.
import { SCREEN_PLAY } from './render.js';
import { buildLevel } from './world.js';
import { makeGuard } from './guards.js';

// Shared staging: install a fresh level the same way loadLevel does, then pose it.
function applyLevel(game, def) {
  game.level = def;
  game.thief.x = def.start.x; game.thief.y = def.start.y;
  game.thief.px = def.start.x; game.thief.py = def.start.y;
  game.thief.loot = 0; game.thief.spent = 0; game.thief.channel = null;
  game.thief.smokeCloud = null; game.thief.empT = 0; game.thief.spotted = false;
  game.guards = def.guards.map(makeGuard);
  game.cameras = def.cameras.map((c) => ({ ...c, t: 1, disabledT: 0, angle: c.base }));
  game.lasers = def.lasers.map((l) => ({ ...l, on: true, t: l.phase }));
  game.alarm.value = 0; game.timeLeft = null; game.lives = 3;
  game.toastT = 999;
}
function placeGuard(g, x, y, angle, suspicion, state) {
  g.x = x; g.y = y; g.angle = angle; g.suspicion = suspicion; g.state = state || 'patrol';
  return g;
}
function stageCover(game) {
  // L1, criterion #1 in one frame: thief crossing the gallery, guards with
  // vision cones, a sweeping camera, the Star Sapphire glowing, alarm at 35%.
  applyLevel(game, buildLevel(0));
  const t = game.thief;
  t.x = 470; t.y = 380; t.facing = 0.3; t.sneaking = true;
  game.alarm.value = 35;
  placeGuard(game.guards[0], 250, 300, 1.2, 0.15, 'patrol');
  placeGuard(game.guards[1], 700, 420, -1.4, 0.55, 'suspicious');
  placeGuard(game.guards[2], 520, 180, 1.6, 0, 'patrol');
  game.cameras[0].angle = 1.1;
  game.toast = 'Sneak past the cones — grab the Star Sapphire';
  return SCREEN_PLAY;
}
function stagePatrol(game) {
  // L2 vault floor: four patrols, two cameras, thief sneaking behind a case.
  applyLevel(game, buildLevel(1));
  const t = game.thief;
  t.x = 330; t.y = 560; t.facing = -0.4; t.sneaking = true;
  game.alarm.value = 12;
  placeGuard(game.guards[0], 140, 420, 1.57, 0, 'patrol');
  placeGuard(game.guards[1], 430, 300, 0, 0.3, 'suspicious');
  placeGuard(game.guards[2], 660, 300, 1.57, 0, 'patrol');
  placeGuard(game.guards[3], 900, 480, -1.57, 0, 'patrol');
  game.cameras[0].angle = 1.4; game.cameras[1].angle = 0.9;
  game.toast = 'Patrols sweep the vault floor — read the cones';
  return SCREEN_PLAY;
}
function stageTools(game) {
  // L2 with the tools in action: smoke cloud up, EMP killing the cameras.
  applyLevel(game, buildLevel(1));
  const t = game.thief;
  t.x = 620; t.y = 380; t.facing = -1.2; t.selected = 'emp';
  t.smokeCloud = { x: 560, y: 340, r: 110, t: 4 };
  t.empT = 5;
  for (const c of game.cameras) c.disabledT = 5;
  game.alarm.value = 58;
  placeGuard(game.guards[1], 480, 260, 0.6, 0.8, 'suspicious');
  placeGuard(game.guards[2], 700, 300, 2.6, 0.4, 'suspicious');
  game.toast = 'EMP down — smoke up — tools cost loot, spend them well';
  return SCREEN_PLAY;
}
function stageGetaway(game) {
  // L3: Crown Jewels secured, lockdown counting down, thief sprinting for the van.
  applyLevel(game, buildLevel(2));
  const t = game.thief;
  game.level.loot.taken = true; t.loot = 3500; t.spent = 200;
  t.x = 780; t.y = 640; t.facing = 0; t.sprinting = true;
  game.timeLeft = 47;
  game.alarm.value = 72;
  placeGuard(game.guards[0], 300, 400, 0.8, 1, 'alert');
  placeGuard(game.guards[1], 620, 300, 1.9, 0.9, 'alert');
  placeGuard(game.guards[2], 880, 420, -1.2, 0.6, 'suspicious');
  game.cameras[0].angle = 1.5;
  game.toast = 'LOCKDOWN! Crown Jewels secured — reach the van!';
  return SCREEN_PLAY;
}
export function stageShot(name, game) {
  if (name === 'patrol') return stagePatrol(game);
  if (name === 'tools') return stageTools(game);
  if (name === 'getaway') return stageGetaway(game);
  return stageCover(game);
}
