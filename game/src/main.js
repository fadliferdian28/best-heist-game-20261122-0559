// main.js — boot and the game loop: screens, levels, the alarm meter, being
// caught, the L3 lockdown countdown, and the win. Fixed-step simulation,
// canvas scaled to the window.
import { FIELD, STEP, LEVELS, BEST_KEY, ALARM, TOOLS } from './config.js';
import { buildLevel, dist } from './world.js';
import { makeGuard, updateGuard, STATE_ALERT } from './guards.js';
import { makeCamera, makeLaser, updateCamera, updateLaser, cameraSees, laserTripped } from './cameras.js';
import { makeThief, updateThief, tryInteract, useTool } from './thief.js';
import { makeInput, bindInput } from './input.js';
import { makeAudio, ensureAudio, sfxStep, sfxPickup, sfxSpotted, sfxCaught, sfxLaser, sfxTool, sfxWin, sfxDoor, setMuted, setTension } from './audio.js';
import { drawScreen, SCREEN_TITLE, SCREEN_SELECT, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_CAUGHT, SCREEN_LEVEL, SCREEN_WIN, SCREEN_OVER } from './render.js';
import { stageShot } from './shots.js';

window.__gilded = null;
export const game = {
  screen: SCREEN_TITLE, level: null, thief: null, guards: [], cameras: [], lasers: [],
  alarm: { value: 0 }, lives: 3, totalScore: 0, time: 0, timeLeft: null,
  toast: '', toastT: 0, ghost: true, unlocked: 1, levelChoices: [],
  best: 0, muted: false,
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = makeInput();
const audio = makeAudio();
let acc = 0, last = performance.now();

export function loadLevel(index) {
  const def = buildLevel(index);
  game.level = def;
  game.thief = makeThief(def.start);
  game.thief.loot = 0; game.thief.spent = 0;
  game.guards = def.guards.map(makeGuard);
  game.cameras = def.cameras.map(makeCamera);
  game.lasers = def.lasers.map(makeLaser);
  game.alarm.value = 0;
  game.timeLeft = def.lockdown > 0 ? null : null; // lockdown starts only after the L3 grab
  game.toast = ''; game.toastT = 0;
  game.screen = SCREEN_PLAY;
}
function refreshChoices() {
  game.levelChoices = LEVELS.map((l, i) => ({
    name: l.name, loot: l.loot, value: l.lootValue, unlocked: i < game.unlocked,
  }));
}
function say(msg, secs = 3) { game.toast = msg; game.toastT = secs; }
function caught() {
  game.lives -= 1; game.ghost = false;
  sfxCaught(audio);
  if (game.lives <= 0) { game.screen = SCREEN_OVER; saveBest(); return; }
  game.screen = SCREEN_CAUGHT;
  // Slip back in at the start of the same level, alarm cooled down.
  game.alarm.value = 25;
  const s = game.level.start;
  game.thief.x = s.x; game.thief.y = s.y; game.thief.px = s.x; game.thief.py = s.y;
  game.thief.channel = null; game.thief.smokeCloud = null;
  for (const g of game.guards) { g.state = 'patrol'; g.suspicion = 0; g.lastSeen = null; }
}
function saveBest() {
  try {
    const prev = Number(localStorage.getItem(BEST_KEY) || 0);
    if (game.totalScore > prev) localStorage.setItem(BEST_KEY, String(game.totalScore));
  } catch { /* private mode */ }
}
function levelComplete() {
  const t = game.thief;
  const levelScore = t.loot - t.spent;
  game.totalScore += levelScore;
  if (game.level.index === 2) {
    game.screen = SCREEN_WIN; sfxWin(audio); saveBest();
  } else {
    game.unlocked = Math.max(game.unlocked, game.level.index + 2);
    refreshChoices();
    game.screen = SCREEN_LEVEL;
  }
}

function step(dt) {
  game.time += dt;
  if (game.screen !== SCREEN_PLAY) return;
  const t = game.thief, level = game.level;
  // Input: tool select + use.
  if (input.select) {
    const map = { '1': 'smoke', '2': 'emp', '3': 'lockpick' };
    t.selected = map[input.select]; input.select = null;
  }
  if (input.useTool) {
    input.useTool = false;
    const msg = useTool(t, level);
    if (msg) { say(msg); sfxTool(audio); }
  }
  if (input.interact) {
    input.interact = false;
    const r = tryInteract(t, level);
    if (r === 'nolockpick') say('Need a lockpick — buy one with [3]');
    else if (r === 'nothing') say('Nothing to grab here');
  }
  if (input.pause) { input.pause = false; game.screen = SCREEN_PAUSE; return; }
  if (input.mute) { input.mute = false; game.muted = !game.muted; setMuted(audio, game.muted); say(game.muted ? 'Muted' : 'Sound on'); }

  updateThief(t, dt, input, level.walls, level, {
    onStep: (sn, sp) => sfxStep(audio, sn, sp),
    onLoot: (loot) => {
      loot.taken = true; t.loot += loot.value; t.lootTaken += 1;
      sfxPickup(audio);
      say(`${loot.name} secured! Now reach the exit.`);
      if (level.index === 2) { game.timeLeft = level.lockdown; say('LOCKDOWN! Reach the van in 90s!'); }
    },
    onDoor: (door) => {
      door.open = true; t.tools.lockpick -= 1; t.spent += TOOLS.lockpick.cost;
      sfxDoor(audio); say('Door picked — silent (−$50)');
    },
  });
  // Cameras: detection feeds the alarm.
  for (const c of game.cameras) {
    updateCamera(c, dt);
    const seen = cameraSees(c, t, level.walls, t.smokeCloud);
    if (seen > 0) {
      game.alarm.value = Math.min(100, game.alarm.value + ALARM.riseCamera * seen * dt);
      if (!t.spotted) { t.spotted = true; game.ghost = false; sfxSpotted(audio); say('Camera spotted you!'); }
    }
  }
  // Lasers.
  for (const l of game.lasers) {
    updateLaser(l, dt);
    if (t.empT <= 0 && laserTripped(l, t, { x: t.px, y: t.py })) {
      game.alarm.value = Math.min(100, game.alarm.value + ALARM.riseLaser);
      sfxLaser(audio); say('LASER TRIPPED! Alarm +45');
      for (const g of game.guards) if (g.state === 'patrol') { g.state = 'suspicious'; g.suspicion = 0.7; g.lastSeen = { x: t.x, y: t.y }; }
    }
  }
  // Guards.
  let maxSeen = 0;
  for (const g of game.guards) {
    updateGuard(g, dt, {
      thief: t, walls: level.walls, smoke: t.smokeCloud, alarm: game.alarm,
      onSpotted: () => { if (!t.spotted) { t.spotted = true; game.ghost = false; sfxSpotted(audio); say('SPOTTED! Break line of sight!'); } },
      onCaught: () => caught(),
    });
    if (g.state === STATE_ALERT) maxSeen = 1;
  }
  if (maxSeen) game.alarm.value = Math.min(100, game.alarm.value + ALARM.riseSeen * 0.4 * dt);
  game.alarm.value = Math.max(0, game.alarm.value - ALARM.decay * dt);
  if (game.alarm.value >= ALARM.trip) { say('ALARM TRIPPED!'); caught(); return; }
  // Lockdown countdown on L3 after the grab.
  if (game.timeLeft !== null) {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) { game.lives = 0; game.screen = SCREEN_OVER; say('Lockdown sealed the roof.'); return; }
  }
  // Exit: only counts with the loot.
  const e = level.exit;
  if (level.loot.taken && t.x > e.x - 6 && t.x < e.x + e.w + 6 && t.y > e.y - 6 && t.y < e.y + e.h + 6) {
    levelComplete();
  }
  if (game.toastT > 0) { game.toastT -= dt; if (game.toastT <= 0) game.toast = ''; }
  setTension(audio, game.alarm.value);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (game.frozen) { drawScreen(ctx, game, game.screen); requestAnimationFrame(frame); return; }
  acc += dt;
  while (acc >= STEP) { step(STEP); acc -= STEP; }
  // Screens that advance on confirm.
  if (input.pause && game.screen === SCREEN_PAUSE) { input.pause = false; game.screen = SCREEN_PLAY; }
  if (input.mute) { input.mute = false; game.muted = !game.muted; setMuted(audio, game.muted); }
  drawScreen(ctx, game, game.screen);
  requestAnimationFrame(frame);
}

