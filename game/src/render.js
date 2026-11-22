// render.js — every pixel the player sees: the night museum (marble floor,
// velvet ropes, display cases, gold loot glow), raycast vision cones,
// sweeping camera cones, toggling lasers, smoke, and the right-side HUD
// (alarm meter, loot, tools, goal, controls). Screens: title / select /
// play / pause / caught / level-complete / win / game-over.
import { FIELD, PLAY, HUD, PALETTE, FONT, TOOLS, LEVELS } from './config.js';
import { visionCone } from './guards.js';
import { cameraCone } from './cameras.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_SELECT = 'select';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL = 'level';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function poly(ctx, pts, fill) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function text(ctx, s, x, y, size, color, align = 'left', weight = '') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

export function drawWorld(ctx, game) {
  const { level, thief, guards, cameras, lasers } = game;
  // Marble floor: checker + gold inlay lines.
  ctx.fillStyle = PALETTE.floor; ctx.fillRect(PLAY.x, PLAY.y, PLAY.w, PLAY.h);
  ctx.fillStyle = PALETTE.floorAlt;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 13; x++) {
    if ((x + y) % 2 === 0) ctx.fillRect(14 + x * 78, 14 + y * 78, 78, 78);
  }
  ctx.strokeStyle = 'rgba(242,201,76,0.10)'; ctx.lineWidth = 1;
  for (let x = 14; x < PLAY.w; x += 78) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, PLAY.h - 14); ctx.stroke(); }
  for (let y = 14; y < PLAY.h; y += 78) { ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(PLAY.w - 14, y); ctx.stroke(); }
  // Vents / skylight shafts: alternative routes, drawn as dark grates.
  for (const v of level.vents) {
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.strokeStyle = '#4a5578'; ctx.strokeRect(v.x, v.y, v.w, v.h);
    ctx.strokeStyle = '#39415f';
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(v.x + 6, v.y + i * 10); ctx.lineTo(v.x + v.w - 6, v.y + i * 10); ctx.stroke(); }
    text(ctx, v.label, v.x + v.w / 2, v.y + v.h + 13, 9, PALETTE.muted, 'center');
  }
  // Exit / getaway van.
  const e = level.exit;
  ctx.fillStyle = level.loot.taken ? '#1f7a4d' : '#24405a';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.strokeStyle = level.loot.taken ? PALETTE.safe : PALETTE.gold; ctx.lineWidth = 2;
  ctx.strokeRect(e.x, e.y, e.w, e.h);
  if (level.index === 2) { // the van
    ctx.fillStyle = '#d8b13c'; ctx.fillRect(e.x + 18, e.y + 6, 60, 20);
    ctx.fillStyle = '#1c2340'; ctx.fillRect(e.x + 26, e.y + 10, 18, 11); ctx.fillRect(e.x + 52, e.y + 10, 18, 11);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(e.x + 34, e.y + 32, 7, 0, 7); ctx.arc(e.x + 110, e.y + 32, 7, 0, 7); ctx.fill();
    text(ctx, e.label, e.x + e.w / 2, e.y + e.h - 4, 10, '#fff', 'center', 'bold');
  } else {
    text(ctx, e.label, e.x + e.w / 2, e.y + e.h / 2 + 4, 11, '#fff', 'center', 'bold');
  }
  // Loot target: gold glow + pulsing ring.
  if (!level.loot.taken) {
    const pulse = 1 + 0.12 * Math.sin(game.time * 4);
    const g = ctx.createRadialGradient(level.loot.x, level.loot.y, 4, level.loot.x, level.loot.y, 70 * pulse);
    g.addColorStop(0, 'rgba(255,226,122,0.55)'); g.addColorStop(1, 'rgba(255,226,122,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(level.loot.x, level.loot.y, 70 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(level.loot.x, level.loot.y, 11, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(level.loot.x, level.loot.y, 16 * pulse, 0, 7); ctx.stroke();
    text(ctx, '◆ ' + level.loot.name.toUpperCase(), level.loot.x, level.loot.y - 26, 11, PALETTE.lootGlow, 'center', 'bold');
  }
  // Walls, cases, pillars, ropes, locked doors.
  for (const w of level.walls) {
    if (w.kind === 'rope') {
      ctx.strokeStyle = PALETTE.velvet; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(w.x, w.y + w.h / 2); ctx.lineTo(w.x + w.w, w.y + w.h / 2); ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(w.x - 3, w.y + w.h / 2 - 8, 6, 16); ctx.fillRect(w.x + w.w - 3, w.y + w.h / 2 - 8, 6, 16);
      continue;
    }
    if (w.kind === 'door') {
      ctx.fillStyle = w.open ? '#1f7a4d' : '#5a3a1a';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2; ctx.strokeRect(w.x, w.y, w.w, w.h);
      if (!w.open) text(ctx, '🔒', w.x + w.w / 2, w.y + w.h / 2 + 20, 10, PALETTE.gold, 'center');
      continue;
    }
    if (w.kind === 'case') {
      ctx.fillStyle = '#31406e'; ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(180,200,255,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = 'rgba(242,201,76,0.85)';
      ctx.beginPath(); ctx.arc(w.x + w.w / 2, w.y + w.h / 2, 5, 0, 7); ctx.fill();
      continue;
    }
    if (w.kind === 'pillar') {
      ctx.fillStyle = '#3d4a7d'; ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#55639c'; ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, 8);
      ctx.fillRect(w.x + 3, w.y + w.h - 11, w.w - 6, 8);
      continue;
    }
    ctx.fillStyle = PALETTE.wall; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = PALETTE.wallTop;
    if (w.h <= 16) ctx.fillRect(w.x, w.y, w.w, 3); else ctx.fillRect(w.x, w.y, 3, w.h);
  }
  // Laser grids (toggle on/off on a timer).
  for (const l of lasers) {
    const on = l.on && thief.empT <= 0;
    ctx.strokeStyle = on ? PALETTE.laser : PALETTE.laserOff;
    ctx.lineWidth = on ? 3 : 1.5;
    ctx.setLineDash(on ? [] : [6, 6]);
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = on ? PALETTE.laser : '#7a4a55';
    ctx.beginPath(); ctx.arc(l.x1, l.y1, 5, 0, 7); ctx.arc(l.x2, l.y2, 5, 0, 7); ctx.fill();
    if (on) { text(ctx, 'LASER', (l.x1 + l.x2) / 2, l.y1 - 8, 9, PALETTE.laser, 'center', 'bold'); }
  }
  // Camera cones, then camera bodies.
  for (const c of cameras) {
    if (c.disabledT <= 0) poly(ctx, cameraCone(c, level.walls), PALETTE.camCone);
  }
  // Guard vision cones (raycast-occluded), then guards.
  for (const g of guards) {
    const col = g.state === 'alert' ? 'rgba(255,45,60,0.30)' : g.state === 'suspicious' ? 'rgba(255,170,40,0.24)' : PALETTE.cone;
    poly(ctx, visionCone(g, level.walls), col);
  }
  for (const c of cameras) {
    ctx.fillStyle = c.disabledT > 0 ? '#3a3f52' : '#e8b23a';
    ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, 7); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(c.angle) * 16, c.y + Math.sin(c.angle) * 16); ctx.stroke();
    text(ctx, c.disabledT > 0 ? 'CAM ✕' : 'CAM', c.x, c.y - 14, 9, c.disabledT > 0 ? PALETTE.muted : '#e8b23a', 'center', 'bold');
  }
  for (const g of guards) {
    // Suspicion arc above the guard's head.
    if (g.suspicion > 0.05) {
      ctx.strokeStyle = g.state === 'alert' ? PALETTE.danger : '#ffb02e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(g.x, g.y - 24, 9, -Math.PI / 2, -Math.PI / 2 + g.suspicion * 2 * Math.PI); ctx.stroke();
    }
    ctx.fillStyle = g.state === 'alert' ? '#ff2d3c' : PALETTE.guard;
    ctx.beginPath(); ctx.arc(g.x, g.y, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#1c1c22'; ctx.beginPath(); ctx.arc(g.x + Math.cos(g.angle) * 6, g.y + Math.sin(g.angle) * 6, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(g.x, g.y, 14, 0, 7); ctx.stroke();
    text(ctx, g.state === 'alert' ? '!' : g.state === 'suspicious' ? '?' : '', g.x, g.y - 20, 16, '#fff', 'center', 'bold');
  }
  // Smoke cloud.
  if (thief.smokeCloud) {
    ctx.fillStyle = PALETTE.smoke;
    ctx.beginPath(); ctx.arc(thief.smokeCloud.x, thief.smokeCloud.y, thief.smokeCloud.r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(220,225,240,0.35)';
    ctx.beginPath(); ctx.arc(thief.smokeCloud.x - 30, thief.smokeCloud.y + 10, 45, 0, 7); ctx.fill();
  }
  // The thief: dark coat, gold mask glint, facing tick.
  ctx.fillStyle = PALETTE.thiefCoat; ctx.beginPath(); ctx.arc(thief.x, thief.y, 13, 0, 7); ctx.fill();
  ctx.strokeStyle = thief.sneaking ? PALETTE.safe : PALETTE.gold; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(thief.x, thief.y, 13, 0, 7); ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath(); ctx.arc(thief.x + Math.cos(thief.facing) * 6, thief.y + Math.sin(thief.facing) * 6, 4, 0, 7); ctx.fill();
  // Noise ring while moving loud.
  if (thief.noise > 60) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(thief.x, thief.y, thief.noise * (0.8 + 0.2 * Math.sin(game.time * 6)), 0, 7); ctx.stroke();
  }
  // Channel progress ring (loot grab / lockpick).
  if (thief.channel) {
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(thief.x, thief.y, 22, -Math.PI / 2, -Math.PI / 2 + (thief.channel.t / thief.channel.need) * 2 * Math.PI); ctx.stroke();
    text(ctx, thief.channel.kind === 'loot' ? 'GRABBING…' : 'PICKING LOCK…', thief.x, thief.y - 30, 11, PALETTE.gold, 'center', 'bold');
  }
}

