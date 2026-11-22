// audio.js — WebAudio synth only, no audio files. A low tension drone, soft
// footstep ticks, a pickup chime, a rising alarm sting, and a getaway fanfare.
export function makeAudio() {
  return { ctx: null, muted: false, drone: null, droneGain: null, alarmOsc: null };
}
export function ensureAudio(a) {
  if (a.ctx) { if (a.ctx.state === 'suspended') a.ctx.resume(); return; }
  try {
    a.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = a.ctx.createGain(); g.gain.value = 0.05; g.connect(a.ctx.destination);
    a.droneGain = g;
    const o1 = a.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = a.ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 55.5;
    o1.connect(g); o2.connect(g); o1.start(); o2.start();
    a.drone = [o1, o2];
  } catch { a.ctx = null; }
}
function beep(a, freq, dur, type = 'sine', vol = 0.15, when = 0) {
  if (!a.ctx || a.muted) return;
  const t0 = a.ctx.currentTime + when;
  const o = a.ctx.createOscillator(), g = a.ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(a.ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
export function sfxStep(a, sneak, sprint) { if (!sneak) beep(a, sprint ? 190 : 140, 0.06, 'triangle', sneak ? 0.02 : 0.05); }
export function sfxPickup(a) { beep(a, 660, 0.12, 'sine', 0.18); beep(a, 990, 0.18, 'sine', 0.15, 0.09); }
export function sfxSpotted(a) { beep(a, 220, 0.3, 'sawtooth', 0.14); beep(a, 330, 0.3, 'sawtooth', 0.12, 0.12); }
export function sfxCaught(a) { beep(a, 160, 0.5, 'sawtooth', 0.2); beep(a, 110, 0.6, 'sawtooth', 0.18, 0.2); }
export function sfxLaser(a) { beep(a, 880, 0.15, 'square', 0.1); }
export function sfxTool(a) { beep(a, 440, 0.1, 'triangle', 0.12); beep(a, 330, 0.14, 'triangle', 0.1, 0.08); }
export function sfxWin(a) { [523, 659, 784, 1047].forEach((f, i) => beep(a, f, 0.25, 'sine', 0.16, i * 0.13)); }
export function sfxDoor(a) { beep(a, 300, 0.2, 'triangle', 0.1); beep(a, 500, 0.25, 'triangle', 0.1, 0.15); }
export function setMuted(a, m) { a.muted = m; if (a.droneGain) a.droneGain.gain.value = m ? 0 : 0.05; }
export function setTension(a, alarm) {
  if (a.droneGain && !a.muted) a.droneGain.gain.value = 0.04 + (alarm / 100) * 0.05;
}
