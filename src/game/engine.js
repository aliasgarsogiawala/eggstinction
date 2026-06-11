// EggDefense — canvas tower-defense engine (EGGSTINCTION).
// A dino egg sits in a nest; a catapult on it aims at the cursor, hold to hurl.
// Predators swarm in from the screen edges; one touch on the egg = HATCHING.

const TAU = Math.PI * 2;

export class EggDefense {
  constructor(canvas, { onFertilized, onKill } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onFertilized = onFertilized;
    this.onKill = onKill;
    this.paused = false;

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
    this.shield = false; // gained by activating an Egg Shield charge
    this.shieldFlash = 0;
    // Active timed buffs (seconds remaining), set by activate().
    this.buffs = { rapidfire: 0, tripleshot: 0, slowfield: 0, pierce: 0 };
    this.timeScale = 1; // slow-mo factor applied to swimmer movement
    // Atmospheric layer (cosmetic): drifting ash, sky meteors, lightning.
    this.ambient = [];
    this.skyMeteors = [];
    this.flash = 0;
    this.meteorTimer = 2.5 + Math.random() * 4;
    this.lightTimer = 7 + Math.random() * 8;
  }

  // Drifting ash, the occasional meteor streak, and distant lightning. Runs
  // even through the hatching drama so the world always feels alive.
  updateAtmosphere(dt) {
    const w = this.canvas.width, h = this.canvas.height;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);

