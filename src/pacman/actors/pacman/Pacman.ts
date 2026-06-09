import { Actor } from "../Actor.js";
import { eventBus } from "../../core/EventBus.js";
import type { Ghost } from "../ghost/Ghost.js";
import type { PacmanConfig } from "../../config/pacman.config.js";
import type { LevelContext } from "../../core/LevelContext.js";
import type { CanvasLayer } from "../../render/CanvasLayer.js";

// ── Types ───────────────────────────────────────────────────────
interface StellarParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: "DIAMOND" | "SPARK" | "RING";
  rotation: number;
  rotSpeed: number;
  active: boolean; // For allocation-free memory pools
}

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
  active: boolean;
}

interface SurfaceFlare {
  angle: number;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
}

// ── Palette (Unchanged to lock in your aesthetics) ───────────────
// ── Palette ─────────────────────────────────────────────────────
const BODY_NORMAL = "#2a2a7e";
const BODY_BUFFED = "#ddaa44";
const BODY_CORE_N = "#5555cc";
const BODY_CORE_B = "#ffeebb";
const BODY_EDGE_N = "rgba(120,160,255,0.8)";
const BODY_EDGE_B = "rgba(255,255,255,0.95)";
const MOUTH_INNER = "#ffffff";
const MOUTH_GRAD_N = "rgba(180,210,255,0.5)";
const MOUTH_GRAD_B = "rgba(255,245,210,0.7)";
const MOUTH_RIM_N = "rgba(200,225,255,0.85)"; // <--- Restored
const MOUTH_RIM_B = "#ffffff"; // <--- Restored
const TRAIL_CLR_N = "rgba(140,160,240,0.7)";
const TRAIL_CLR_B = "rgba(255,220,160,0.85)";
const TRAIL_SPARK_N = "rgba(180,210,255,0.8)";
const TRAIL_SPARK_B = "#ffffff";
const HEART_N = "rgba(200,220,255,0.7)";
const HEART_B = "rgba(255,245,210,0.95)";

export class Pacman extends Actor {
  private config: PacmanConfig;
  public state: "ALIVE" | "EATEN" | "DYING" = "ALIVE";
  public nextDirection: { dx: number; dy: number } | null = null;
  private lastDirection: { dx: number; dy: number } = { dx: 1, dy: 0 };
  private time = 0;

  // Optimized Object Reuse Pools
  private trail: TrailPoint[] = [];
  private particles: StellarParticle[] = [];
  private flares: SurfaceFlare[] = [];
  private ghostEatFlash = 0;
  private mouthStars: {
    angle: number;
    radius: number;
    phase: number;
    size: number;
  }[] = [];

  private normalSpeed: number;
  private buffedSpeed: number;

  // Offscreen Caching Layer
  private cacheCanvas!: HTMLCanvasElement;
  private cacheCtx!: CanvasRenderingContext2D;
  private cacheSize = 0;

