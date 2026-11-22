// The Gilded Vault — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };
export const PLAY = { x: 0, y: 0, w: 1020, h: 720 }; // museum floor (HUD sits right)
export const HUD = { x: 1020, y: 0, w: 260, h: 720 };
export const STEP = 1 / 60;
export const THIEF = { radius: 13, walk: 175, sneak: 95, sprint: 265, noiseWalk: 95, noiseSneak: 38, noiseSprint: 170 };
export const GUARD = { radius: 14, patrol: 62, chase: 150, search: 95, viewRange: 235, viewHalf: 0.62, hearRange: 190, catchRange: 26 };
export const CAMERA = { range: 215, half: 0.55, sweep: 0.9 };
export const ALARM = { riseSeen: 55, riseCamera: 42, riseLaser: 45, decay: 4.5, trip: 100 };
export const TOOLS = {
  smoke: { name: 'Smoke Bomb', cost: 150, key: '1', desc: 'Breaks line of sight 5s' },
  emp: { name: 'EMP Pulse', cost: 200, key: '2', desc: 'Kills cameras + lasers 6s' },
  lockpick: { name: 'Lockpick', cost: 50, key: '3', desc: 'Opens locked doors silently' },
};
export const LEVELS = [
  { name: '1 · The Gallery', loot: 'Star Sapphire', lootValue: 1200, time: 0 },
  { name: '2 · The Vault Floor', loot: 'The Vault Core', lootValue: 2200, time: 0 },
  { name: '3 · The Rooftop Getaway', loot: 'Crown Jewels', lootValue: 3500, time: 90 },
];
export const PALETTE = {
  floor: '#1c2340', floorAlt: '#232b4d', marble: '#2a3358', wall: '#0d1122', wallTop: '#3a4470',
  velvet: '#8e1f3d', gold: '#f2c94c', goldDim: '#b08d2e', lootGlow: '#ffe27a',
  thief: '#e8ecf5', thiefCoat: '#232a44', guard: '#c94f4f', guardDark: '#7e2a2a',
  cone: 'rgba(255, 64, 64, 0.20)', coneEdge: 'rgba(255, 90, 90, 0.55)',
  camCone: 'rgba(255, 170, 40, 0.16)', laser: '#ff2d55', laserOff: '#5a2030',
  smoke: 'rgba(200, 205, 220, 0.55)', text: '#eef1f5', muted: '#9aa3bd',
  panel: '#141a30', panelEdge: '#2c3558', danger: '#ff4d5e', safe: '#58d68d', alarm: '#ff5a3c',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'gilded-vault.best';