export function drawHUD(ctx, game) {
  const { level, thief, alarm, lives, timeLeft } = game;
  ctx.fillStyle = PALETTE.panel; ctx.fillRect(HUD.x, HUD.y, HUD.w, HUD.h);
  ctx.fillStyle = PALETTE.panelEdge; ctx.fillRect(HUD.x, HUD.y, 3, HUD.h);
  let y = 34;
  text(ctx, 'THE GILDED VAULT', HUD.x + 20, y, 15, PALETTE.gold, 'left', 'bold'); y += 26;
  text(ctx, level.name, HUD.x + 20, y, 13, PALETTE.text, 'left', 'bold'); y += 22;
  text(ctx, 'Goal: ' + level.lootName, HUD.x + 20, y, 12, PALETTE.muted); y += 20;
  if (level.loot.taken) text(ctx, '✓ LOOT SECURED — REACH EXIT', HUD.x + 20, y, 11, PALETTE.safe, 'left', 'bold');
  else text(ctx, '○ Grab the loot, then escape', HUD.x + 20, y, 11, PALETTE.muted);
  y += 30;
  // ALARM meter.
  text(ctx, 'ALARM', HUD.x + 20, y, 12, alarm.value > 60 ? PALETTE.danger : PALETTE.text, 'left', 'bold'); y += 8;
  ctx.fillStyle = '#0a0e1c'; rr(ctx, HUD.x + 20, y, 220, 20, 5); ctx.fill();
  const aw = 220 * Math.min(1, alarm.value / 100);
  ctx.fillStyle = alarm.value > 60 ? PALETTE.danger : alarm.value > 30 ? '#ffb02e' : PALETTE.safe;
  if (aw > 0) { rr(ctx, HUD.x + 20, y, aw, 20, 5); ctx.fill(); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; rr(ctx, HUD.x + 20, y, 220, 20, 5); ctx.stroke();
  text(ctx, Math.round(alarm.value) + '%', HUD.x + 130, y + 15, 11, '#fff', 'center', 'bold'); y += 38;
  if (timeLeft !== null) {
    text(ctx, 'LOCKDOWN IN ' + Math.ceil(timeLeft) + 's', HUD.x + 20, y, 14, timeLeft < 20 ? PALETTE.danger : PALETTE.text, 'left', 'bold'); y += 26;
  }
  // Loot + score.
  text(ctx, 'LOOT  $' + thief.loot.toLocaleString(), HUD.x + 20, y, 14, PALETTE.gold, 'left', 'bold'); y += 22;
  text(ctx, 'Tools spent  −$' + thief.spent, HUD.x + 20, y, 12, PALETTE.muted); y += 20;
  text(ctx, 'Score  ' + (thief.loot - thief.spent + (thief.spotted ? 0 : 500)), HUD.x + 20, y, 12, PALETTE.text); y += 18;
  text(ctx, thief.spotted ? 'Ghost bonus lost (spotted)' : 'Ghost bonus +500 if never spotted', HUD.x + 20, y, 10, PALETTE.muted); y += 30;
  text(ctx, 'LIVES  ' + '♥ '.repeat(lives) + '· '.repeat(Math.max(0, 3 - lives)), HUD.x + 20, y, 13, PALETTE.danger, 'left', 'bold'); y += 30;
  // Tools with costs.
  text(ctx, 'TOOLS — press 1 / 2 / 3, Space to use', HUD.x + 20, y, 11, PALETTE.text, 'left', 'bold'); y += 22;
  for (const key of ['smoke', 'emp', 'lockpick']) {
    const t = TOOLS[key];
    const sel = thief.selected === key;
    ctx.fillStyle = sel ? '#2a3358' : '#1a2038';
    rr(ctx, HUD.x + 20, y - 14, 220, 34, 6); ctx.fill();
    if (sel) { ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 1.5; rr(ctx, HUD.x + 20, y - 14, 220, 34, 6); ctx.stroke(); }
    text(ctx, `[${t.key}] ${t.name}  ×${thief.tools[key]}`, HUD.x + 30, y + 2, 12, sel ? '#fff' : PALETTE.text, 'left', sel ? 'bold' : '');
    text(ctx, '−$' + t.cost, HUD.x + 230, y + 2, 11, PALETTE.gold, 'right'); y += 40;
    text(ctx, t.desc, HUD.x + 30, y - 6, 10, PALETTE.muted); y += 8;
  }
  y += 14;
  text(ctx, 'CONTROLS', HUD.x + 20, y, 11, PALETTE.text, 'left', 'bold'); y += 18;
  const lines = [
    'WASD / arrows — move', 'SHIFT — sneak (quiet, slow)', 'CTRL — sprint (fast, loud)',
    'E — grab loot / pick lock', 'SPACE / click — use tool', 'ESC — pause · M — mute',
  ];
  for (const l of lines) { text(ctx, l, HUD.x + 20, y, 11, PALETTE.muted); y += 17; }
  y += 12;
  text(ctx, 'ROUTES: main hall · vents ·', HUD.x + 20, y, 10, PALETTE.muted); y += 15;
  text(ctx, 'skylight shaft — read the cones!', HUD.x + 20, y, 10, PALETTE.muted);
  if (game.toast) {
    const tw = 620;
    ctx.fillStyle = 'rgba(10,14,28,0.88)'; rr(ctx, PLAY.w / 2 - tw / 2, PLAY.h - 44, tw, 32, 8); ctx.fill();
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 1; rr(ctx, PLAY.w / 2 - tw / 2, PLAY.h - 44, tw, 32, 8); ctx.stroke();
    text(ctx, game.toast, PLAY.w / 2, PLAY.h - 23, 12, '#fff', 'center');
  }
}

function overlay(ctx, title, lines, accent = PALETTE.gold) {
  ctx.fillStyle = 'rgba(8,11,24,0.78)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, title, FIELD.width / 2, 250, 44, accent, 'center', 'bold');
  let y = 300;
  for (const l of lines) { text(ctx, l, FIELD.width / 2, y, 16, PALETTE.text, 'center'); y += 28; }
}
export function drawScreen(ctx, game, screen) {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (screen === SCREEN_TITLE) {
    drawWorld(ctx, game); drawHUD(ctx, game);
    overlay(ctx, 'THE GILDED VAULT', [
      'A night at the museum. Three heists. One clean getaway.',
      'Sneak past the guards, time the lasers, grab the gold — and never get seen.',
      '', 'Press ENTER or click to begin  ·  WASD move · SHIFT sneak · E grab',
    ]);
    return;
  }
  if (screen === SCREEN_SELECT) {
    ctx.fillStyle = PALETTE.floor; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(ctx, 'CHOOSE YOUR HEIST', FIELD.width / 2, 150, 36, PALETTE.gold, 'center', 'bold');
    game.levelChoices.forEach((c, i) => {
      const y = 240 + i * 110;
      ctx.fillStyle = c.unlocked ? '#1a2038' : '#12162a';
      rr(ctx, 340, y - 30, 600, 80, 10); ctx.fill();
      ctx.strokeStyle = c.unlocked ? PALETTE.gold : '#2c3558'; ctx.lineWidth = 2; rr(ctx, 340, y - 30, 600, 80, 10); ctx.stroke();
      text(ctx, (i + 1) + ' · ' + c.name, 370, y, 18, c.unlocked ? '#fff' : PALETTE.muted, 'left', 'bold');
      text(ctx, c.unlocked ? `Steal the ${c.loot} — $${c.value}` : '🔒 Finish the previous heist to unlock', 370, y + 28, 13, PALETTE.muted);
    });
    text(ctx, 'Press 1 / 2 / 3 or click a card · ESC back', FIELD.width / 2, 600, 14, PALETTE.muted, 'center');
    return;
  }
  drawWorld(ctx, game); drawHUD(ctx, game);
  if (screen === SCREEN_PAUSE) {
    overlay(ctx, 'PAUSED', ['The museum waits. The guards do not — well, right now they do.', '', 'ESC resume · M mute · R restart level']);
  } else if (screen === SCREEN_CAUGHT) {
    overlay(ctx, 'CAUGHT!', [`The guards hauled you out. ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left.`, '', 'Press ENTER to slip back in'], PALETTE.danger);
  } else if (screen === SCREEN_LEVEL) {
    overlay(ctx, 'HEIST COMPLETE', [`${game.level.lootName} secured. Score so far: $${game.totalScore}`, '', 'Press ENTER for the next heist'], PALETTE.safe);
  } else if (screen === SCREEN_WIN) {
    overlay(ctx, 'CLEAN GETAWAY!', [`Every jewel secured. Final score: $${game.totalScore}`, game.ghost ? 'GHOST — never spotted. The perfect heist.' : 'Spotted along the way — but the gold is yours.', '', 'Press ENTER to play again'], PALETTE.gold);
  } else if (screen === SCREEN_OVER) {
    overlay(ctx, 'THE HEIST FAILED', ['Three strikes. The vault keeps its gold — this time.', '', 'Press ENTER to try again'], PALETTE.danger);
  }
}
