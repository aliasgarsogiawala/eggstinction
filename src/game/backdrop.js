// PrehistoricScene — an animated Late-Cretaceous (~65 mya) backdrop that lives
// behind the whole UI: a volcanic dusk sky, an erupting volcano, parallax
// jungle silhouettes, drifting ash & embers, and random disasters (meteor
// showers, lightning, pterosaur flyovers). Purely atmospheric — no gameplay.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export class PrehistoricScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.embers = [];
    this.ash = [];
    this.meteors = [];
    this.pteros = [];
    this.stars = [];
    this.flash = 0; // lightning flash alpha
    this.bolt = null;
    this.t = 0;
    this.glow = 0; // volcano eruption glow pulse
    this.meteorTimer = rand(1.5, 4);
    this.boltTimer = rand(4, 9);
    this.pteroTimer = rand(3, 7);
    this.eruptTimer = rand(6, 12);

    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = c.clientWidth || window.innerWidth;
    this.h = c.clientHeight || window.innerHeight;
    c.width = this.w * dpr;
    c.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.horizonY = this.h * 0.66;
    this.volcano = {
      x: this.w * 0.76,
      baseY: this.horizonY,
      w: Math.min(this.w * 0.4, 520),
      h: this.h * 0.34,
    };
    this.buildRidge();
    this.buildTrees();
    this.buildStars();
  }

  buildRidge() {
    // Precomputed once — drawing it with fresh randomness each frame is what
    // made the horizon shimmer like it was half-rendered.
    const pts = [];
    const step = 64;
    const base = this.horizonY * 0.9;
    for (let x = -step; x <= this.w + step; x += step) {
      const y =
        base -
        Math.abs(Math.sin(x * 0.006)) * this.horizonY * 0.12 -
        Math.abs(Math.sin(x * 0.017 + 1.3)) * this.horizonY * 0.05 -
        Math.random() * 8;
      pts.push({ x, y });
    }
    this.ridge = pts;
  }

  buildStars() {
    this.stars = [];
    const n = Math.round(this.w / 26);
    for (let i = 0; i < n; i++) {
      this.stars.push({
        x: rand(0, this.w),
        y: rand(0, this.horizonY * 0.85),
        r: rand(0.4, 1.4),
        tw: rand(0, TAU),
      });
    }
  }

  buildTrees() {
    const mk = (count, baseY, scale, color, types) => {
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          x: rand(-40, this.w + 40),
          baseY: baseY + rand(-8, 8),
          size: rand(0.75, 1.25) * scale,
          color,
          type: types[(Math.random() * types.length) | 0],
          flip: Math.random() < 0.5,
        });
      }
      return arr.sort((a, b) => a.size - b.size);
    };
    const ground = this.h - this.horizonY;
    this.treesFar = mk(Math.ceil(this.w / 150), this.horizonY, ground * 0.55, "#16271d", ["conifer", "cycad"]);
    this.treesMid = mk(Math.ceil(this.w / 200), this.horizonY + ground * 0.32, ground * 0.85, "#0d1a12", ["palm", "conifer"]);
    this.treesNear = mk(Math.ceil(this.w / 320), this.h + ground * 0.05, ground * 1.45, "#060d09", ["palm", "fern"]);
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min((t - this.last) / 1000, 0.05);
      this.last = t;
      this.update(dt);
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
    window.removeEventListener("resize", this._onResize);
  }

  // ---------------- update ----------------
  update(dt) {
    this.t += dt;
    if (this.glow > 0) this.glow = Math.max(0, this.glow - dt * 0.8);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);

    // Steady volcano smoke + embers.
    if (Math.random() < dt * 14) {
      this.embers.push({
        x: this.volcano.x + rand(-this.volcano.w * 0.06, this.volcano.w * 0.06),
        y: this.volcano.baseY - this.volcano.h + rand(-6, 6),
        vx: rand(-12, 22),
        vy: rand(-50, -90),
        life: rand(2.5, 5),
        r: rand(1, 2.6),
        smoke: Math.random() < 0.5,
      });
    }
    for (const e of this.embers) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy += 6 * dt; // buoyancy fade
      e.life -= dt;
    }
    this.embers = this.embers.filter((e) => e.life > 0);

    // Drifting ash everywhere.
    if (Math.random() < dt * 10 && this.ash.length < 140) {
      this.ash.push({
        x: rand(0, this.w),
        y: -10,
        vx: rand(-10, 18),
        vy: rand(14, 34),
        r: rand(0.8, 2.2),
        sway: rand(0, TAU),
        life: rand(8, 16),
      });
    }
    for (const a of this.ash) {
      a.sway += dt;
      a.x += (a.vx + Math.sin(a.sway) * 8) * dt;
      a.y += a.vy * dt;
      a.life -= dt;
    }
    this.ash = this.ash.filter((a) => a.y < this.h + 10 && a.life > 0);

    // Random eruption.
    this.eruptTimer -= dt;
    if (this.eruptTimer <= 0) {
      this.eruptTimer = rand(7, 16);
      this.glow = 1;
      for (let i = 0; i < 28; i++) {
        this.embers.push({
          x: this.volcano.x + rand(-12, 12),
          y: this.volcano.baseY - this.volcano.h,
          vx: rand(-90, 90),
          vy: rand(-120, -260),
          life: rand(1.6, 3.2),
          r: rand(1.5, 3.5),
          smoke: false,
        });
      }
    }

    // Meteor showers.
    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0) {
      this.meteorTimer = rand(2.5, 6);
      const fromX = rand(-0.1, 0.9) * this.w;
      this.meteors.push({
        x: fromX,
        y: -40,
        vx: rand(160, 280),
        vy: rand(260, 420),
        trail: [],
        life: 3,
        size: rand(1.6, 3.4),
      });
    }
    for (const m of this.meteors) {
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 14) m.trail.shift();
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
      if (!m.hit && m.y > this.horizonY - rand(0, 40)) {
        m.hit = true;
        this.glow = Math.max(this.glow, 0.6);
      }
    }
    this.meteors = this.meteors.filter((m) => m.life > 0 && m.y < this.h + 40);

    // Lightning.
    this.boltTimer -= dt;
    if (this.boltTimer <= 0) {
      this.boltTimer = rand(6, 14);
      this.flash = rand(0.5, 0.9);
      this.bolt = this.makeBolt(rand(this.w * 0.1, this.w * 0.6), this.horizonY * 0.92);
    }

    // Pterosaur flyovers.
    this.pteroTimer -= dt;
    if (this.pteroTimer <= 0) {
      this.pteroTimer = rand(5, 12);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.pteros.push({
        x: dir > 0 ? -40 : this.w + 40,
        y: rand(this.horizonY * 0.3, this.horizonY * 0.7),
        vx: dir * rand(60, 110),
        flap: rand(0, TAU),
        size: rand(10, 20),
      });
    }
    for (const p of this.pteros) {
      p.x += p.vx * dt;
      p.flap += dt * 6;
      p.y += Math.sin(p.flap * 0.5) * 6 * dt;
    }
    this.pteros = this.pteros.filter((p) => p.x > -60 && p.x < this.w + 60);
  }

  makeBolt(x, toY) {
    const pts = [{ x, y: 0 }];
    let cy = 0;
    let cx = x;
    while (cy < toY) {
      cy += rand(18, 42);
      cx += rand(-26, 26);
      pts.push({ x: cx, y: cy });
    }
    return pts;
  }

  // ---------------- draw ----------------
  draw() {
    const { ctx } = this;
    const W = this.w;
    const H = this.h;

    // Sky — volcanic dusk.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b1020");
    sky.addColorStop(0.45, "#2a2336");
    sky.addColorStop(0.66, "#6e3324");
    sky.addColorStop(0.8, "#3a1c14");
    sky.addColorStop(1, "#120b09");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Volcano backglow (pulses on eruption).
    const vg = ctx.createRadialGradient(
      this.volcano.x, this.volcano.baseY - this.volcano.h, 0,
      this.volcano.x, this.volcano.baseY - this.volcano.h, this.w * 0.5
    );
    const ga = 0.18 + this.glow * 0.4;
    vg.addColorStop(0, `rgba(255,120,40,${ga})`);
    vg.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Stars.
    for (const s of this.stars) {
      const a = 0.35 + Math.sin(this.t * 2 + s.tw) * 0.25;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "#cfe0ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Meteors (in the sky, behind silhouettes).
    for (const m of this.meteors) {
      if (m.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(m.trail[0].x, m.trail[0].y);
        for (const p of m.trail) ctx.lineTo(p.x, p.y);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = "rgba(255,200,130,0.55)";
        ctx.lineWidth = m.size;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size * 1.3, 0, TAU);
      ctx.fillStyle = "#fff1c8";
      ctx.fill();
    }

    // Lightning bolt + flash.
    if (this.bolt && this.flash > 0.05) {
      ctx.save();
      ctx.globalAlpha = this.flash;
      ctx.beginPath();
      ctx.moveTo(this.bolt[0].x, this.bolt[0].y);
      for (const p of this.bolt) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = "#dfe9ff";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#aaccff";
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();
    }

    // Distant mountains (static silhouette).
    this.drawMountains();

    // The volcano.
    this.drawVolcano();

    // Tree layers (back to front).
    for (const t of this.treesFar) this.drawTree(t);
    for (const t of this.treesMid) this.drawTree(t);

    // Pterosaurs glide between mid and foreground.
    for (const p of this.pteros) this.drawPtero(p);

    // Ground.
    const gnd = ctx.createLinearGradient(0, this.horizonY, 0, H);
    gnd.addColorStop(0, "#1a2417");
    gnd.addColorStop(1, "#070d07");
    ctx.fillStyle = gnd;
    ctx.fillRect(0, this.horizonY, W, H - this.horizonY);

    for (const t of this.treesNear) this.drawTree(t);

    // Embers (volcanic) over the scene.
    for (const e of this.embers) {
      const a = Math.min(1, e.life / 2);
      if (e.smoke) {
        ctx.globalAlpha = a * 0.25;
        ctx.fillStyle = "#5a5550";
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = "#ffb04a";
      }
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Drifting ash.
    ctx.fillStyle = "#b9b3a8";
    for (const a of this.ash) {
      ctx.globalAlpha = Math.min(0.5, a.life / 6);
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Lightning screen flash.
    if (this.flash > 0.05) {
      ctx.fillStyle = `rgba(200,220,255,${this.flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Vignette for depth.
    const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.95);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  drawMountains() {
    const { ctx } = this;
    ctx.fillStyle = "#161024";
    ctx.beginPath();
    ctx.moveTo(this.ridge[0].x, this.horizonY);
    for (const p of this.ridge) ctx.lineTo(p.x, p.y);
    ctx.lineTo(this.ridge[this.ridge.length - 1].x, this.horizonY);
    ctx.closePath();
    ctx.fill();
  }

  drawVolcano() {
    const { ctx } = this;
    const v = this.volcano;
    const topY = v.baseY - v.h;
    const topW = v.w * 0.18;
    // Cone.
    ctx.beginPath();
    ctx.moveTo(v.x - v.w / 2, v.baseY);
    ctx.lineTo(v.x - topW, topY);
    ctx.lineTo(v.x + topW, topY);
    ctx.lineTo(v.x + v.w / 2, v.baseY);
    ctx.closePath();
    ctx.fillStyle = "#100c10";
    ctx.fill();
    // Lava glow at the crater + running lava streaks.
    ctx.fillStyle = `rgba(255,110,40,${0.6 + this.glow * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(v.x, topY, topW * 0.9, v.h * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,90,30,${0.4 + this.glow * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(v.x - topW * 0.4, topY);
    ctx.lineTo(v.x - topW * 0.7, topY + v.h * 0.4);
    ctx.moveTo(v.x + topW * 0.3, topY);
    ctx.lineTo(v.x + topW * 0.6, topY + v.h * 0.55);
    ctx.stroke();
  }

  drawTree(t) {
    const { ctx } = this;
    const s = t.size;
    ctx.save();
    ctx.translate(t.x, t.baseY);
    if (t.flip) ctx.scale(-1, 1);
    ctx.fillStyle = t.color;
    ctx.strokeStyle = t.color;

    if (t.type === "conifer") {
      ctx.fillRect(-s * 0.03, -s * 0.12, s * 0.06, s * 0.14);
      for (let i = 0; i < 3; i++) {
        const ty = -s * 0.1 - i * s * 0.26;
        const tw = s * (0.42 - i * 0.1);
        ctx.beginPath();
        ctx.moveTo(0, ty - s * 0.46);
        ctx.lineTo(-tw, ty);
        ctx.lineTo(tw, ty);
        ctx.closePath();
        ctx.fill();
      }
    } else if (t.type === "palm") {
      ctx.lineCap = "round";
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.1, -s * 0.5, s * 0.04, -s * 0.85);
      ctx.stroke();
      const tx = s * 0.04;
      const ty = -s * 0.85;
      ctx.lineWidth = s * 0.04;
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + 0.2 + (i / 6) * (Math.PI - 0.4);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(
          tx + Math.cos(a) * s * 0.28,
          ty + Math.sin(a) * s * 0.28,
          tx + Math.cos(a) * s * 0.5,
          ty + Math.sin(a) * s * 0.5 + s * 0.12
        );
        ctx.stroke();
      }
    } else if (t.type === "cycad") {
      ctx.lineCap = "round";
      ctx.lineWidth = s * 0.035;
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.28;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.08);
        ctx.lineTo(Math.cos(a) * s * 0.4, -s * 0.08 + Math.sin(a) * s * 0.4);
        ctx.stroke();
      }
    } else {
      // fern — big drooping fronds (foreground).
      ctx.lineCap = "round";
      ctx.lineWidth = s * 0.04;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.32;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(a) * s * 0.3,
          -s * 0.5,
          Math.cos(a) * s * 0.7,
          -s * 0.3
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawPtero(p) {
    const { ctx } = this;
    const flap = Math.sin(p.flap) * 0.6;
    const dir = Math.sign(p.vx) || 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(dir, 1);
    ctx.strokeStyle = "#0a0f0c";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-p.size, flap * p.size);
    ctx.quadraticCurveTo(-p.size * 0.4, -p.size * 0.2, 0, 0);
    ctx.quadraticCurveTo(p.size * 0.4, -p.size * 0.2, p.size, flap * p.size);
    ctx.stroke();
    ctx.restore();
  }
}
