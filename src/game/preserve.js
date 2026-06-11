// PreserveScene — a cozy build-your-own prehistoric diorama. The player spends
// DNA to place flora, terrain and dinosaurs on a daytime Cretaceous landscape,
// then drags them around. Items are stored in normalised (0..1) coords so a
// preserve looks the same at any window size. Rendering is sorted back-to-front
// for a sense of depth.

const TAU = Math.PI * 2;

// Ground band the items live on (normalised y).
const GROUND_TOP = 0.4;
const GROUND_BOT = 0.95;

export class PreserveScene {
  constructor(canvas, { items = [], onPlace, onChange, onSelect } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.items = items.map((it) => ({ ...it }));
    this.onPlace = onPlace;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.placingKey = null; // catalog key currently being placed
    this.selected = -1;
    this.dragging = false;
    this.mouse = { x: 0, y: 0, inside: false };
    this.t = 0;
    this.clouds = [];

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
    const u = Math.min(this.w, this.h) * 0.12;
    return u * (0.55 + ((y - GROUND_TOP) / (GROUND_BOT - GROUND_TOP)) * 0.85);
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
      this.clouds.push({ x: Math.random() * this.w, y: this.h * (0.08 + Math.random() * 0.2), s: 30 + Math.random() * 50, v: 6 + Math.random() * 10 });
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

    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#7fb6e6");
    sky.addColorStop(1, "#dcebc0");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);

    // Sun + glow.
    const sx = W * 0.82, sy = H * 0.16;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 130);
    sg.addColorStop(0, "rgba(255,245,200,0.95)");
    sg.addColorStop(1, "rgba(255,245,200,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, horizon);
    ctx.fillStyle = "#fff6cf";
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, TAU);
    ctx.fill();

    // Clouds.
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const cl of this.clouds) this.cloud(cl.x, cl.y, cl.s);

    // Distant hills + a calm volcano.
    this.hills(horizon);

    // Ground.
    const gnd = ctx.createLinearGradient(0, horizon, 0, H);
    gnd.addColorStop(0, "#7fb255");
    gnd.addColorStop(1, "#4c7a34");
    ctx.fillStyle = gnd;
    ctx.fillRect(0, horizon, W, H - horizon);
    // Soft horizon seam.
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, horizon - 1, W, 3);

    // Items, back to front.
    const order = this.items
      .map((_, i) => i)
      .sort((a, b) => this.items[a].y - this.items[b].y);
    for (const i of order) {
      const it = this.items[i];
      const x = it.x * W;
      const y = it.y * H;
      const s = this.scaleFor(it.y);
      this.shadow(x, y, s);
      const fn = DRAW[it.k];
      if (fn) fn(ctx, x, y, s, this.t);
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

  hills(horizon) {
    const { ctx } = this;
    const W = this.w;
    ctx.fillStyle = "#9cc06a";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= W; x += 50) {
      ctx.lineTo(x, horizon - (Math.sin(x * 0.01) * 0.5 + 0.5) * horizon * 0.12 - 6);
    }
    ctx.lineTo(W, horizon);
    ctx.closePath();
    ctx.fill();
    // Volcano on the right.
    const vx = W * 0.7, vh = horizon * 0.42;
    ctx.fillStyle = "#6f7f55";
    ctx.beginPath();
    ctx.moveTo(vx - vh, horizon);
    ctx.lineTo(vx - vh * 0.22, horizon - vh);
    ctx.lineTo(vx + vh * 0.22, horizon - vh);
    ctx.lineTo(vx + vh, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(120,120,120,0.5)";
    ctx.beginPath();
    ctx.ellipse(vx, horizon - vh, vh * 0.22, vh * 0.05, 0, 0, TAU);
    ctx.fill();
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