  constructor(
    canvasLayer: CanvasLayer,
    levelContext: LevelContext,
    config: PacmanConfig,
  ) {
    super(canvasLayer, levelContext);
    this.config = config;
    this.normalSpeed = this.tileSize * config.normalSpeedMultiplier;
    this.buffedSpeed = this.tileSize * config.buffedSpeedMultiplier;
    this.speed = this.normalSpeed;
    this.r = this.tileSize * config.radiusMultiplier;

    // Preallocate pools to cap memory limits
    for (let i = 0; i < 200; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 0,
        type: "SPARK",
        rotation: 0,
        rotSpeed: 0,
        active: false,
      });
    }
    for (let i = 0; i < 14; i++) {
      this.trail.push({ x: 0, y: 0, alpha: 0, active: false });
    }
    for (let i = 0; i < 20; i++) {
      this.flares.push({
        angle: 0,
        life: 0,
        maxLife: 1,
        size: 0,
        active: false,
      });
    }

    for (let i = 0; i < 28; i++) {
      this.mouthStars.push({
        angle: Math.random() * Math.PI * 0.5 - Math.PI * 0.25,
        radius: 0.1 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
        size: 0.25 + Math.random() * 0.7,
      });
    }

    this.initCache();
  }

  private get isBuffed(): boolean {
    return this.gameState.isBuffed;
  }

  // ── Pre-Render Static Assets ──────────────────────────────────
  private initCache(): void {
    this.cacheSize = Math.ceil(this.r * 5); // Ensure headroom for glow leaks
    this.cacheCanvas = document.createElement("canvas");
    this.cacheCanvas.width = this.cacheSize * 2;
    this.cacheCanvas.height = this.cacheSize * 2;
    this.cacheCtx = this.cacheCanvas.getContext("2d")!;
    this.preRenderGradients();
  }

  private preRenderGradients(): void {
    const ctx = this.cacheCtx;
    const size = this.cacheSize;
    const r = this.r;

    ctx.clearRect(0, 0, this.cacheCanvas.width, this.cacheCanvas.height);

    // Cache [0]: Normal Ambient Glow
    ctx.save();
    ctx.translate(size * 0.5, size * 0.5);
    const glowGradN = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 2.2);
    glowGradN.addColorStop(0, "rgba(60,80,200,0.35)");
    glowGradN.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGradN;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cache [1]: Buffed Ambient Glow
    ctx.save();
    ctx.translate(size * 1.5, size * 0.5);
    const glowGradB = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 2.2);
    glowGradB.addColorStop(0, "rgba(255,200,130,0.55)");
    glowGradB.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGradB;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cache [2]: Normal Body
    ctx.save();
    ctx.translate(size * 0.5, size * 1.5);
    const bodyGradN = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
    bodyGradN.addColorStop(0, BODY_CORE_N);
    bodyGradN.addColorStop(0.6, BODY_NORMAL);
    bodyGradN.addColorStop(1, "#0a0a35");
    ctx.fillStyle = bodyGradN;
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cache [3]: Buffed Body
    ctx.save();
    ctx.translate(size * 1.5, size * 1.5);
    const bodyGradB = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
    bodyGradB.addColorStop(0, BODY_CORE_B);
    bodyGradB.addColorStop(0.6, BODY_BUFFED);
    bodyGradB.addColorStop(1, "#664422");
    ctx.fillStyle = bodyGradB;
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Pool Fetch Allocators ──────────────────────────────────────
  private spawnParticle(config: Partial<StellarParticle>): void {
    const p = this.particles.find((item) => !item.active);
    if (p) {
      Object.assign(p, config, { active: true });
    }
  }

  private addTrailPoint(x: number, y: number): void {
    const t = this.trail.find((item) => !item.active);
    if (t) {
      t.x = x;
      t.y = y;
      t.alpha = 1;
      t.active = true;
    } else {
      // If pool full, cycle oldest
      const oldest = this.trail[0];
      oldest.x = x;
      oldest.y = y;
      oldest.alpha = 1;
      oldest.active = true;
      this.trail.push(this.trail.shift()!);
    }
  }

  private spawnFlare(
    angle: number,
    life: number,
    maxLife: number,
    size: number,
  ): void {
    const f = this.flares.find((item) => !item.active);
    if (f) {
      f.angle = angle;
      f.life = life;
      f.maxLife = maxLife;
      f.size = size;
      f.active = true;
    }
  }

  public spawn(): void {
    const map = this.gameState.levelData.map;
    for (let y = 0; y < map.length; y++) {
      const x = map[y].findIndex((t: string) => t === "PM");
      if (x !== -1) {
        this.x = x * this.tileSize + this.tileSize / 2;
        this.y = y * this.tileSize + this.tileSize / 2;
        this.lastTeleportExit = null;
        return;
      }
    }
  }

  public update(dt: number): void {
    this.time += dt;
    if (this.state === "DYING") {
      this.updateParticles(dt);
      this.updateFlares(dt);
      this.needsRedraw = true;
      return;
    }

    if (this.gameState.mode !== "PLAYING") return;

    this.updateTrail(dt);
    this.updateParticles(dt);
    this.updateFlares(dt);

    if (this.ghostEatFlash > 0) this.ghostEatFlash -= dt * 3;

    this.speed = this.isBuffed ? this.buffedSpeed : this.normalSpeed;

    if (this.direction.dx !== 0 || this.direction.dy !== 0) {
      this.addTrailPoint(this.x, this.y);

      const rate = this.isBuffed ? 4 : 2;
      for (let i = 0; i < rate; i++) {
        const sx =
          this.x -
          this.direction.dx * this.r * 0.6 +
          (Math.random() - 0.5) * this.r * 0.35;
        const sy =
          this.y -
          this.direction.dy * this.r * 0.6 +
          (Math.random() - 0.5) * this.r * 0.35;

        this.spawnParticle({
          x: sx,
          y: sy,
          vx:
            -this.direction.dx * (this.isBuffed ? 160 : 55) +
            (Math.random() - 0.5) * 30,
          vy:
            -this.direction.dy * (this.isBuffed ? 160 : 55) +
            (Math.random() - 0.5) * 30,
          life: this.isBuffed ? 0.45 : 0.3,
          maxLife: this.isBuffed ? 0.45 : 0.3,
          size: this.isBuffed
            ? 1.5 + Math.random() * 3.5
            : 0.8 + Math.random() * 2,
          type: Math.random() > 0.3 ? "DIAMOND" : "SPARK",
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 10,
        });
      }

      if (this.isBuffed && Math.random() < 0.4) {
        this.spawnFlare(
          Math.random() * Math.PI * 2,
          0.15 + Math.random() * 0.2,
          0.35,
          1.5 + Math.random() * 4,
        );
      }
    }

    const px = this.x,
      py = this.y;
    this.updateMovement(dt);
    this.teleport();

    if (
      Math.abs(this.x - px) > this.tileSize * 2 ||
      Math.abs(this.y - py) > this.tileSize * 2
    ) {
      this.trail.forEach((t) => (t.active = false));
      this.spawnWarpVFX(px, py, true);
      this.spawnWarpVFX(this.x, this.y, false);
    }

    const g = this.getCollidedGhost();
    if (g) {
      if (this.isBuffed && g.state === "FRIGHTENED") {
        this.spawnGhostConsume(g.x, g.y);
        this.ghostEatFlash = 1;
        eventBus.emit("ghost:eaten", {
          ghostName: g.name,
          points: 0,
          ghostIndex: 0,
        });
      } else if (
        !this.isBuffed &&
        g.state !== "FRIGHTENED" &&
        g.state !== "EATEN"
      ) {
        this.triggerDeath();
      }
    }
    this.needsRedraw = true;
  }

  private updateMovement(dt: number): void {
    if (
      this.direction.dx === 0 &&
      this.direction.dy === 0 &&
      this.nextDirection
    ) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
    }
    if (this.nextDirection) this.tryTurn();
    if (this.willHitWall(dt, this.direction)) {
      this.snapToTileCenter();
      return;
    }
    const n = this.getNextPosition(dt);
    this.x = n.newX;
    this.y = n.newY;
    if (this.direction.dx !== 0 || this.direction.dy !== 0)
      this.lastDirection = { ...this.direction };
    this.smoothAlign(dt);
    const { tileX, tileY } = this.gridContext.getTile(this.x, this.y);
    this.tryEat(tileX, tileY);
  }

  private tryTurn(): void {
    if (!this.nextDirection) return;
    const { centerX, centerY } = this.gridContext.getTileCenter(this.x, this.y);
    const { tileX, tileY } = this.gridContext.getTile(this.x, this.y);
    if (
      this.nextDirection.dx === -this.direction.dx &&
      this.nextDirection.dy === -this.direction.dy
    ) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
      return;
    }
    const tx = tileX + this.nextDirection.dx,
      ty = tileY + this.nextDirection.dy;
    if (this.gridContext.isWall(tx, ty)) return;
    if (
      Math.sqrt((this.x - centerX) ** 2 + (this.y - centerY) ** 2) <
      this.tileSize * this.config.turnThreshold
    ) {
      if (this.nextDirection.dx !== 0) this.y = centerY;
      if (this.nextDirection.dy !== 0) this.x = centerX;
      this.direction = this.nextDirection;
      this.nextDirection = null;
    }
  }

  private smoothAlign(dt: number): void {
    const { centerX, centerY } = this.gridContext.getTileCenter(this.x, this.y);
    const f = 1 - Math.exp(-this.config.axisAlignSpeed * dt);
    if (this.direction.dx !== 0) this.y += (centerY - this.y) * f;
    if (this.direction.dy !== 0) this.x += (centerX - this.x) * f;
  }

  public changeDirection(d: { dx: number; dy: number }): void {
    this.nextDirection = d;
  }

  private getCollidedGhost(): Ghost | null {
    for (const g of this.levelContext.ghosts) {
      if (Math.sqrt((this.x - g.x) ** 2 + (this.y - g.y) ** 2) < this.r + g.r)
        return g;
    }
    return null;
  }

  private tryEat(tx: number, ty: number): void {
    if (this.gameState.activeDots.has(`${ty},${tx}`)) {
      this.spawnDotEat(tx, ty);
      eventBus.emit("dot:collect", { position: { i: ty, j: tx } });
    }
    if (this.gameState.activePills.has(`${ty},${tx}`)) {
      this.spawnPillEat(tx, ty);
      eventBus.emit("power_pill:collect", { position: { i: ty, j: tx } });
    }
  }

  // ── Spawn Handlers (Converted to write to Object Recycler Pools) ──
  private spawnWarpVFX(x: number, y: number, isExit: boolean): void {
    this.ghostEatFlash = 0.8;

    this.spawnParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.25,
      maxLife: 0.25,
      size: isExit ? this.r * 0.15 : this.r * 3.5,
      type: "RING",
      rotation: 0,
      rotSpeed: 0,
    });

    const shardCount = 30;
    for (let i = 0; i < shardCount; i++) {
      const a = (i / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = isExit
        ? 180 + Math.random() * 280
        : 30 + Math.random() * 60;
      this.spawnParticle({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.15 + Math.random() * 0.2,
        maxLife: 0.35,
        size: 2 + Math.random() * 3.5,
        type: "DIAMOND",
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 14,
      });
    }

    const starCount = 14;
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = isExit
        ? 200 + Math.random() * 320
        : 25 + Math.random() * 55;
      this.spawnParticle({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.1 + Math.random() * 0.12,
        maxLife: 0.22,
        size: 1.5 + Math.random() * 2.5,
        type: "SPARK",
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  private spawnDotEat(tx: number, ty: number): void {
    const cx = tx * this.tileSize + this.tileSize / 2;
    const cy = ty * this.tileSize + this.tileSize / 2;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 35 + Math.random() * 50;
      this.spawnParticle({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.12 + Math.random() * 0.1,
        maxLife: 0.22,
        size: 0.8 + Math.random() * 1.5,
        type: "DIAMOND",
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 6,
      });
    }
  }

  private spawnPillEat(tx: number, ty: number): void {
    const cx = tx * this.tileSize + this.tileSize / 2;
    const cy = ty * this.tileSize + this.tileSize / 2;
    this.spawnParticle({
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      life: 0.5,
      maxLife: 0.5,
      size: this.r * 0.3,
      type: "RING",
      rotation: 0,
      rotSpeed: 0,
    });

    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 180;
      this.spawnParticle({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.18 + Math.random() * 0.3,
        maxLife: 0.48,
        size: 1.5 + Math.random() * 3,
        type: "SPARK",
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12,
      });
    }
  }

  private spawnGhostConsume(gx: number, gy: number): void {
    this.spawnParticle({
      x: gx,
      y: gy,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      size: 4,
      type: "RING",
      rotation: 0,
      rotSpeed: 0,
    });
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 100 + Math.random() * 180;
      this.spawnParticle({
        x: gx,
        y: gy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.22 + Math.random() * 0.4,
        maxLife: 0.62,
        size: 1.5 + Math.random() * 3.5,
        type: Math.random() > 0.5 ? "DIAMOND" : "SPARK",
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 14,
      });
    }
  }

  // ── Array Pool Modifiers (Replaces Splice Trash Operations) ────
  private updateTrail(dt: number): void {
    // Raised decay from 1.1/1.7 to 4.5/6.5 for an instant power-burst snap
    const decay = this.isBuffed ? 4.5 : 6.5;
    for (const t of this.trail) {
      if (!t.active) continue;
      t.alpha -= dt * decay;
      if (t.alpha <= 0) t.active = false;
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.type !== "RING") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.rotation += p.rotSpeed * dt;
      } else {
        p.size += 900 * dt;
      }
    }
  }

  private updateFlares(dt: number): void {
    for (const f of this.flares) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) f.active = false;
    }
  }

  public triggerDeath(): void {
    if (this.state === "DYING") return;
    this.state = "DYING";
    this.speed = 0;
    eventBus.emit("pacman:death");
  }

  // ── Render Processing Pipeline ─────────────────────────────────
  public draw(): void {
    this.drawDebug();
    return;
    if (this.r <= 0) return;
    this.drawTrailRibbon();
    this.drawParticles();
    if (this.state === "DYING") this.drawDead();
    else this.drawAlive();
  }

  private drawTrailRibbon(): void {
    if (this.state === "DYING") return;
    const ctx = this.layer.ctx;

    const w = this.r * 0.35;
    const gap = this.isBuffed ? this.r * 0.5 : 0; // Distinct dual spacing
    const coreClr = this.isBuffed ? TRAIL_CLR_B : TRAIL_CLR_N;
    const sparkClr = this.isBuffed ? TRAIL_SPARK_B : TRAIL_SPARK_N;

    const activePoints = this.trail.filter((t) => t.active);
    if (activePoints.length < 2) return;

    ctx.save();
    ctx.lineCap = "butt"; // Sharp, blocky beam cuts
    ctx.lineJoin = "miter"; // Boxy alignment when cornering
    ctx.miterLimit = 2;

    const sides = this.isBuffed ? [-1, 1] : [0];

    for (const side of sides) {
      const offset = side * gap * 0.5;

      // Continuous execution path
      ctx.beginPath();
      let first = true;
      for (const p of activePoints) {
        const dx = this.lastDirection.dy * offset;
        const dy = -this.lastDirection.dx * offset;

        if (first) {
          ctx.moveTo(p.x + dx, p.y + dy);
          first = false;
        } else {
          ctx.lineTo(p.x + dx, p.y + dy);
        }
      }

      // Neon Flare Pass
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = w * (this.isBuffed ? 2.5 : 1.8);
      ctx.strokeStyle = coreClr;
      ctx.stroke();

      // Sharp Core Filament Pass
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = this.isBuffed ? 3.5 : 1.5;
      ctx.strokeStyle = sparkClr;
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawParticles(): void {
    const ctx = this.layer.ctx;

    // Batch operations state wrapper saved once outside individual updates
    ctx.save();
    for (const p of this.particles) {
      if (!p.active) continue;
      const a = Math.max(0, p.life / p.maxLife);
      if (a <= 0.01) continue;

      ctx.globalAlpha = a * 0.8;

      // Ring handler
      if (p.type === "RING") {
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 6 * a; // Double stroke mimic bloom layer
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Diamond handler
      else if (p.type === "DIAMOND") {
        const s = p.size * a;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        ctx.fillStyle = "rgba(255,255,255,0.3)"; // Fake bloom substrate
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.4);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s * 1.4);
        ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.5, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Spark block tracker
      else {
        const s = p.size * a;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(-s * 0.6, -s * 1.3, s * 1.2, s * 2.6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-s * 0.25, -s, s * 0.5, s * 2);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private getAngle(): number {
    const d =
      this.direction.dx !== 0 || this.direction.dy !== 0
        ? this.direction
        : this.lastDirection;
    if (d.dx === -1) return Math.PI;
    if (d.dx === 1) return 0;
    if (d.dy === -1) return -Math.PI / 2;
    if (d.dy === 1) return Math.PI / 2;
    return 0;
  }

  private drawAlive(): void {
    const ctx = this.layer.ctx;
    const r = this.r;
    const rot = this.getAngle();
    const moving = this.direction.dx !== 0 || this.direction.dy !== 0;
    const t = this.time * 1000;

    let mouth: number;
    if (moving) {
      const sf = this.isBuffed
        ? this.config.mouthSpeed * 1.55
        : this.config.mouthSpeed;
      mouth = Math.abs(Math.sin(t * sf)) * this.config.maxMouthAngle;
    } else {
      mouth = this.config.idleMouthAngle;
    }
    mouth = Math.max(0.08, Math.min(mouth, Math.PI * 0.45));
    const sa = mouth,
      ea = Math.PI * 2 - mouth;
    const innerRim = r * 0.3;

    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Ghost Eat Flash Layer Mimic
    if (this.ghostEatFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 * this.ghostEatFlash})`;
      ctx.beginPath();
      ctx.arc(0, 0, r + 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.25 * this.ghostEatFlash})`;
      ctx.beginPath();
      ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. High-Performance Copy From Pre-Rendered Ambient Glow Buffer
    const glowX = this.isBuffed ? this.cacheSize * 1.5 : this.cacheSize * 0.5;
    ctx.drawImage(
      this.cacheCanvas,
      glowX - this.cacheSize * 0.5,
      this.cacheSize * 0.5 - this.cacheSize * 0.5,
      this.cacheSize,
      this.cacheSize,
      -this.cacheSize * 0.5,
      -this.cacheSize * 0.5,
      this.cacheSize,
      this.cacheSize,
    );

    ctx.rotate(rot);

    // 3. Dynamic Surface Flares Vector Layering
    for (const flare of this.flares) {
      if (!flare.active) continue;
      const fa = flare.life / flare.maxLife;
      const fx = Math.cos(flare.angle) * r * 0.8;
      const fy = Math.sin(flare.angle) * r * 0.8;
      const fs = flare.size * fa;

      ctx.fillStyle = "rgba(255,180,80,0.15)";
      ctx.beginPath();
      ctx.arc(fx, fy, fs * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,220,160,0.4)";
      ctx.beginPath();
      ctx.arc(fx, fy, fs * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(fx, fy, fs * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Copied Pre-rendered Gradient Body Core Base Slice
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, sa, ea);
    ctx.lineTo(Math.cos(ea) * innerRim, Math.sin(ea) * innerRim);
    ctx.lineTo(Math.cos(sa) * innerRim, Math.sin(sa) * innerRim);
    ctx.closePath();
    ctx.clip();

    const bodyX = this.isBuffed ? this.cacheSize * 1.5 : this.cacheSize * 0.5;
    ctx.drawImage(
      this.cacheCanvas,
      bodyX - r,
      this.cacheSize * 1.5 - r,
      r * 2,
      r * 2,
      -r,
      -r,
      r * 2,
      r * 2,
    );
    ctx.restore();

    // 5. Outer Edge Wireframe Rim Layering
    const edgeClr = this.isBuffed ? BODY_EDGE_B : BODY_EDGE_N;
    ctx.strokeStyle = this.isBuffed
      ? "rgba(255,255,255,0.15)"
      : "rgba(120,160,255,0.2)";
    ctx.lineWidth = this.isBuffed ? 7 : 4;
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, sa, ea);
    ctx.stroke(); // Faux Bloom Rim

    ctx.strokeStyle = edgeClr;
    ctx.lineWidth = this.isBuffed ? 2.2 : 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, sa, ea);
    ctx.stroke(); // Core Crisp Rim

    // 6. Mouth Interior Clips & Star Twinkles
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, sa, ea);
    ctx.lineTo(Math.cos(ea) * innerRim, Math.sin(ea) * innerRim);
    ctx.lineTo(Math.cos(sa) * innerRim, Math.sin(sa) * innerRim);
    ctx.closePath();
    ctx.clip();

    const mouthGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    mouthGrad.addColorStop(0, MOUTH_INNER);
    mouthGrad.addColorStop(0.25, this.isBuffed ? MOUTH_GRAD_B : MOUTH_GRAD_N);
    mouthGrad.addColorStop(
      0.6,
      this.isBuffed ? "rgba(180,130,60,0.35)" : "rgba(25,35,100,0.35)",
    );
    mouthGrad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = mouthGrad;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    for (const star of this.mouthStars) {
      const starR = star.radius * r;
      if (starR <= 0.4) continue;
      const sx = Math.cos(star.angle) * starR;
      const sy = Math.sin(star.angle) * starR;
      const twinkle = 0.5 + 0.5 * Math.sin(t * 0.005 + star.phase);
      const ss = Math.max(0.12, star.size * twinkle);
      ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.75})`;
      ctx.beginPath();
      ctx.arc(sx, sy, ss, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 7. Mouth Edge Flare Highlights
    const rimClr = this.isBuffed ? MOUTH_RIM_B : MOUTH_RIM_N;
    ctx.strokeStyle = rimClr;
    ctx.lineWidth = this.isBuffed ? 2.5 : 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, Math.max(0, sa - 0.06), sa + 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, ea - 0.18, Math.min(Math.PI * 2, ea + 0.06));
    ctx.stroke();

    // 8. Core Auriferous Pulsing Vector Heart
    const heartClr = this.isBuffed ? HEART_B : HEART_N;
    const pulse = 1 + Math.sin(t * 0.012) * 0.22;
    const heartR = Math.max(0.4, r * 0.09 * pulse);

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(0, 0, heartR * 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = heartClr;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, heartR * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, heartR, 0, Math.PI * 2);
    ctx.fill();

    if (this.isBuffed) {
      const pulseAlpha = 0.06 + Math.sin(t * 0.018) * 0.05;
      ctx.fillStyle = `rgba(255,255,255,${pulseAlpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, r - 2, sa, ea);
      ctx.lineTo(Math.cos(ea) * innerRim, Math.sin(ea) * innerRim);
      ctx.lineTo(Math.cos(sa) * innerRim, Math.sin(sa) * innerRim);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawDead(): void {
    const p = Math.min(1, this.gameState.deathProgress);
    const ctx = this.layer.ctx;
    const r = this.r;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (p < 0.2) {
      const s = 1 - p * 2;
      const flash = Math.floor(p * 60) % 2 === 0;
      const clr = flash ? "#ffffff" : "#ddccaa";

      ctx.strokeStyle = "rgba(221,204,170,0.2)";
      ctx.lineWidth = 8 * Math.max(0.1, s);
      ctx.beginPath();
      ctx.arc(0, 0, r * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = clr;
      ctx.lineWidth = 3 * Math.max(0.1, s);
      ctx.beginPath();
      ctx.arc(0, 0, r * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const bp = (p - 0.2) / 0.8;
      const a = Math.max(0, 1 - bp);
      const ringR = r * (1 + bp * 4);

      ctx.strokeStyle = `rgba(180,160,220,${a * 0.25})`;
      ctx.lineWidth = 6 * a;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(220,210,240,${a * 0.7})`;
      ctx.lineWidth = 2.5 * a;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.05 * a, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawDebug(): void {
    const ctx = this.layer.ctx;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.isBuffed ? "#ffcc00" : "#ffff00";
    ctx.beginPath();
    // Native un-clipped ultra fast canvas fill primitive
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