function onConfirm() {
  ensureAudio(audio);
  if (game.screen === SCREEN_TITLE) { refreshChoices(); game.screen = SCREEN_SELECT; }
  else if (game.screen === SCREEN_SELECT) { loadLevel(0); }
  else if (game.screen === SCREEN_CAUGHT) { game.screen = SCREEN_PLAY; }
  else if (game.screen === SCREEN_LEVEL) { loadLevel(game.level.index + 1); }
  else if (game.screen === SCREEN_WIN || game.screen === SCREEN_OVER) {
    game.lives = 3; game.totalScore = 0; game.ghost = true; game.unlocked = 1;
    refreshChoices(); game.screen = SCREEN_SELECT;
  }
}
function onKeySelect() {
  // Number keys on the level-select screen pick a heist.
  if (game.screen !== SCREEN_SELECT || !input.select) return;
  const i = Number(input.select) - 1; input.select = null;
  if (game.levelChoices[i]?.unlocked) loadLevel(i);
}

function boot() {
  canvas.width = FIELD.width; canvas.height = FIELD.height;
  try { game.best = Number(localStorage.getItem(BEST_KEY) || 0); } catch { game.best = 0; }
  refreshChoices();
  loadLevel(0);
  game.screen = SCREEN_TITLE; // title over a live L1 backdrop
  // ?shot=cover|patrol|tools|getaway — deterministic staged frames for screenshots.
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    const screen = stageShot(shot, game);
    game.screen = screen;
    game.frozen = true; // staged frame: no simulation drift before the screenshot
    document.title = 'The Gilded Vault — shot ' + shot;
  }
  bindInput(input, canvas, {
    onConfirm,
    onBlur: () => { if (game.screen === SCREEN_PLAY) game.screen = SCREEN_PAUSE; },
  });
  canvas.addEventListener('mousedown', () => {
    ensureAudio(audio);
    if (game.screen === SCREEN_TITLE) onConfirm();
  });
  // Click a level card on the select screen; otherwise clicks use the tool.
  canvas.addEventListener('mousedown', (e) => {
    if (game.screen === SCREEN_SELECT) {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (FIELD.width / r.width), y = (e.clientY - r.top) * (FIELD.height / r.height);
      game.levelChoices.forEach((c, i) => {
        if (c.unlocked && x > 340 && x < 940 && y > 210 + i * 110 && y < 290 + i * 110) loadLevel(i);
      });
    }
  });
  window.__gilded = game;
  setInterval(onKeySelect, 50);
  requestAnimationFrame(frame);
}
boot();
