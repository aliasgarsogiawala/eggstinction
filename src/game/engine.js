// EggDefense — canvas tower-defense engine.
// Egg in the center, a turret on the egg aims at the cursor, hold to fire.
// Sperm swarm in from the screen edges; one touch on the egg = FERTILIZED.

const TAU = Math.PI * 2;

export class EggDefense {
  constructor(canvas, { onFertilized, onKill } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onFertilized = onFertilized;
    this.onKill = onKill;

    this.mouse = { x: 0, y: 0, down: false };
    this.reset();

    this._onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
    };
    this._onDown = (e) => {
      this.mouse.down = true;
      this._onMove(e);
    };
    this._onUp = () => (this.mouse.down = false);

    canvas.addEventListener("pointermove", this._onMove);
    canvas.addEventListener("pointerdown", this._onDown);
    window.addEventListener("pointerup", this._onUp);
  }

  reset() {
    this.sperms = [];
    this.bullets = [];
    this.particles = [];
    this.kills = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.fireTimer = 0;
    this.shake = 0;
    this.over = false;
    this.fertilizedAt = null;
  }

  start() {
    this.reset();
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
    this.canvas.removeEventListener("pointermove", this._onMove);
    this.canvas.removeEventListener("pointerdown", this._onDown);
    window.removeEventListener("pointerup", this._onUp);
  }

  get center() {
    return { x: this.canvas.width / 2, y: this.canvas.height / 2 };
  }
  get eggR() {
    return Math.min(this.canvas.width, this.canvas.height) * 0.09;
  }

  // ---------------- update ----------------
  update(dt) {
    this.elapsed += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    if (this.over) {
      // Let the FERTILIZED drama play out, then hand off to React.
      this.updateParticles(dt);
      if (performance.now() - this.fertilizedAt > 1400) {
        this.stop();
        this.onFertilized?.({ kills: this.kills, time: this.elapsed });
      }
      return;
    }

    // Difficulty ramp: spawn faster + swim faster over time.
    const spawnEvery = Math.max(0.12, 0.9 - this.elapsed * 0.022);
    this.spawnTimer += dt;
    while (this.spawnTimer > spawnEvery) {
      this.spawnTimer -= spawnEvery;
      this.spawnSperm();
    }

    // Turret fire (hold mouse).
    this.fireTimer -= dt;
    if (this.mouse.down && this.fireTimer <= 0) {
      this.fireTimer = 0.09;
      this.fire();
    }

    const c = this.center;
    // Sperm start sluggish and accelerate hard the longer the egg survives.
    const speedMul = 1 + this.elapsed * 0.05;

    // Sperm seek the egg with a wiggle.
    for (const s of this.sperms) {
      const dx = c.x - s.x;
      const dy = c.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      s.phase += dt * 14;
      const wob = Math.sin(s.phase) * 60;
      s.x += ((dx / d) * s.speed * speedMul + (-dy / d) * wob * 0.4) * dt;
      s.y += ((dy / d) * s.speed * speedMul + (dx / d) * wob * 0.4) * dt;
      s.angle = Math.atan2(c.y - s.y, c.x - s.x);

      if (d < this.eggR + s.r) {
        this.fertilize();
        return;
      }
    }

    // Bullets.
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    this.bullets = this.bullets.filter(
      (b) =>
        b.life > 0 &&
        b.x > -20 && b.x < this.canvas.width + 20 &&
        b.y > -20 && b.y < this.canvas.height + 20
    );

    // Collisions.
    for (const b of this.bullets) {
      for (const s of this.sperms) {
        if (!s.dead && Math.hypot(b.x - s.x, b.y - s.y) < s.r + b.r) {
          s.dead = true;
          b.life = 0;
          this.kills++;
          this.shake = Math.min(this.shake + 1.2, 4);
          this.burst(s.x, s.y, "#ff6b9d");
          this.onKill?.(this.kills);
        }
      }
    }
    this.sperms = this.sperms.filter((s) => !s.dead);

    this.updateParticles(dt);
  }

  spawnSperm() {
    const w = this.canvas.width, h = this.canvas.height;
    const side = Math.floor(Math.random() * 4);
    const pos =
      side === 0 ? { x: Math.random() * w, y: -20 } :
      side === 1 ? { x: w + 20, y: Math.random() * h } :
      side === 2 ? { x: Math.random() * w, y: h + 20 } :
                   { x: -20, y: Math.random() * h };
    this.sperms.push({
      ...pos,
      r: 11 + Math.random() * 5,
      // Slow crawlers at the start; combined with the time-based speedMul they
      // ramp up to a frantic swarm.
      speed: 26 + Math.random() * 22,
      phase: Math.random() * TAU,
      angle: 0,
      dead: false,
    });
  }

  fire() {
    const c = this.center;
    const a = Math.atan2(this.mouse.y - c.y, this.mouse.x - c.x);
    const spread = (Math.random() - 0.5) * 0.12;
    const speed = 620;
    const muzzle = this.eggR + 18;
    this.bullets.push({
      x: c.x + Math.cos(a + spread) * muzzle,
      y: c.y + Math.sin(a + spread) * muzzle,
      vx: Math.cos(a + spread) * speed,
      vy: Math.sin(a + spread) * speed,
      r: 6,
      life: 1.2,
    });
    this.shake = Math.min(this.shake + 0.25, 2);
  }

  fertilize() {
    this.over = true;
    this.fertilizedAt = performance.now();
    this.shake = 18;
    const c = this.center;
    this.burst(c.x, c.y, "#ffd166", 60);
    this.burst(c.x, c.y, "#ff6b9d", 40);
    // Drop the swarm + bullets so the FERTILIZED drama doesn't keep
    // simulating/drawing a huge late-game crowd every frame (was lagging).
    this.sperms = [];
    this.bullets = [];
  }

  burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 60 + Math.random() * 240;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        r: 2 + Math.random() * 4,
        color,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ---------------- draw ----------------
  draw() {
    const { ctx, canvas } = this;
    const c = this.center;

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake * 2,
        (Math.random() - 0.5) * this.shake * 2
      );
    }

    // Background.
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, canvas.width * 0.7);
    g.addColorStop(0, "#3d2b56");
    g.addColorStop(1, "#1d1233");
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, canvas.width + 60, canvas.height + 60);

    // Danger ring.
    ctx.beginPath();
    ctx.arc(c.x, c.y, this.eggR + 26, 0, TAU);
    ctx.strokeStyle = "rgba(255,107,157,0.25)";
    ctx.setLineDash([10, 12]);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);

    this.drawEgg(c);
    this.drawTurret(c);

    for (const s of this.sperms) this.drawSperm(s);

    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fillStyle = "#ffe66d";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.over) {
      ctx.fillStyle = "rgba(255, 209, 102, 0.18)";
      ctx.fillRect(-30, -30, canvas.width + 60, canvas.height + 60);
    }
    ctx.restore();
  }

  drawEgg(c) {
    const { ctx } = this;
    const r = this.eggR;
    const breathe = 1 + Math.sin(this.elapsed * 3) * 0.025;
    const rx = r * 0.92;
    const ry = r * 1.08;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(breathe, breathe);

    // Soft outer glow.
    const glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.5);
    glow.addColorStop(0, "rgba(255, 230, 109, 0.30)");
    glow.addColorStop(1, "rgba(255, 230, 109, 0)");
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, TAU);
    ctx.fillStyle = glow;
    ctx.fill();

    // Contact shadow under the egg.
    ctx.beginPath();
    ctx.ellipse(0, ry * 0.95, rx * 0.8, r * 0.16, 0, 0, TAU);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fill();

    // Shell body — shaded with a top-lit radial gradient.
    const body = ctx.createRadialGradient(
      -rx * 0.35, -ry * 0.45, r * 0.1,
      0, 0, ry * 1.05
    );
    body.addColorStop(0, "#fffdf6");
    body.addColorStop(0.55, "#fff1cf");
    body.addColorStop(1, "#e8c074");
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#d8a94f";
    ctx.stroke();

    // Freckle speckles for a real-eggshell feel.
    ctx.fillStyle = "rgba(200, 150, 70, 0.35)";
    const speckles = [
      [-0.35, 0.25, 0.05], [0.4, 0.05, 0.04], [-0.15, 0.55, 0.045],
      [0.25, 0.5, 0.035], [-0.45, -0.1, 0.035], [0.1, -0.5, 0.04],
    ];
    for (const [sx, sy, sr] of speckles) {
      ctx.beginPath();
      ctx.arc(sx * rx, sy * ry, sr * r, 0, TAU);
      ctx.fill();
    }

    // Glossy specular highlight, top-left.
    ctx.beginPath();
    ctx.ellipse(-rx * 0.34, -ry * 0.42, rx * 0.26, ry * 0.34, -0.5, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();

    // ---- face ----
    const look = this.over ? 0 : Math.sin(this.elapsed * 2) * 2.5;
    const eyeY = -ry * 0.08;
    const eyeX = rx * 0.3;
    const eyeR = r * 0.13;

    // Worried eyebrows.
    ctx.strokeStyle = "#3d2b56";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const browTilt = this.over ? 0.5 : 0.28;
    ctx.beginPath();
    ctx.moveTo(-eyeX - eyeR, eyeY - eyeR * 1.9);
    ctx.lineTo(-eyeX + eyeR, eyeY - eyeR * (1.9 - browTilt));
    ctx.moveTo(eyeX + eyeR, eyeY - eyeR * 1.9);
    ctx.lineTo(eyeX - eyeR, eyeY - eyeR * (1.9 - browTilt));
    ctx.stroke();

    // Eye whites + pupils that track the cursor a touch.
    for (const sign of [-1, 1]) {
      const ex = sign * eyeX;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeR, eyeR * 1.15, 0, 0, TAU);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#caa86a";
      ctx.stroke();
      // Pupil.
      ctx.beginPath();
      ctx.arc(ex + look, eyeY + eyeR * 0.18, eyeR * 0.5, 0, TAU);
      ctx.fillStyle = "#2d2150";
      ctx.fill();
      // Catchlight.
      ctx.beginPath();
      ctx.arc(ex + look - eyeR * 0.18, eyeY - eyeR * 0.02, eyeR * 0.16, 0, TAU);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }

    // Blush cheeks.
    ctx.fillStyle = "rgba(255, 122, 158, 0.35)";
    ctx.beginPath();
    ctx.arc(-eyeX - eyeR * 0.4, eyeY + eyeR * 1.7, eyeR * 0.7, 0, TAU);
    ctx.arc(eyeX + eyeR * 0.4, eyeY + eyeR * 1.7, eyeR * 0.7, 0, TAU);
    ctx.fill();

    // Mouth — small frown that becomes a shocked "O" on fertilization.
    ctx.strokeStyle = "#3d2b56";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (this.over) {
      ctx.arc(0, ry * 0.42, r * 0.16, 0, TAU);
      ctx.fillStyle = "#6b3b5a";
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.arc(0, ry * 0.55, r * 0.16, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTurret(c) {
    const { ctx } = this;
    const a = Math.atan2(this.mouse.y - c.y, this.mouse.x - c.x);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(a);
    // Barrel.
    ctx.fillStyle = "#5e60ce";
    ctx.strokeStyle = "#2d2a55";
    ctx.lineWidth = 3;
    const len = this.eggR + 22;
    ctx.beginPath();
    ctx.roundRect(this.eggR * 0.4, -8, len - this.eggR * 0.4, 16, 8);
    ctx.fill();
    ctx.stroke();
    // Muzzle tip.
    ctx.beginPath();
    ctx.arc(len, 0, 7, 0, TAU);
    ctx.fillStyle = "#ffe66d";
    ctx.fill();
    ctx.restore();
  }

  drawSperm(s) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    // Tail (wiggly).
    ctx.beginPath();
    ctx.moveTo(-s.r * 0.6, 0);
    for (let i = 1; i <= 4; i++) {
      const t = i / 4;
      ctx.lineTo(
        -s.r * 0.6 - t * s.r * 2.4,
        Math.sin(s.phase + i * 1.6) * s.r * 0.55
      );
    }
    ctx.strokeStyle = "#cdeafe";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    // Head.
    ctx.beginPath();
    ctx.ellipse(0, 0, s.r, s.r * 0.75, 0, 0, TAU);
    ctx.fillStyle = "#eaf6ff";
    ctx.fill();
    ctx.strokeStyle = "#9bc8ec";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Determined little eyes.
    ctx.fillStyle = "#2d2a55";
    ctx.beginPath();
    ctx.arc(s.r * 0.35, -s.r * 0.18, 1.8, 0, TAU);
    ctx.arc(s.r * 0.35, s.r * 0.18, 1.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