    if (Math.random() < dt * 7 && this.ambient.length < 70) {
      this.ambient.push({
        x: Math.random() * w,
        y: -10,
        vx: -14 + Math.random() * 34,
        vy: 16 + Math.random() * 30,
        r: 0.8 + Math.random() * 2,
        sway: Math.random() * TAU,
        life: 8 + Math.random() * 8,
      });
    }
    for (const a of this.ambient) {
      a.sway += dt;
      a.x += (a.vx + Math.sin(a.sway) * 7) * dt;
      a.y += a.vy * dt;
      a.life -= dt;
    }
    this.ambient = this.ambient.filter((a) => a.y < h + 10 && a.life > 0);

    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0) {
      this.meteorTimer = 3 + Math.random() * 5;
      this.skyMeteors.push({
        x: Math.random() * w * 0.8,
        y: -30,
        vx: 200 + Math.random() * 220,
        vy: 280 + Math.random() * 220,
        trail: [],
        life: 2.2,
      });
    }
    for (const m of this.skyMeteors) {
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 10) m.trail.shift();
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
    }
    this.skyMeteors = this.skyMeteors.filter((m) => m.life > 0 && m.y < h + 30);

    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 8 + Math.random() * 10;
      this.flash = 0.4 + Math.random() * 0.3;
    }
  }

  ensureGround() {
    const w = this.canvas.width, h = this.canvas.height;
    if (this.ground && this.ground.w === w && this.ground.h === h) return;
    const rocks = [];
    const n = Math.round((w * h) / 24000);
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      // Keep the nest area clear.
      if (Math.hypot(x - cx, y - cy) < this.eggR * 1.6) continue;
      rocks.push({ x, y, r: 2 + Math.random() * 6, a: Math.random() * TAU, light: Math.random() < 0.4 });
    }
    this.ground = { w, h, rocks };
  }

  setPaused(p) {
    this.paused = p;
  }

  // Consume a powerup charge mid-run. Buffs are timed; shield is a one-hit guard.
  activate(key) {
    if (this.over) return;
    const DURATIONS = { rapidfire: 8, tripleshot: 8, slowfield: 6, pierce: 8 };
    if (key === "shield") {
      this.shield = true;
      this.shieldFlash = 0.6;
      return;
    }
    if (key in this.buffs) {
      // Re-activating refreshes (doesn't stack) the duration.
      this.buffs[key] = DURATIONS[key];
    }
  }

  start() {
    this.reset();
    this.running = true;
    this.last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min((t - this.last) / 1000, 0.05);
      this.last = t;
      if (!this.paused) this.update(dt);
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
    this.updateAtmosphere(dt);

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

    if (this.shieldFlash > 0) this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    // Tick down active buff timers.
    for (const k in this.buffs) {
      if (this.buffs[k] > 0) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    }

    // Turret fire (hold mouse). Rapid Fire shortens the cooldown.
    this.fireTimer -= dt;
    if (this.mouse.down && this.fireTimer <= 0) {
      this.fireTimer = this.buffs.rapidfire > 0 ? 0.05 : 0.09;
      this.fire();
    }

    const c = this.center;
    // Swimmers start sluggish and accelerate hard the longer the egg survives.
    // Slow Field knocks them to 40% speed for its duration.
    let speedMul = 1 + this.elapsed * 0.05;
    if (this.buffs.slowfield > 0) speedMul *= 0.4;

    // Slow-mo on near-miss: when the closest swimmer is about to touch the egg,
    // time dilates so you can pull off the clutch save.
    let nearest = Infinity;
    for (const s of this.sperms) {
      const edge = Math.hypot(c.x - s.x, c.y - s.y) - this.eggR - s.r;
      if (edge < nearest) nearest = edge;
    }
    const SLOWMO_RANGE = 70;
    const target =
      nearest < SLOWMO_RANGE ? 0.3 + 0.7 * (Math.max(0, nearest) / SLOWMO_RANGE) : 1;
    // Snap into slow-mo quickly, ease back out smoothly.
    const ease = target < this.timeScale ? 0.3 : 0.08;
    this.timeScale += (target - this.timeScale) * ease;
    const ts = this.timeScale;

    // Swimmers seek the egg with a wiggle (slowed by slow-mo).
    for (const s of this.sperms) {
      const dx = c.x - s.x;
      const dy = c.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      s.phase += dt * 14 * ts;
      const wob = Math.sin(s.phase) * 60;
      s.x += ((dx / d) * s.speed * speedMul + (-dy / d) * wob * 0.4) * dt * ts;
      s.y += ((dy / d) * s.speed * speedMul + (dx / d) * wob * 0.4) * dt * ts;
      s.angle = Math.atan2(c.y - s.y, c.x - s.x);

      if (d < this.eggR + s.r) {
        if (this.shield) {
          // Egg Shield absorbs the hit and blasts the whole swarm away.
          this.consumeShield();
          break;
        }
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
          // Piercing Rounds keep going; normal bullets die on impact.
          if (this.buffs.pierce <= 0) b.life = 0;
          this.kills++;
          this.shake = Math.min(this.shake + 1.2, 4);
          this.burst(s.x, s.y, "#9ad14f");
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
    const speed = 620;
    const muzzle = this.eggR + 18;
    // Triple Shot fans three bullets; otherwise one with a touch of spray.
    const angles = this.buffs.tripleshot > 0
      ? [a - 0.18, a, a + 0.18]
      : [a + (Math.random() - 0.5) * 0.12];
    for (const ang of angles) {
      this.bullets.push({
        x: c.x + Math.cos(ang) * muzzle,
        y: c.y + Math.sin(ang) * muzzle,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        r: 6,
        life: 1.2,
      });
    }
    this.shake = Math.min(this.shake + 0.25, 2);
  }

  consumeShield() {
    this.shield = false;
    this.shieldFlash = 0.6;
    this.shake = Math.min(this.shake + 6, 8);
    const c = this.center;
    this.burst(c.x, c.y, "#ffc861", 50);
    // Blow every current predator off the board.
    for (const s of this.sperms) this.burst(s.x, s.y, "#ffe6a8", 5);
    this.sperms = [];
  }

  fertilize() {
    this.over = true;
    this.fertilizedAt = performance.now();
    this.timeScale = 1;
    this.shake = 18;
    const c = this.center;
    this.burst(c.x, c.y, "#ffae57", 60);
    this.burst(c.x, c.y, "#c0563b", 40);
    // Drop the swarm + bullets so the HATCHING drama doesn't keep
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

    // Background — warm volcanic jungle floor.
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, canvas.width * 0.7);
    g.addColorStop(0, "#33402a");
    g.addColorStop(1, "#0e140c");
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, canvas.width + 60, canvas.height + 60);

    // --- ground texture + atmosphere (behind the action) ---
    this.ensureGround();
    for (const rk of this.ground.rocks) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = rk.light ? "#2c3a24" : "#0a1209";
      ctx.beginPath();
      ctx.ellipse(rk.x, rk.y, rk.r, rk.r * 0.55, rk.a, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Sky meteors streaking across the arena.
    for (const m of this.skyMeteors) {
      if (m.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(m.trail[0].x, m.trail[0].y);
        for (const p of m.trail) ctx.lineTo(p.x, p.y);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = "rgba(255,200,130,0.40)";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2.5, 0, TAU);
      ctx.fillStyle = "#fff1c8";
      ctx.fill();
    }

    // Drifting ash.
    ctx.fillStyle = "#b9b3a8";
    for (const a of this.ambient) {
      ctx.globalAlpha = Math.min(0.4, a.life / 6);
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Distant lightning flash.
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(200,220,255,${this.flash * 0.14})`;
      ctx.fillRect(-30, -30, canvas.width + 60, canvas.height + 60);
    }

    // Slow-mo vignette — cool blue edges + a label when time dilates.
    if (this.timeScale < 0.92 && !this.over) {
      const amt = (0.92 - this.timeScale) / 0.62; // 0..1
      const vg = ctx.createRadialGradient(
        c.x, c.y, canvas.height * 0.25,
        c.x, c.y, canvas.width * 0.75
      );
      vg.addColorStop(0, "rgba(90, 180, 255, 0)");
      vg.addColorStop(1, `rgba(90, 180, 255, ${0.35 * amt})`);
      ctx.fillStyle = vg;
      ctx.fillRect(-30, -30, canvas.width + 60, canvas.height + 60);

      ctx.save();
      ctx.globalAlpha = amt;
      ctx.fillStyle = "#bfe3ff";
      ctx.font = "900 18px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("◇ PRIMAL INSTINCT ◇", c.x, 34);
      ctx.restore();
    }

    // Nest boundary ring.
    ctx.beginPath();
    ctx.arc(c.x, c.y, this.eggR + 26, 0, TAU);
    ctx.strokeStyle = "rgba(150,100,55,0.30)";
    ctx.setLineDash([10, 12]);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);

    this.drawEgg(c);
    this.drawTurret(c);
    if (this.shield || this.shieldFlash > 0) this.drawShield(c);

    // Ground shadows give the raptors + boulders a sense of height.
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    for (const s of this.sperms) {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + s.r * 0.7, s.r * 0.95, s.r * 0.42, 0, 0, TAU);
      ctx.fill();
    }
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + b.r * 0.9, b.r * 1.1, b.r * 0.5, 0, 0, TAU);
      ctx.fill();
    }

    for (const s of this.sperms) this.drawSperm(s);

    for (const b of this.bullets) {
      // Hurled boulders.
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fillStyle = "#b9a47e";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.45, 0, TAU);
      ctx.fillStyle = "#e9ddc4";
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

    // Edge vignette — sinks the arena into a shadowed bowl for depth.
    const vig = ctx.createRadialGradient(
      c.x, c.y, Math.min(canvas.width, canvas.height) * 0.26,
      c.x, c.y, Math.max(canvas.width, canvas.height) * 0.72
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(-30, -30, canvas.width + 60, canvas.height + 60);

    if (this.over) {
      ctx.fillStyle = "rgba(255, 170, 87, 0.18)";
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
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fill();

    // Twiggy nest cradling the egg's lower half.
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const ang = Math.PI * (0.08 + (i / 15) * 0.84);
      const nx = Math.cos(ang) * rx * 1.06;
      const ny = Math.sin(ang) * ry * 0.99;
      ctx.strokeStyle = i % 2 ? "#7a5430" : "#5e3f22";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(nx - 10, ny + 2);
      ctx.lineTo(nx + 10, ny - 2);
      ctx.stroke();
    }
    ctx.restore();

    // Shell body — mossy dino egg, top-lit radial gradient.
    const body = ctx.createRadialGradient(
      -rx * 0.35, -ry * 0.45, r * 0.1,
      0, 0, ry * 1.05
    );
    body.addColorStop(0, "#eef8d8");
    body.addColorStop(0.55, "#c2dd8c");
    body.addColorStop(1, "#79a84d");
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#5d8838";
    ctx.stroke();

    // Mottled speckles for a real-eggshell feel.
    ctx.fillStyle = "rgba(60, 92, 34, 0.40)";
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
    ctx.strokeStyle = "#2c3a1f";
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
      ctx.strokeStyle = "#8fae66";
      ctx.stroke();
      // Pupil.
      ctx.beginPath();
      ctx.arc(ex + look, eyeY + eyeR * 0.18, eyeR * 0.5, 0, TAU);
      ctx.fillStyle = "#23301a";
      ctx.fill();
      // Catchlight.
      ctx.beginPath();
      ctx.arc(ex + look - eyeR * 0.18, eyeY - eyeR * 0.02, eyeR * 0.16, 0, TAU);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }

    // Blush cheeks.
    ctx.fillStyle = "rgba(255, 150, 90, 0.30)";
    ctx.beginPath();
    ctx.arc(-eyeX - eyeR * 0.4, eyeY + eyeR * 1.7, eyeR * 0.7, 0, TAU);
    ctx.arc(eyeX + eyeR * 0.4, eyeY + eyeR * 1.7, eyeR * 0.7, 0, TAU);
    ctx.fill();

    // Mouth — small frown that becomes a shocked "O" on fertilization.
    ctx.strokeStyle = "#2c3a1f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (this.over) {
      ctx.arc(0, ry * 0.42, r * 0.16, 0, TAU);
      ctx.fillStyle = "#5a3b2a";
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.arc(0, ry * 0.55, r * 0.16, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawShield(c) {
    const { ctx } = this;
    const pulse = this.shieldFlash > 0 ? 1 + (0.6 - this.shieldFlash) * 1.2 : 1;
    const r = (this.eggR + 16) * pulse;
    const alpha = this.shieldFlash > 0 ? this.shieldFlash / 0.6 : 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.strokeStyle = `rgba(255, 190, 90, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.fillStyle = `rgba(255, 190, 90, ${alpha * 0.14})`;
    ctx.fill();
    ctx.restore();
  }

  drawTurret(c) {
    const { ctx } = this;
    const a = Math.atan2(this.mouse.y - c.y, this.mouse.x - c.x);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(a);
    // Catapult arm (carved bone / stone).
    ctx.fillStyle = "#9a8c74";
    ctx.strokeStyle = "#3a3128";
    ctx.lineWidth = 3;
    const len = this.eggR + 22;
    ctx.beginPath();
    ctx.roundRect(this.eggR * 0.4, -8, len - this.eggR * 0.4, 16, 8);
    ctx.fill();
    ctx.stroke();
    // Boulder loaded at the tip.
    ctx.beginPath();
    ctx.arc(len, 0, 8, 0, TAU);
    ctx.fillStyle = "#b9a47e";
    ctx.fill();
    ctx.strokeStyle = "#6b5d45";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // A small predatory raptor, drawn facing its heading (+x = toward the nest).
  drawSperm(s) {
    const { ctx } = this;
    const r = s.r;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);

    const body = "#b5613a";
    const dark = "#7a3d24";

    // Wiggly tail trailing behind.
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0);
    for (let i = 1; i <= 4; i++) {
      const t = i / 4;
      ctx.lineTo(-r * 0.5 - t * r * 1.8, Math.sin(s.phase + i * 1.4) * r * 0.45 * t);
    }
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.32;
    ctx.lineCap = "round";
    ctx.stroke();

    // Scrambling legs.
    const legSwing = Math.sin(s.phase * 1.6) * r * 0.4;
    ctx.lineWidth = r * 0.18;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.4);
    ctx.lineTo(-r * 0.1 + legSwing, r * 0.95);
    ctx.moveTo(r * 0.25, r * 0.4);
    ctx.lineTo(r * 0.25 - legSwing, r * 0.95);
    ctx.stroke();

    // Spiny back ridge.
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      const bx = i * r * 0.42;
      ctx.moveTo(bx - r * 0.12, -r * 0.4);
      ctx.lineTo(bx, -r * 0.82);
      ctx.lineTo(bx + r * 0.12, -r * 0.4);
    }
    ctx.fill();

    // Body.
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.62, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Head + snapping jaw up front.
    ctx.beginPath();
    ctx.ellipse(r * 0.95, -r * 0.05, r * 0.55, r * 0.42, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.stroke();
    const gape = (Math.sin(s.phase * 2) * 0.5 + 0.5) * r * 0.32;
    ctx.fillStyle = "#3a1c12";
    ctx.beginPath();
    ctx.moveTo(r * 1.15, -r * 0.12);
    ctx.lineTo(r * 1.75, r * 0.05 + gape);
    ctx.lineTo(r * 1.15, r * 0.22 + gape * 0.3);
    ctx.closePath();
    ctx.fill();

    // Menacing slit eye.
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath();
    ctx.arc(r * 0.95, -r * 0.18, r * 0.17, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1c0e08";
    ctx.beginPath();
    ctx.arc(r * 1.0, -r * 0.18, r * 0.07, 0, TAU);
    ctx.fill();

    ctx.restore();
  }
}
