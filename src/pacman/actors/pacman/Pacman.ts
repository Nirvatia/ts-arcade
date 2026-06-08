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
}

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

interface SurfaceFlare {
  angle: number;
  life: number;
  maxLife: number;
  size: number;
}

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
const MOUTH_RIM_N = "rgba(200,225,255,0.85)";
const MOUTH_RIM_B = "#ffffff";
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

    for (let i = 0; i < 28; i++) {
      this.mouthStars.push({
        angle: Math.random() * Math.PI * 0.5 - Math.PI * 0.25,
        radius: 0.1 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
        size: 0.25 + Math.random() * 0.7,
      });
    }
  }

  private get isBuffed(): boolean {
    return this.gameState.isBuffed;
  }

  // ── Lifecycle ────────────────────────────────────────────────
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
      this.trail.push({ x: this.x, y: this.y, alpha: 1 });
      const trailMax = this.isBuffed ? 22 : 14;
      if (this.trail.length > trailMax) this.trail.shift();

      // Diamond stream trail particles
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
        this.particles.push({
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
        this.flares.push({
          angle: Math.random() * Math.PI * 2,
          life: 0.15 + Math.random() * 0.2,
          maxLife: 0.35,
          size: 1.5 + Math.random() * 4,
        });
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
      this.trail = [];
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

  // ── Movement ──────────────────────────────────────────────────
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

  private spawnWarpVFX(x: number, y: number, isExit: boolean): void {
    this.ghostEatFlash = 0.8;

    // ── Gravitational lens ring ────────────────────────────
    // Exit: starts tiny, expands violently. Entry: starts large, contracts.
    this.particles.push({
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

    // ── Diamond shard explosion ────────────────────────────
    const shardCount = 30;
    for (let i = 0; i < shardCount; i++) {
      const a = (i / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = isExit
        ? 180 + Math.random() * 280
        : 30 + Math.random() * 60;
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      this.particles.push({
        x,
        y,
        vx,
        vy,
        life: 0.15 + Math.random() * 0.2,
        maxLife: 0.35,
        size: 2 + Math.random() * 3.5,
        type: "DIAMOND",
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 14,
      });
    }

    // ── Star distortion — fake lensed starlight ────────────
    const starCount = 14;
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = isExit
        ? 200 + Math.random() * 320
        : 25 + Math.random() * 55;
      this.particles.push({
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
      this.particles.push({
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
    this.particles.push({
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
      this.particles.push({
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
    this.particles.push({
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
      this.particles.push({
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

  // ── Updates ───────────────────────────────────────────────────
  private updateTrail(dt: number): void {
    const decay = this.isBuffed ? 1.1 : 1.7;
    for (const t of this.trail) t.alpha -= dt * decay;
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
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
    for (let i = this.flares.length - 1; i >= 0; i--) {
      this.flares[i].life -= dt;
      if (this.flares[i].life <= 0) this.flares.splice(i, 1);
    }
  }

  public triggerDeath(): void {
    if (this.state === "DYING") return;
    this.state = "DYING";
    this.speed = 0;
    eventBus.emit("pacman:death_animation_start");
  }

  // ── Draw ──────────────────────────────────────────────────────
  public draw(): void {
    if (this.r <= 0) return;
    this.drawTrailRibbon();
    this.drawParticles();
    if (this.state === "DYING") this.drawDead();
    else this.drawAlive();
  }

  // ── Trail: diamond stream ────────────────────────────────────
  // In Pacman.ts, replace drawTrailStream with the original ribbon approach:

  private drawTrailRibbon(): void {
    if (this.state === "DYING" || this.trail.length < 2) return;
    const ctx = this.layer.ctx;
    const w = this.r * 0.35;
    const gap = this.isBuffed ? this.r * 0.4 : 0;
    const coreClr = this.isBuffed ? TRAIL_CLR_B : TRAIL_CLR_N;
    const sparkClr = this.isBuffed ? TRAIL_SPARK_B : TRAIL_SPARK_N;

    ctx.save();
    for (let i = 0; i < this.trail.length - 1; i++) {
      const a = Math.max(0, this.trail[i + 1].alpha);
      if (a <= 0.01) continue;
      const p1 = this.trail[i],
        p2 = this.trail[i + 1];

      // Draw one or two ribbons
      for (let side = -1; side <= 1; side += 2) {
        const offset = side * gap * 0.5;
        if (!this.isBuffed && side === 1) continue; // single ribbon when normal

        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = coreClr;
        ctx.shadowColor = coreClr;
        ctx.shadowBlur = this.isBuffed ? 6 * a : 3 * a;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y - w + offset);
        ctx.lineTo(p2.x, p2.y - w + offset);
        ctx.lineTo(p2.x, p2.y + w + offset);
        ctx.lineTo(p1.x, p1.y + w + offset);
        ctx.closePath();
        ctx.fill();

        // Edge highlights
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = sparkClr;
        ctx.shadowColor = sparkClr;
        ctx.shadowBlur = this.isBuffed ? 8 * a : 5 * a;
        ctx.lineWidth = this.isBuffed ? 1 : 0.7;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y - w + offset);
        ctx.lineTo(p2.x, p2.y - w + offset);
        ctx.moveTo(p1.x, p1.y + w + offset);
        ctx.lineTo(p2.x, p2.y + w + offset);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  private drawParticles(): void {
    const ctx = this.layer.ctx;
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = a * 0.8;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.type === "RING") {
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 10 * a;
        ctx.lineWidth = 1.5 * a;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "DIAMOND") {
        const s = p.size * a;
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.5, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.5, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        const s = p.size * a;
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 8;
        ctx.fillRect(-s * 0.25, -s, s * 0.5, s * 2);
      }
      ctx.restore();
    }
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

  // ── ALIVE ─────────────────────────────────────────────────────
  private drawAlive(): void {
    const ctx = this.layer.ctx;
    const r = this.r;
    if (r <= 0) return;
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
    ctx.rotate(rot);

    if (this.ghostEatFlash > 0) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 40 * this.ghostEatFlash;
      ctx.fillStyle = `rgba(255,255,255,${0.2 * this.ghostEatFlash})`;
      ctx.beginPath();
      ctx.arc(0, 0, r + 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body glow
    const glowGrad = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 2.2);
    glowGrad.addColorStop(
      0,
      this.isBuffed ? "rgba(255,200,130,0.55)" : "rgba(60,80,200,0.35)",
    );
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Surface flares
    for (const flare of this.flares) {
      const fa = flare.life / flare.maxLife;
      const fx = Math.cos(flare.angle) * r * 0.8;
      const fy = Math.sin(flare.angle) * r * 0.8;
      const fs = flare.size * fa;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fs);
      fg.addColorStop(0, "rgba(255,255,255,0.9)");
      fg.addColorStop(0.5, "rgba(255,220,160,0.4)");
      fg.addColorStop(1, "rgba(255,180,80,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fx, fy, fs, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body
    const bodyClr = this.isBuffed ? BODY_BUFFED : BODY_NORMAL;
    const bodyGrad = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
    bodyGrad.addColorStop(0, this.isBuffed ? BODY_CORE_B : BODY_CORE_N);
    bodyGrad.addColorStop(0.6, bodyClr);
    bodyGrad.addColorStop(1, this.isBuffed ? "#664422" : "#0a0a35");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, sa, ea);
    ctx.lineTo(Math.cos(ea) * innerRim, Math.sin(ea) * innerRim);
    ctx.lineTo(Math.cos(sa) * innerRim, Math.sin(sa) * innerRim);
    ctx.closePath();
    ctx.fill();

    // Edge rim
    const edgeClr = this.isBuffed ? BODY_EDGE_B : BODY_EDGE_N;
    ctx.strokeStyle = edgeClr;
    ctx.lineWidth = this.isBuffed ? 2.2 : 1.6;
    ctx.shadowColor = edgeClr;
    ctx.shadowBlur = this.isBuffed ? 14 : 7;
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, sa, ea);
    ctx.stroke();

    // Mouth interior
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

    // Mouth rim
    const rimClr = this.isBuffed ? MOUTH_RIM_B : MOUTH_RIM_N;
    ctx.strokeStyle = rimClr;
    ctx.lineWidth = this.isBuffed ? 2.5 : 1.6;
    ctx.shadowColor = rimClr;
    ctx.shadowBlur = this.isBuffed ? 14 : 7;
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, Math.max(0, sa - 0.06), sa + 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, ea - 0.18, Math.min(Math.PI * 2, ea + 0.06));
    ctx.stroke();

    // Heart
    const heartClr = this.isBuffed ? HEART_B : HEART_N;
    const pulse = 1 + Math.sin(t * 0.012) * 0.22;
    const heartR = Math.max(0.4, r * 0.09 * pulse);
    const heartGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, heartR * 2.5);
    heartGrad.addColorStop(0, "#ffffff");
    heartGrad.addColorStop(0.35, heartClr);
    heartGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = heartGrad;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = this.isBuffed ? 20 : 10;
    ctx.beginPath();
    ctx.arc(0, 0, heartR * 2.5, 0, Math.PI * 2);
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

  // ── DEAD ──────────────────────────────────────────────────────
  private drawDead(): void {
    const p = Math.min(1, this.gameState.deathProgress);
    const ctx = this.layer.ctx;
    const r = this.r;
    if (r <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (p < 0.2) {
      const s = 1 - p * 2;
      const flash = Math.floor(p * 60) % 2 === 0;
      ctx.strokeStyle = flash ? "#ffffff" : "#ddccaa";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 28 * (1 - p);
      ctx.lineWidth = 3 * Math.max(0.1, s);
      ctx.beginPath();
      ctx.arc(0, 0, r * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const bp = (p - 0.2) / 0.8;
      const a = Math.max(0, 1 - bp);
      const ringR = r * (1 + bp * 4);
      ctx.strokeStyle = `rgba(220,210,240,${a * 0.7})`;
      ctx.shadowColor = "rgba(180,160,220,0.5)";
      ctx.shadowBlur = 20 * a;
      ctx.lineWidth = 2.5 * a;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 25 * a;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.05 * a, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
