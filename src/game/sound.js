// Tiny procedural sound engine — all SFX + ambient music are synthesized with
// the Web Audio API, so there are zero asset files to ship. Everything is
// gated behind `enabled` and a lazily-created AudioContext that resumes on the
// first user gesture (browsers block audio before that).

let ctx = null;
let master = null;
let enabled = JSON.parse(
  (typeof localStorage !== "undefined" && localStorage.getItem("sdg_sound")) || "true"
);
let music = null;
let lastSfx = {}; // throttle map

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noiseBuffer(c, dur) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(c, { type = "sine", from, to, dur, gain = 0.2, delay = 0 }) {
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function burst(c, { dur = 0.18, gain = 0.25, lp = 1800, delay = 0 }) {
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur);
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.setValueAtTime(lp, t);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const SFX = {
  thud(c) {
    tone(c, { type: "triangle", from: 180, to: 90, dur: 0.09, gain: 0.12 });
  },
  crunch(c) {
    burst(c, { dur: 0.12, gain: 0.16, lp: 2200 });
  },
  bigcrunch(c) {
    burst(c, { dur: 0.22, gain: 0.3, lp: 1400 });
    tone(c, { type: "square", from: 140, to: 60, dur: 0.18, gain: 0.12 });
  },
  roar(c) {
    burst(c, { dur: 0.55, gain: 0.32, lp: 900 });
    tone(c, { type: "sawtooth", from: 120, to: 55, dur: 0.5, gain: 0.18 });
  },
  hurt(c) {
    tone(c, { type: "sawtooth", from: 300, to: 80, dur: 0.25, gain: 0.2 });
  },
  hatch(c) {
    tone(c, { type: "triangle", from: 220, to: 660, dur: 0.4, gain: 0.2 });
    burst(c, { dur: 0.3, gain: 0.18, lp: 3000, delay: 0.05 });
  },
  ui(c) {
    tone(c, { type: "square", from: 520, to: 720, dur: 0.06, gain: 0.08 });
  },
  power(c) {
    tone(c, { type: "triangle", from: 400, to: 900, dur: 0.16, gain: 0.14 });
  },
  wave(c) {
    tone(c, { type: "sine", from: 330, to: 495, dur: 0.5, gain: 0.16 });
  },
};

export const sound = {
  get enabled() {
    return enabled;
  },
  unlock() {
    ac();
  },
  toggle() {
    enabled = !enabled;
    try {
      localStorage.setItem("sdg_sound", JSON.stringify(enabled));
    } catch {}
    if (!enabled) this.stopMusic();
    else this.startMusic();
    return enabled;
  },
  play(name, throttleMs = 0) {
    if (!enabled) return;
    if (throttleMs) {
      const now = performance.now();
      if (lastSfx[name] && now - lastSfx[name] < throttleMs) return;
      lastSfx[name] = now;
    }
    const c = ac();
    if (c && SFX[name]) SFX[name](c);
  },
  startMusic() {
    if (!enabled) return;
    const c = ac();
    if (!c || music) return;
    // Slow evolving prehistoric drone: two detuned saws + a sub, gently swelled
    // by an LFO, kept very quiet under the SFX.
    const g = c.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.06, c.currentTime + 3);
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 380;
    const o1 = c.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 55;
    const o2 = c.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.value = 55.5;
    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 36.7;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = c.createGain();
    lfoG.gain.value = 120;
    lfo.connect(lfoG);
    lfoG.connect(filt.frequency);
    o1.connect(filt);
    o2.connect(filt);
    sub.connect(filt);
    filt.connect(g);
    g.connect(master);
    [o1, o2, sub, lfo].forEach((n) => n.start());
    music = { nodes: [o1, o2, sub, lfo], gain: g };
  },
  stopMusic() {
    if (!music || !ctx) return;
    const { nodes, gain } = music;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1);
    const dead = nodes;
    setTimeout(() => dead.forEach((n) => n.stop()), 1100);
    music = null;
  },
};
