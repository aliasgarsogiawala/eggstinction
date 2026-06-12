// PreserveScene — a cozy build-your-own prehistoric diorama. The player spends
// DNA to place flora, terrain and dinosaurs on a daytime Cretaceous landscape,
// then drags them around. Items are stored in normalised (0..1) coords so a
// preserve looks the same at any window size. Rendering is sorted back-to-front
// for a sense of depth.

const TAU = Math.PI * 2;

// Ground band the items live on (normalised y). Roomy, for a big diorama.
const GROUND_TOP = 0.34;
const GROUND_BOT = 0.97;

const hexToRgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const lerpColor = (a, b, t) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${ca.map((v, i) => Math.round(v + (cb[i] - v) * t)).join(",")})`;
};

// Sky keyframes across a 24h day. `sun` is a vertical 0..1 (0 = high, 1 = on
// the horizon); null = night (moon instead). Interpolated by the local clock.
const SKY_KEYS = [
  { h: 0, top: "#0a1230", hor: "#16213f", star: 1.0, sun: null },
  { h: 5, top: "#1b2550", hor: "#3a3a66", star: 0.7, sun: null },
  { h: 7, top: "#5a7fb0", hor: "#f0a85a", star: 0.15, sun: 0.86 },
  { h: 12, top: "#6fb0e6", hor: "#dcebc0", star: 0, sun: 0.16 },
  { h: 17, top: "#6a86b8", hor: "#f0a05a", star: 0.08, sun: 0.8 },
  { h: 19, top: "#39355f", hor: "#e0703c", star: 0.4, sun: 0.96 },
  { h: 21, top: "#141a3a", hor: "#22284a", star: 0.85, sun: null },
  { h: 24, top: "#0a1230", hor: "#16213f", star: 1.0, sun: null },
];

// Which placed dinos are alive, and what each kind eats.
const CARNIVORES = new Set(["trex", "raptor", "ptero"]);
const HERBIVORES = new Set(["stego", "trike", "bronto"]);
const PLANTS = new Set(["fern", "cycad", "bush", "palm", "conifer"]);
const WATER = new Set(["pond"]);
const MEAT = new Set(["meat"]);
const REACH = 0.34; // how far a dino will look for water/food (normalised)
const FEED = 0.09; // how close it must be to drink/eat

// Biome palettes + their signature background feature.
export const SCENERIES = {
  jungle: { g0: "#7fb255", g1: "#4c7a34", hill: "#9cc06a", accent: "volcano", amb: null },
  volcanic: { g0: "#6a4a3a", g1: "#2a1a14", hill: "#5a4030", accent: "lava", amb: "ash" },
  swamp: { g0: "#5f6a42", g1: "#2f3a26", hill: "#566a45", accent: "water", amb: "fog" },
  desert: { g0: "#e6c688", g1: "#c79a4e", hill: "#d8b46a", accent: "dunes", amb: null },
  tundra: { g0: "#e6eef4", g1: "#a9c0cf", hill: "#cddde8", accent: "pines", amb: "snow" },
};

export class PreserveScene {
  constructor(canvas, { items = [], scenery = "jungle", onPlace, onChange, onSelect } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.items = items.map((it) => ({ ...it }));
    this.scenery = SCENERIES[scenery] ? scenery : "jungle";
    this.onPlace = onPlace;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.placingKey = null; // catalog key currently being placed
    this.selected = -1;
    this.dragging = false;
    this.mouse = { x: 0, y: 0, inside: false };
    this.t = 0;
    this.clouds = [];
    this.amb = []; // ambient particles (ash / snow / fog)

    this.resize();

    this._move = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * this.w;
      this.mouse.y = ((e.clientY - r.top) / r.height) * this.h;
      this.mouse.inside = true;
      if (this.dragging && this.selected >= 0) {
        const it = this.items[this.selected];
        it.x = this.clampX(this.mouse.x / this.w);
        it.y = this.clampY(this.mouse.y / this.h);
      }
    };
    this._down = (e) => {
      this._move(e);
      if (this.placingKey) {
        const px = this.clampX(this.mouse.x / this.w);
        const py = this.clampY(this.mouse.y / this.h);
        const ok = this.onPlace?.(this.placingKey, px, py);
        if (ok) {
          this.items.push({ k: this.placingKey, x: px, y: py });
          this.onChange?.(this.items);
        }
        return;
      }
      const hit = this.hitTest(this.mouse.x, this.mouse.y);
      this.selected = hit;
      this.onSelect?.(hit >= 0);
      this.dragging = hit >= 0;
    };
    this._up = () => {
      if (this.dragging) this.onChange?.(this.items);
      this.dragging = false;
    };
    this._leave = () => (this.mouse.inside = false);
    this._key = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && this.selected >= 0) {
        this.deleteSelected();
      }
    };

    canvas.addEventListener("pointermove", this._move);
    canvas.addEventListener("pointerdown", this._down);
    window.addEventListener("pointerup", this._up);
    canvas.addEventListener("pointerleave", this._leave);
    window.addEventListener("keydown", this._key);
  }

  setPlacing(key) {
    this.placingKey = key;
    if (key) {
      this.selected = -1;
      this.onSelect?.(false);
    }
  }

  setScenery(key) {
    if (SCENERIES[key]) {
      this.scenery = key;
      this.amb = [];
    }
  }

  // Sky colours from the user's actual local time of day.
  skyNow() {
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    let a = SKY_KEYS[0];
    let b = SKY_KEYS[1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      if (h >= SKY_KEYS[i].h && h <= SKY_KEYS[i + 1].h) {
        a = SKY_KEYS[i];
        b = SKY_KEYS[i + 1];
        break;
      }
    }
    const t = (h - a.h) / ((b.h - a.h) || 1);
    let sun = null;
    if (a.sun != null && b.sun != null) sun = a.sun + (b.sun - a.sun) * t;
    else if (a.sun != null) sun = a.sun;
    else if (b.sun != null) sun = b.sun;
    return {
      top: lerpColor(a.top, b.top, t),
      hor: lerpColor(a.hor, b.hor, t),
      star: a.star + (b.star - a.star) * t,
      sun,
    };
  }

  deleteSelected() {
    if (this.selected < 0) return;
    this.items.splice(this.selected, 1);
    this.selected = -1;
    this.onSelect?.(false);
    this.onChange?.(this.items);
  }

  clampX(x) {
    return Math.max(0.04, Math.min(0.96, x));
  }
  clampY(y) {
    return Math.max(GROUND_TOP, Math.min(GROUND_BOT, y));
  }

  // Depth scale: items lower on the ground read as nearer (bigger).
  scaleFor(y) {
    const u = Math.min(this.w, this.h) * 0.1;
    return u * (0.5 + ((y - GROUND_TOP) / (GROUND_BOT - GROUND_TOP)) * 0.95);
  }

  hitTest(px, py) {
    // Topmost (last drawn) first.
    const order = this.items
      .map((it, i) => i)
      .sort((a, b) => this.items[a].y - this.items[b].y);
    for (let j = order.length - 1; j >= 0; j--) {
      const i = order[j];
      const it = this.items[i];
      const x = it.x * this.w;
      const y = it.y * this.h;
      const s = this.scaleFor(it.y);
      // Generous click box around the base.
      if (px > x - s * 0.7 && px < x + s * 0.7 && py > y - s * 1.4 && py < y + s * 0.3) {
        return i;
      }
    }
    return -1;
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = c.clientWidth || 800;
    this.h = c.clientHeight || 600;
    c.width = this.w * dpr;
    c.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.clouds = [];
    for (let i = 0; i < 4; i++) {
      this.clouds.push({ x: Math.random() * this.w, y: this.h * (0.06 + Math.random() * 0.16), s: 30 + Math.random() * 50, v: 6 + Math.random() * 10 });
    }
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({ x: Math.random(), y: Math.random() * 0.85, r: 0.3 + Math.random() * 1.2, p: Math.random() * TAU });
    }
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min((t - this.last) / 1000, 0.05);
      this.last = t;
      this.t += dt;
      for (const cl of this.clouds) {
        cl.x += cl.v * dt;
        if (cl.x - cl.s > this.w) cl.x = -cl.s;
      }
      this.updateAmbient(dt);
      this.updateLife(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    const c = this.canvas;
    c.removeEventListener("pointermove", this._move);
    c.removeEventListener("pointerdown", this._down);
    window.removeEventListener("pointerup", this._up);
    c.removeEventListener("pointerleave", this._leave);
    window.removeEventListener("keydown", this._key);
  }

  // ---------------- draw ----------------
  draw() {
    const { ctx } = this;
    const W = this.w;
    const H = this.h;
    const horizon = H * GROUND_TOP;
    const sky = this.skyNow();
    const night = sky.star; // 0 day .. 1 deep night
    const sc = SCENERIES[this.scenery];

    // Sky gradient from the local clock.
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.hor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizon);

    // Stars at night.
    if (night > 0.05) {
      for (const st of this.stars) {
        const tw = 0.4 + (Math.sin(this.t * 2 + st.p) * 0.5 + 0.5) * 0.6;
        ctx.globalAlpha = night * tw;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(st.x * W, st.y * horizon, st.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Sun (day) or moon (night).
    const sx = W * 0.8;
    if (sky.sun != null) {
      const sy = horizon * (0.12 + sky.sun * 0.7);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 150);
      sg.addColorStop(0, "rgba(255,245,200,0.9)");
      sg.addColorStop(1, "rgba(255,245,200,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, horizon);
      ctx.fillStyle = "#fff6cf";
      ctx.beginPath();
      ctx.arc(sx, sy, 32, 0, TAU);
      ctx.fill();
    } else {
      const my = horizon * 0.22;
      ctx.fillStyle = "rgba(232,240,255,0.95)";
      ctx.beginPath();
      ctx.arc(sx, my, 24, 0, TAU);
      ctx.fill();
      ctx.fillStyle = sky.top; // crescent shadow
      ctx.beginPath();
      ctx.arc(sx + 9, my - 5, 22, 0, TAU);
      ctx.fill();
    }

    // Clouds (thin out at night).
    if (night < 0.85) {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - night)})`;
      for (const cl of this.clouds) this.cloud(cl.x, cl.y, cl.s);
    }

    // Biome hills + signature backdrop feature.
    this.drawScenery(horizon, night);

    // Ground in the biome's colours.
    const gnd = ctx.createLinearGradient(0, horizon, 0, H);
    gnd.addColorStop(0, sc.g0);
    gnd.addColorStop(1, sc.g1);
    ctx.fillStyle = gnd;
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, horizon - 1, W, 3);

    // Items, back to front.
    const order = this.items
      .map((_, i) => i)
      .sort((a, b) => this.items[a].y - this.items[b].y);
    for (const i of order) {
      const it = this.items[i];
      const sim = it.sim;
      const ax = sim ? it.x + sim.ox : it.x;
      const ay = sim ? it.y + sim.oy : it.y;
      const x = ax * W;
      const y = ay * H;
      const s = this.scaleFor(ay);
      this.shadow(x, y, s);
      const bobY = sim && sim.state !== "sick" ? Math.sin(sim.bob) * s * 0.03 : 0;
      const fn = DRAW[it.k];
      if (fn) {
        ctx.save();
        if (sim && sim.state === "sick") ctx.globalAlpha = 0.5;
        fn(ctx, x, y + bobY, s, this.t);
        ctx.restore();
      }
      if (sim && sim.state !== "happy" && sim.state !== "feeding") {
        this.bubble(x, y - s * 1.55, sim.state, it.k);
      }
      if (i === this.selected) {
        ctx.strokeStyle = "#ffd98a";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.strokeRect(x - s * 0.7, y - s * 1.4, s * 1.4, s * 1.7);
        ctx.setLineDash([]);
      }
    }

    // Placement ghost.
    if (this.placingKey && this.mouse.inside) {
      const x = this.clampX(this.mouse.x / W) * W;
      const y = this.clampY(this.mouse.y / H) * H;
      const s = this.scaleFor(y / H);
      ctx.globalAlpha = 0.55;
      this.shadow(x, y, s);
      const fn = DRAW[this.placingKey];
      if (fn) fn(ctx, x, y, s, this.t);
      ctx.globalAlpha = 1;
    }

    // Ambient weather (ash / snow / fog) drifts over everything.
    this.drawAmbient(horizon);

    // Cool night tint over the whole scene.
    if (night > 0.05) {
      ctx.fillStyle = `rgba(14,20,46,${night * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  shadow(x, y, s) {
    const { ctx } = this;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.5, s * 0.16, 0, 0, TAU);
    ctx.fill();
  }

  cloud(x, y, s) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, TAU);
    ctx.arc(x + s * 0.5, y + s * 0.08, s * 0.4, 0, TAU);
    ctx.arc(x - s * 0.5, y + s * 0.1, s * 0.35, 0, TAU);
    ctx.arc(x, y + s * 0.18, s * 0.45, 0, TAU);
    ctx.fill();
  }

  drawScenery(horizon, night) {
    const { ctx } = this;
    const W = this.w;
    const sc = SCENERIES[this.scenery];

    // Rolling hills.
    ctx.fillStyle = sc.hill;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= W; x += 50) {
      ctx.lineTo(x, horizon - (Math.sin(x * 0.01) * 0.5 + 0.5) * horizon * 0.12 - 6);
    }
    ctx.lineTo(W, horizon);
    ctx.closePath();
    ctx.fill();

    const vx = W * 0.72;
    const vh = horizon * 0.42;
    if (sc.accent === "volcano" || sc.accent === "lava") {
      ctx.fillStyle = sc.accent === "lava" ? "#3a2018" : "#6f7f55";
      ctx.beginPath();
      ctx.moveTo(vx - vh, horizon);
      ctx.lineTo(vx - vh * 0.22, horizon - vh);
      ctx.lineTo(vx + vh * 0.22, horizon - vh);
      ctx.lineTo(vx + vh, horizon);
      ctx.closePath();
      ctx.fill();
      if (sc.accent === "lava") {
        ctx.fillStyle = "rgba(255,110,40,0.9)";
        ctx.beginPath();
        ctx.ellipse(vx, horizon - vh, vh * 0.22, vh * 0.05, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,90,30,0.7)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(vx - vh * 0.1, horizon - vh);
        ctx.lineTo(vx - vh * 0.3, horizon - vh * 0.4);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(120,120,120,0.5)";
        ctx.beginPath();
        ctx.ellipse(vx, horizon - vh, vh * 0.22, vh * 0.05, 0, 0, TAU);
        ctx.fill();
      }
    } else if (sc.accent === "water") {
      // A still lake along the horizon.
      ctx.fillStyle = night > 0.4 ? "#1d3550" : "#4f86a4";
      ctx.fillRect(0, horizon, W, this.h * 0.06);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(0, horizon + 4, W, 2);
    } else if (sc.accent === "dunes") {
      ctx.fillStyle = sc.hill;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(W * (0.25 + i * 0.28), horizon, W * 0.22, horizon * 0.16, 0, Math.PI, TAU);
        ctx.fill();
      }
    } else if (sc.accent === "pines") {
      ctx.fillStyle = "#5a7466";
      for (let i = 0; i < 9; i++) {
        const px = (i / 8) * W;
        const ph = horizon * (0.16 + (i % 3) * 0.04);
        ctx.beginPath();
        ctx.moveTo(px, horizon);
        ctx.lineTo(px - ph * 0.4, horizon);
        ctx.lineTo(px, horizon - ph);
        ctx.lineTo(px + ph * 0.4, horizon);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // ---------------- the living ecosystem ----------------
  ensureSim(it) {
    if (!it.sim) {
      it.sim = {
        hunger: 0.7 + Math.random() * 0.3,
        thirst: 0.7 + Math.random() * 0.3,
        health: 1,
        ox: 0, oy: 0, // wander offset from home
        wx: 0, wy: 0, // current wander goal
        wt: Math.random() * 3,
        bob: Math.random() * TAU,
        state: "happy",
      };
    }
    return it.sim;
  }

  nearestRes(it, list) {
    let best = null;
    let bd = Infinity;
    for (const r of list) {
      const d = Math.hypot(r.x - it.x, r.y - it.y);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    return best ? { it: best, d: bd } : null;
  }

  updateLife(dt) {
    const ponds = [];
    const plants = [];
    const meats = [];
    for (const it of this.items) {
      if (WATER.has(it.k)) ponds.push(it);
      else if (PLANTS.has(it.k)) plants.push(it);
      else if (MEAT.has(it.k)) meats.push(it);
    }

    for (const it of this.items) {
      const carn = CARNIVORES.has(it.k);
      const herb = HERBIVORES.has(it.k);
      if (!carn && !herb) continue;
      const s = this.ensureSim(it);

      // Needs tick down over time.
      s.hunger = Math.max(0, s.hunger - dt * 0.016);
      s.thirst = Math.max(0, s.thirst - dt * 0.02);

      const nw = this.nearestRes(it, ponds);
      const nf = this.nearestRes(it, carn ? meats : plants);
      const lx = it.x + s.ox;
      const ly = it.y + s.oy;

      // Decide where to go: chase the more pressing unmet need if one's in reach.
      let target = null;
      const wantW = s.thirst < 0.5 && nw && nw.d < REACH;
      const wantF = s.hunger < 0.5 && nf && nf.d < REACH;
      if (wantW && (!wantF || s.thirst <= s.hunger)) target = nw.it;
      else if (wantF) target = nf.it;

      let eating = false;
      let drinking = false;
      if (s.health < 0.18) {
        // Collapsed — barely stirs until rescued.
      } else if (target) {
        const dx = target.x - lx;
        const dy = target.y - ly;
        const d = Math.hypot(dx, dy) || 1;
        if (d < FEED) {
          if (WATER.has(target.k)) {
            s.thirst = Math.min(1, s.thirst + dt * 0.55);
            drinking = true;
          } else {
            s.hunger = Math.min(1, s.hunger + dt * 0.55);
            eating = true;
          }
        } else {
          s.ox += (dx / d) * 0.05 * dt;
          s.oy += (dy / d) * 0.05 * dt;
        }
      } else {
        // Content — amble around home.
        s.wt -= dt;
        if (s.wt <= 0) {
          s.wt = 2 + Math.random() * 3;
          s.wx = (Math.random() - 0.5) * 0.08;
          s.wy = (Math.random() - 0.5) * 0.05;
        }
        s.ox += (s.wx - s.ox) * 0.6 * dt;
        s.oy += (s.wy - s.oy) * 0.6 * dt;
      }

      // Keep them on their patch of ground.
      s.ox = Math.max(-0.18, Math.min(0.18, s.ox));
      s.oy = Math.max(GROUND_TOP, Math.min(GROUND_BOT, it.y + s.oy)) - it.y;

      // Health responds to whether needs are met.
      if (s.hunger > 0.25 && s.thirst > 0.25) s.health = Math.min(1, s.health + dt * 0.05);
      else if (s.hunger <= 0.001 || s.thirst <= 0.001) s.health = Math.max(0, s.health - dt * 0.04);

      s.bob += dt * 4;
      s.eating = eating;
      s.drinking = drinking;
      s.state =
        s.health < 0.25 ? "sick" :
        s.thirst < 0.3 ? "thirsty" :
        s.hunger < 0.3 ? "hungry" :
        eating || drinking ? "feeding" : "happy";
    }
  }

  bubble(x, y, state, k) {
    const e =
      state === "thirsty" ? "💧" :
      state === "hungry" ? (CARNIVORES.has(k) ? "🍖" : "🌿") :
      state === "sick" ? "💀" : "";
    if (!e) return;
    const { ctx } = this;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, TAU);
    ctx.fill();
    ctx.font = "15px serif";
    ctx.textAlign = "center";
    ctx.fillText(e, x, y + 5);
  }

  updateAmbient(dt) {
    const sc = SCENERIES[this.scenery];
    if (!sc.amb) {
      this.amb.length = 0;
      return;
    }
    const W = this.w;
    const H = this.h;
    const rate = sc.amb === "fog" ? 1 : 8;
    if (Math.random() < dt * rate && this.amb.length < 120) {
      if (sc.amb === "ash") this.amb.push({ x: Math.random() * W, y: -10, vx: -10 + Math.random() * 26, vy: 18 + Math.random() * 26, r: 1 + Math.random() * 2, sway: Math.random() * TAU });
      else if (sc.amb === "snow") this.amb.push({ x: Math.random() * W, y: -10, vx: -8 + Math.random() * 16, vy: 24 + Math.random() * 26, r: 1.5 + Math.random() * 2.5, sway: Math.random() * TAU });
      else this.amb.push({ x: -120, y: H * (0.45 + Math.random() * 0.45), vx: 12 + Math.random() * 14, vy: 0, r: 60 + Math.random() * 80, sway: 0, fog: true });
    }
    for (const a of this.amb) {
      a.sway += dt;
      a.x += (a.vx + Math.sin(a.sway) * (a.fog ? 0 : 7)) * dt;
      a.y += a.vy * dt;
    }
    this.amb = this.amb.filter((a) => a.y < H + 20 && a.x < W + 160);
  }

  drawAmbient() {
    const { ctx } = this;
    const sc = SCENERIES[this.scenery];
    if (!sc.amb) return;
    if (sc.amb === "fog") {
      ctx.fillStyle = "rgba(200,210,200,0.10)";
      for (const a of this.amb) {
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, a.r, a.r * 0.3, 0, 0, TAU);
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = sc.amb === "ash" ? "rgba(120,110,100,0.6)" : "rgba(255,255,255,0.85)";
    for (const a of this.amb) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, TAU);
      ctx.fill();
    }
  }
}

// ---------------- artwork ----------------
// Each draw fn anchors at (x, y) = the item's base on the ground, scale s.
function leaf(ctx, x, y, len, ang, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(
    x + Math.cos(ang) * len * 0.5,
    y + Math.sin(ang) * len * 0.5 - len * 0.2,
    x + Math.cos(ang) * len,
    y + Math.sin(ang) * len
  );
  ctx.stroke();
}

const DRAW = {
  fern(ctx, x, y, s) {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.34;
      leaf(ctx, x, y, s * 0.95, a, s * 0.08, i % 2 ? "#5f9e3c" : "#74b94c");
    }
  },
  cycad(ctx, x, y, s) {
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(x - s * 0.08, y - s * 0.35, s * 0.16, s * 0.36);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.26;
      leaf(ctx, x, y - s * 0.32, s * 0.7, a, s * 0.07, "#4e8a36");
    }
  },
  bush(ctx, x, y, s) {
    const blobs = [[0, -0.3, 0.5], [-0.35, -0.18, 0.38], [0.35, -0.2, 0.4], [0, -0.6, 0.42]];
    for (const [bx, by, br] of blobs) {
      ctx.fillStyle = by < -0.4 ? "#7fc04f" : "#5fa03a";
      ctx.beginPath();
      ctx.arc(x + bx * s, y + by * s, br * s, 0, TAU);
      ctx.fill();
    }
  },
  palm(ctx, x, y, s) {
    ctx.strokeStyle = "#7a5630";
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.8, x + s * 0.08, y - s * 1.4);
    ctx.stroke();
    const tx = x + s * 0.08, ty = y - s * 1.4;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + 0.25 + (i / 6) * (Math.PI - 0.5);
      leaf(ctx, tx, ty, s * 0.85, a, s * 0.07, i % 2 ? "#4e8a36" : "#5fa544");
    }
    ctx.fillStyle = "#caa24a";
    ctx.beginPath();
    ctx.arc(tx - s * 0.06, ty + s * 0.06, s * 0.07, 0, TAU);
    ctx.arc(tx + s * 0.08, ty + s * 0.05, s * 0.06, 0, TAU);
    ctx.fill();
  },
  conifer(ctx, x, y, s) {
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(x - s * 0.05, y - s * 0.2, s * 0.1, s * 0.22);
    for (let i = 0; i < 3; i++) {
      const ty = y - s * 0.18 - i * s * 0.42;
      const tw = s * (0.5 - i * 0.12);
      ctx.fillStyle = i === 2 ? "#4f8c3a" : "#447c33";
      ctx.beginPath();
      ctx.moveTo(x, ty - s * 0.7);
      ctx.lineTo(x - tw, ty);
      ctx.lineTo(x + tw, ty);
      ctx.closePath();
      ctx.fill();
    }
  },
  rock(ctx, x, y, s) {
    ctx.fillStyle = "#8b9088";
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.18, s * 0.42, s * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#aab0a5";
    ctx.beginPath();
    ctx.ellipse(x - s * 0.12, y - s * 0.28, s * 0.16, s * 0.1, 0, 0, TAU);
    ctx.fill();
  },
  boulder(ctx, x, y, s) {
    ctx.fillStyle = "#777c73";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y);
    ctx.lineTo(x - s * 0.5, y - s * 0.4);
    ctx.lineTo(x - s * 0.2, y - s * 0.62);
    ctx.lineTo(x + s * 0.3, y - s * 0.58);
    ctx.lineTo(x + s * 0.52, y - s * 0.28);
    ctx.lineTo(x + s * 0.5, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.1, y - s * 0.6);
    ctx.lineTo(x - s * 0.02, y - s * 0.2);
    ctx.lineTo(x + s * 0.2, y - s * 0.05);
    ctx.stroke();
  },
  pond(ctx, x, y, s, t) {
    ctx.fillStyle = "#3f93c4";
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.05, s * 0.62, s * 0.26, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#7cc4e6";
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.08, s * 0.5, s * 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = s * 0.02;
    const r = (Math.sin(t * 1.5) * 0.5 + 0.5) * s * 0.4;
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.08, r, r * 0.36, 0, 0, TAU);
    ctx.stroke();
  },
  nest(ctx, x, y, s) {
    ctx.strokeStyle = "#6b4a2a";
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.1 + (i / 7) * 0.8);
      const nx = x + Math.cos(a) * s * 0.5;
      const ny = y - s * 0.05 + Math.sin(a) * s * 0.16;
      ctx.beginPath();
      ctx.moveTo(nx - s * 0.1, ny);
      ctx.lineTo(nx + s * 0.1, ny - s * 0.02);
      ctx.stroke();
    }
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = "#dfe9b8";
      ctx.beginPath();
      ctx.ellipse(x + i * s * 0.22, y - s * 0.18, s * 0.13, s * 0.17, i * 0.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#b6c187";
      ctx.lineWidth = s * 0.02;
      ctx.stroke();
    }
  },
  meat(ctx, x, y, s) {
    // A meaty chunk on a bone — carnivore feeding station.
    ctx.strokeStyle = "#efe6d2";
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, y - s * 0.05);
    ctx.lineTo(x + s * 0.35, y - s * 0.3);
    ctx.stroke();
    ctx.fillStyle = "#efe6d2";
    for (const [bx, by] of [[-0.34, 0], [0.4, -0.32]]) {
      ctx.beginPath();
      ctx.arc(x + bx * s, y + by * s, s * 0.08, 0, TAU);
      ctx.arc(x + bx * s + s * 0.06, y + by * s, s * 0.08, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#a63a32";
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.2, s * 0.26, s * 0.2, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#c45a4e";
    ctx.beginPath();
    ctx.ellipse(x - s * 0.06, y - s * 0.26, s * 0.1, s * 0.07, -0.3, 0, TAU);
    ctx.fill();
  },
  ptero(ctx, x, y, s) {
    // Standing pteranodon.
    ctx.strokeStyle = "#a98a5a";
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - s * 0.5);
    ctx.stroke();
    ctx.fillStyle = "#c8a86e";
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.6, s * 0.18, s * 0.13, 0, 0, TAU);
    ctx.fill();
    // Crest + beak.
    ctx.beginPath();
    ctx.moveTo(x + s * 0.1, y - s * 0.66);
    ctx.lineTo(x + s * 0.5, y - s * 0.72);
    ctx.lineTo(x + s * 0.12, y - s * 0.56);
    ctx.fillStyle = "#b08f56";
    ctx.fill();
    // Folded wings.
    ctx.strokeStyle = "#9c7d4d";
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.45);
    ctx.lineTo(x - s * 0.35, y - s * 0.1);
    ctx.moveTo(x, y - s * 0.45);
    ctx.lineTo(x + s * 0.3, y - s * 0.12);
    ctx.stroke();
  },
  raptor(ctx, x, y, s) {
    dino(ctx, x, y, s * 0.85, { body: "#b5613a", dark: "#7a3d24", neck: 0.6, head: 0.34 });
  },
  stego(ctx, x, y, s) {
    dino(ctx, x, y, s, { body: "#6f9e4e", dark: "#3e5a2c", neck: 0.25, head: 0.3, lowHead: true });
    // Back plates.
    ctx.fillStyle = "#4e7a36";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * s * 0.22, y - s * 0.7);
      ctx.lineTo(x + i * s * 0.22 - s * 0.1, y - s * 0.95);
      ctx.lineTo(x + i * s * 0.22 + s * 0.1, y - s * 0.95);
      ctx.closePath();
      ctx.fill();
    }
  },
  trike(ctx, x, y, s) {
    dino(ctx, x, y, s, { body: "#7d8a5a", dark: "#4a5436", neck: 0.35, head: 0.4, lowHead: true });
    // Frill + horns at head (head sits front-left around x-s*0.7).
    const hx = x - s * 0.8, hy = y - s * 0.7;
    ctx.fillStyle = "#9aa46e";
    ctx.beginPath();
    ctx.arc(hx + s * 0.1, hy, s * 0.28, Math.PI * 0.4, Math.PI * 1.6);
    ctx.fill();
    ctx.strokeStyle = "#e8e0c0";
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.05, hy - s * 0.1);
    ctx.lineTo(hx - s * 0.3, hy - s * 0.3);
    ctx.moveTo(hx, hy + s * 0.05);
    ctx.lineTo(hx - s * 0.28, hy - s * 0.02);
    ctx.stroke();
  },
  bronto(ctx, x, y, s) {
    const c = "#6f86a8", d = "#46566f";
    // Body.
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.55, s * 0.6, s * 0.4, 0, 0, TAU);
    ctx.fill();
    // Legs.
    ctx.fillStyle = d;
    for (const lx of [-0.4, -0.15, 0.15, 0.4]) ctx.fillRect(x + lx * s - s * 0.06, y - s * 0.3, s * 0.12, s * 0.3);
    // Long neck + tail.
    ctx.strokeStyle = c;
    ctx.lineWidth = s * 0.22;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y - s * 0.5);
    ctx.quadraticCurveTo(x - s * 1.1, y - s * 0.9, x - s * 1.1, y - s * 1.5);
    ctx.stroke();
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.55, y - s * 0.55);
    ctx.quadraticCurveTo(x + s * 1.2, y - s * 0.4, x + s * 1.4, y - s * 0.7);
    ctx.stroke();
    // Head.
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x - s * 1.1, y - s * 1.55, s * 0.16, s * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1c2530";
    ctx.beginPath();
    ctx.arc(x - s * 1.18, y - s * 1.58, s * 0.03, 0, TAU);
    ctx.fill();
  },
  trex(ctx, x, y, s) {
    const c = "#7a8a4a", d = "#4a5630";
    // Legs.
    ctx.fillStyle = d;
    ctx.fillRect(x - s * 0.05, y - s * 0.5, s * 0.18, s * 0.5);
    ctx.fillRect(x - s * 0.32, y - s * 0.45, s * 0.16, s * 0.45);
    // Tail.
    ctx.strokeStyle = c;
    ctx.lineWidth = s * 0.18;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + s * 0.1, y - s * 0.6);
    ctx.quadraticCurveTo(x + s * 0.9, y - s * 0.45, x + s * 1.1, y - s * 0.15);
    ctx.stroke();
    // Body.
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.8, s * 0.4, s * 0.5, 0, 0, TAU);
    ctx.fill();
    // Head.
    ctx.beginPath();
    ctx.ellipse(x - s * 0.4, y - s * 1.2, s * 0.34, s * 0.24, -0.2, 0, TAU);
    ctx.fill();
    // Jaw.
    ctx.fillStyle = d;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.7, y - s * 1.12);
    ctx.lineTo(x - s * 0.7, y - s * 1.0);
    ctx.lineTo(x - s * 0.3, y - s * 1.05);
    ctx.closePath();
    ctx.fill();
    // Tiny arm.
    ctx.strokeStyle = c;
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.15, y - s * 0.75);
    ctx.lineTo(x - s * 0.28, y - s * 0.6);
    ctx.stroke();
    // Eye.
    ctx.fillStyle = "#1c2510";
    ctx.beginPath();
    ctx.arc(x - s * 0.5, y - s * 1.25, s * 0.04, 0, TAU);
    ctx.fill();
  },
};

// Generic four-legged-ish dino body used by raptor/stego/trike.
function dino(ctx, x, y, s, { body, dark, neck = 0.4, head = 0.34, lowHead = false }) {
  ctx.fillStyle = dark;
  for (const lx of [-0.35, -0.1, 0.15, 0.4]) ctx.fillRect(x + lx * s - s * 0.05, y - s * 0.35, s * 0.1, s * 0.35);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.55, s * 0.55, s * 0.32, 0, 0, TAU);
  ctx.fill();
  // Tail.
  ctx.strokeStyle = body;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + s * 0.45, y - s * 0.55);
  ctx.quadraticCurveTo(x + s * 0.95, y - s * 0.5, x + s * 1.05, y - s * 0.25);
  ctx.stroke();
  // Neck + head to the left.
  const hy = lowHead ? y - s * 0.6 : y - s * 1.0;
  ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.45, y - s * 0.55);
  ctx.lineTo(x - s * 0.75, hy);
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x - s * 0.8, hy, s * head * 0.6, s * head * 0.45, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#1c2510";
  ctx.beginPath();
  ctx.arc(x - s * 0.88, hy - s * 0.04, s * 0.035, 0, TAU);
  ctx.fill();
}
