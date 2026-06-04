import { CFG_CANVAS } from "../../config/canvas.config.js";
import { GameRegistry } from "../../game/GameRegistry.js";
import { Actor } from "../Actor.js";
import { eventBus } from "../../core/EventBus.js";
import { Collision } from "../../core/Collision.js";

import type { Ghost } from "../ghost/Ghost.js";
import type { PacmanConfig } from "../../config/pacman.config.js";

interface EatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  type:
    | "SHARD"
    | "RING"
    | "LINE"
    | "GLITCH"
    | "GATEWAY"
    | "SCANLINE"
    | "THERMAL_BAR";
  size: number;
}

export class Pacman extends Actor {
  private registry: GameRegistry;
  private config: PacmanConfig;

  public state: "ALIVE" | "EATEN" | "DYING" = "ALIVE";
  public nextDirection: { dx: number; dy: number } | null = null;

  private deathTimer: number = 0;
  private lastDirection: { dx: number; dy: number } = { dx: 1, dy: 0 };

  // VFX state
  private trailHistory: { x: number; y: number; alpha: number }[] = [];
  private eatParticles: EatParticle[] = [];
  private ghostEatFlash: number = 0;

  private normalSpeed: number;
  private buffedSpeed: number;

  constructor(config: PacmanConfig) {
    super(CFG_CANVAS.canvasIds.pacman);
    this.registry = GameRegistry.getInstance();
    this.config = config;

    const tileSize = CFG_CANVAS.tile.size;
    this.normalSpeed = tileSize * config.normalSpeedMultiplier;
    this.buffedSpeed = tileSize * config.buffedSpeedMultiplier;

    this.speed = this.normalSpeed;
    this.r = tileSize * config.radiusMultiplier;
  }

  private get isBuffed(): boolean {
    return this.gameState.isBuffed;
  }

  public init(): void {}

  public reset(): void {
    this.state = "ALIVE";
    this.direction = { dx: 0, dy: 0 };
    this.nextDirection = null;
    this.lastDirection = { dx: 1, dy: 0 };
    this.speed = this.normalSpeed;
    this.trailHistory = [];
    this.eatParticles = [];
    this.ghostEatFlash = 0;
    this.needsRedraw = true;
  }

  public spawn(): void {
    const map = this.gameState.levelData.map;
    for (let y = 0; y < map.length; y++) {
      const x = map[y].findIndex((tile: string) => tile === "PM");
      if (x !== -1) {
        this.x = x * this.tileSize + this.tileSize / 2;
        this.y = y * this.tileSize + this.tileSize / 2;
        this.lastTeleportExit = null;
        return;
      }
    }
    console.warn("Pac-Man spawn point (PM) not found on the current map!");
  }

  public update(dt: number): void {
    if (this.state === "DYING") {
      this.deathTimer += dt;
      this.updateEatParticles(dt);
      if (this.deathTimer >= this.config.deathAnimationDuration) {
        eventBus.emit("pacman:death_animation_end");
      }
      this.needsRedraw = true;
      return;
    }

    this.updateTrail(dt);
    this.updateEatParticles(dt);
    if (this.ghostEatFlash > 0) this.ghostEatFlash -= dt * 3;

    if (this.gameState.mode !== "PLAYING") return;

    this.speed = this.isBuffed ? this.buffedSpeed : this.normalSpeed;

    if (this.direction.dx !== 0 || this.direction.dy !== 0) {
      this.spawnTrailParticle();

      // OVERCLOCKED EMISSIONS: Spawn intense heat leaks when buffed
      const particleChance = this.isBuffed ? 0.6 : 0.15;
      if (Math.random() < particleChance) {
        const tX = this.x - this.direction.dx * this.r * 0.8;
        const tY = this.y - this.direction.dy * this.r * 0.8;

        this.eatParticles.push({
          x: tX + (Math.random() - 0.5) * (this.r * 0.5),
          y: tY + (Math.random() - 0.5) * (this.r * 0.5),
          // Eject fast breaking shards if buffed
          vx:
            -this.direction.dx * (this.isBuffed ? 140 : 40) +
            (Math.random() - 0.5) * 30,
          vy:
            -this.direction.dy * (this.isBuffed ? 140 : 40) +
            (Math.random() - 0.5) * 30,
          life: this.isBuffed ? 0.4 : 0.25,
          maxLife: this.isBuffed ? 0.4 : 0.25,
          color: this.isBuffed
            ? Math.random() > 0.4
              ? "#ff3300"
              : "#ffaa00"
            : "#ffea00",
          type: this.isBuffed ? "GLITCH" : "SHARD",
          size: this.isBuffed ? 3 + Math.random() * 4 : 1.5,
        });
      }
    }

    const prevX = this.x;
    const prevY = this.y;

    this.updateMovement(dt);
    this.teleport();

    // Re-verify portal crossing and execute visual snap
    if (
      Math.abs(this.x - prevX) > this.tileSize * 2 ||
      Math.abs(this.y - prevY) > this.tileSize * 2
    ) {
      this.trailHistory = [];
      this.spawnTeleportVFX(prevX, prevY);
      this.spawnTeleportVFX(this.x, this.y);
    }

    const collidedGhost = this.getCollidedGhost();
    if (collidedGhost) {
      if (this.isBuffed && collidedGhost.state === "FRIGHTENED") {
        this.spawnGhostEatVFX(collidedGhost.x, collidedGhost.y);
        this.ghostEatFlash = 1;
        eventBus.emit("command:ghost_eaten", { ghostName: collidedGhost.name });
      } else if (
        !this.isBuffed &&
        collidedGhost.state !== "FRIGHTENED" &&
        collidedGhost.state !== "EATEN"
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

    if (this.nextDirection) {
      this.tryExecuteTurn();
    }

    const isHittingWall = this.willHitWall(dt, this.direction);
    if (isHittingWall) {
      this.snapToTileCenter();
      return;
    }

    const { newX, newY } = this.getNextPosition(dt);
    this.x = newX;
    this.y = newY;

    if (this.direction.dx !== 0 || this.direction.dy !== 0) {
      this.lastDirection = { ...this.direction };
    }

    this.smoothAlignToAxis(dt);

    const { tileX, tileY } = Collision.getTile(this.x, this.y);
    this.tryEatFood(tileX, tileY);
    this.tryEatPill(tileX, tileY);
  }

  private tryExecuteTurn(): void {
    if (!this.nextDirection) return;

    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    const { tileX, tileY } = Collision.getTile(this.x, this.y);

    if (
      this.nextDirection.dx === -this.direction.dx &&
      this.nextDirection.dy === -this.direction.dy
    ) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
      return;
    }

    const targetTileX = tileX + this.nextDirection.dx;
    const targetTileY = tileY + this.nextDirection.dy;
    if (Collision.isWall(targetTileX, targetTileY)) return;

    const turnThreshold = this.tileSize * this.config.turnThreshold;
    const distanceToCenter = Math.sqrt(
      (this.x - centerX) ** 2 + (this.y - centerY) ** 2,
    );

    if (distanceToCenter < turnThreshold) {
      if (this.nextDirection.dx !== 0) this.y = centerY;
      if (this.nextDirection.dy !== 0) this.x = centerX;
      this.direction = this.nextDirection;
      this.nextDirection = null;
    }
  }

  private smoothAlignToAxis(dt: number): void {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    const pullFactor = 1 - Math.exp(-this.config.axisAlignSpeed * dt);

    if (this.direction.dx !== 0) {
      this.y += (centerY - this.y) * pullFactor;
    }
    if (this.direction.dy !== 0) {
      this.x += (centerX - this.x) * pullFactor;
    }
  }

  public changeDirection(dir: { dx: number; dy: number }): void {
    this.nextDirection = dir;
  }

  private getCollidedGhost(): Ghost | null {
    const ghosts = this.registry.getGhosts();
    for (const g of ghosts) {
      const distance = Math.sqrt((this.x - g.x) ** 2 + (this.y - g.y) ** 2);
      if (distance < this.r + g.r) return g;
    }
    return null;
  }

  private tryEatFood(tileX: number, tileY: number): void {
    const dot = this.registry.getDots();
    if (dot.positions.has(`${tileY},${tileX}`)) {
      this.spawnDotEatVFX(tileX, tileY);
      eventBus.emit("dot:collect", { position: { i: tileY, j: tileX } });
    }
  }

  private tryEatPill(tileX: number, tileY: number): void {
    const pill = this.registry.getPills();
    const key = `${tileY},${tileX}`;

    if (pill.positions.has(key)) {
      this.spawnPillEatVFX(tileX, tileY);
      eventBus.emit("power_pill:collect", { position: { i: tileY, j: tileX } });
    }
  }

  // --- VFX Engine ---

  private spawnTrailParticle(): void {
    this.trailHistory.push({ x: this.x, y: this.y, alpha: 1.0 });
    if (this.trailHistory.length > (this.isBuffed ? 14 : 8)) {
      this.trailHistory.shift();
    }
  }

  private updateTrail(dt: number): void {
    const decaySpeed = this.isBuffed ? 1.8 : 2.5;
    for (let i = 0; i < this.trailHistory.length; i++) {
      this.trailHistory[i].alpha -= dt * decaySpeed;
    }
  }

  private spawnTeleportVFX(x: number, y: number): void {
    const isLeftPortal = x < this.tileSize * 3;
    const blastDirection = isLeftPortal ? 1 : -1;
    this.ghostEatFlash = 0.8;

    // 1. Gateway Rings
    for (let i = 0; i < 3; i++) {
      this.eatParticles.push({
        x,
        y,
        vx: blastDirection,
        vy: 0,
        life: 0.15 + i * 0.08,
        maxLife: 0.4,
        color: i === 1 ? "#ffaa00" : "#ffffff",
        type: "GATEWAY",
        size: this.r * 0.5,
      });
    }

    // 2. Scanline Streaks
    for (let i = 0; i < 6; i++) {
      this.eatParticles.push({
        x: x + (Math.random() * 10 - 5),
        y: y + (Math.random() * this.r * 2 - this.r),
        vx: blastDirection * (350 + Math.random() * 200),
        vy: 0,
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.4,
        color: "#ffaa00",
        type: "SCANLINE",
        size: 15 + Math.random() * 25,
      });
    }

    // 3. Complete Portal Particle Explosion Burst (Restored)
    for (let i = 0; i < 15; i++) {
      const angle =
        (Math.random() - 0.5) * (Math.PI * 0.6) + (isLeftPortal ? 0 : Math.PI);
      const speed = 180 + Math.random() * 220;

      this.eatParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
        color: Math.random() > 0.4 ? "#ffea00" : "#ffffff",
        type: "GLITCH",
        size: 3 + Math.random() * 4,
      });
    }
  }

  private spawnDotEatVFX(tileX: number, tileY: number): void {
    const cx = tileX * this.tileSize + this.tileSize / 2;
    const cy = tileY * this.tileSize + this.tileSize / 2;

    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 50;
      this.eatParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.15,
        maxLife: 0.3,
        color: this.isBuffed ? "#ff5500" : "#ffea00",
        type: "SHARD",
        size: 2 + Math.random() * 2,
      });
    }
  }

  private spawnPillEatVFX(tileX: number, tileY: number): void {
    const cx = tileX * this.tileSize + this.tileSize / 2;
    const cy = tileY * this.tileSize + this.tileSize / 2;
    const col = "#ffaa00";

    this.eatParticles.push({
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      color: col,
      type: "RING",
      size: this.r * 0.5,
    });

    for (let i = 0; i < 14; i++) {
      const speed = 180 + Math.random() * 260;
      const directionalSign = Math.random() > 0.5 ? 1 : -1;
      this.eatParticles.push({
        x: cx,
        y: cy + (Math.random() - 0.5) * this.r,
        vx: speed * directionalSign,
        vy: 0,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        color: col,
        type: "THERMAL_BAR",
        size: 12 + Math.random() * 15,
      });
    }
  }

  private spawnGhostEatVFX(gx: number, gy: number): void {
    const particleCount = 28;
    this.eatParticles.push({
      x: gx,
      y: gy,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      color: "#ffffff",
      type: "RING",
      size: 4,
    });

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 140;
      const isLine = Math.random() > 0.55;

      this.eatParticles.push({
        x: gx,
        y: gy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        color: Math.random() > 0.35 ? "#ffffff" : "#ffaa00",
        type: isLine ? "LINE" : "SHARD",
        size: isLine ? 4 + Math.random() * 6 : 2.5 + Math.random() * 2.5,
      });
    }
  }

  private updateEatParticles(dt: number): void {
    for (let i = this.eatParticles.length - 1; i >= 0; i--) {
      const p = this.eatParticles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.eatParticles.splice(i, 1);
        continue;
      }

      if (p.type === "RING") {
        p.size += 260 * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
    }
  }

  private triggerDeath(): void {
    if (this.state === "DYING") return;
    this.state = "DYING";
    this.deathTimer = 0;
    this.speed = 0;
    eventBus.emit("pacman:death_triggered");
    eventBus.emit("pacman:death_animation_start");
  }

  // --- Rendering Pipeline ---

  public draw(): void {
    this.drawTrailVFX();
    if (this.state === "DYING") {
      this.drawDead();
    } else {
      this.drawAlive();
    }
    this.drawEatVFX();
  }

  private drawTrailVFX(): void {
    if (this.state === "DYING" || this.trailHistory.length < 2) return;

    const ctx = this.ctx;
    const color = this.isBuffed ? "#ff5100" : "#ffea00";
    const width = this.isBuffed ? this.r * 1.2 : this.r * 0.75; // Thicker ribbon when buffed

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;

    for (let i = 0; i < this.trailHistory.length - 1; i++) {
      const p1 = this.trailHistory[i];
      const p2 = this.trailHistory[i + 1];
      const alpha = Math.max(0, p2.alpha);

      ctx.globalAlpha = this.isBuffed ? alpha * 0.55 : alpha * 0.35;
      ctx.shadowBlur = this.isBuffed ? 18 * alpha : 6 * alpha;
      ctx.lineWidth = this.isBuffed ? 2.5 : 1;

      // Draw volumetric vector edges
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y - width / 2);
      ctx.lineTo(p1.x, p1.y + width / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y - width / 2);
      ctx.lineTo(p2.x, p2.y - width / 2);
      ctx.moveTo(p1.x, p1.y + width / 2);
      ctx.lineTo(p2.x, p2.y + width / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEatVFX(): void {
    const ctx = this.ctx;
    for (const p of this.eatParticles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12 * alpha;

      if (p.type === "SHARD") {
        const s = p.size * alpha;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.type === "LINE") {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size);
        ctx.lineTo(p.x, p.y + p.size);
        ctx.stroke();
      } else if (p.type === "RING") {
        ctx.lineWidth = 2 * alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "THERMAL_BAR") {
        ctx.fillRect(p.x - p.size / 2, p.y - 1, p.size, 2);
      } else if (p.type === "GLITCH") {
        ctx.fillRect(p.x - p.size, p.y - p.size / 4, p.size * 2, p.size / 2);
      } else if (p.type === "GATEWAY") {
        const progress = p.life / p.maxLife;
        const radius = p.size + (1 - progress) * (this.r * 3);
        const directionSign = p.vx;

        ctx.lineWidth = 3 * progress;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 8 * directionSign);
        ctx.beginPath();
        for (let side = 0; side < 4; side++) {
          const angle = (side * Math.PI) / 2;
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "SCANLINE") {
        const progress = p.life / p.maxLife;
        ctx.lineWidth = 2 * progress;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.08, p.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private getRotation(): number {
    const dir =
      this.direction.dx !== 0 || this.direction.dy !== 0
        ? this.direction
        : this.lastDirection;
    if (dir.dx === -1) return Math.PI;
    if (dir.dx === 1) return 0;
    if (dir.dy === -1) return -Math.PI / 2;
    if (dir.dy === 1) return Math.PI / 2;
    return 0;
  }

  private drawAlive(): void {
    const ctx = this.ctx;
    const cx = this.x;
    const cy = this.y;
    const r = this.r;
    const rotation = this.getRotation();
    const isMoving = this.direction.dx !== 0 || this.direction.dy !== 0;
    const timestamp = Date.now();

    let mouthAngle: number;
    if (isMoving) {
      const speedFactor = this.isBuffed
        ? this.config.mouthSpeed * 1.65
        : this.config.mouthSpeed;
      mouthAngle =
        Math.abs(Math.sin(timestamp * speedFactor)) * this.config.maxMouthAngle;
    } else {
      mouthAngle = this.config.idleMouthAngle;
    }

    const startAngle = mouthAngle;
    const endAngle = 2 * Math.PI - mouthAngle;

    const primaryColor = this.isBuffed ? "#ff5100" : "#ffea00";
    const structuralColor = this.isBuffed ? "#ffffff" : "#ffe082";

    ctx.save();

    // OVERCLOCK AFTERIMAGE JITTER: Apply micro-instability translations when buffed
    if (this.isBuffed && isMoving && Math.random() > 0.4) {
      const jitterRange = 1.8;
      ctx.translate(
        cx + (Math.random() - 0.5) * jitterRange,
        cy + (Math.random() - 0.5) * jitterRange,
      );
    } else {
      ctx.translate(cx, cy);
    }

    ctx.rotate(rotation);

    if (this.ghostEatFlash > 0) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 30 * this.ghostEatFlash;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * this.ghostEatFlash})`;
      ctx.beginPath();
      ctx.arc(0, 0, r + 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer Arc Vector Chassis
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = this.isBuffed ? 26 : 10;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.arc(0, 0, r - 2, startAngle, endAngle);

    const innerCutoff = r * 0.35;
    ctx.lineTo(
      Math.cos(2 * Math.PI - mouthAngle) * innerCutoff,
      Math.sin(2 * Math.PI - mouthAngle) * innerCutoff,
    );
    ctx.lineTo(
      Math.cos(mouthAngle) * innerCutoff,
      Math.sin(mouthAngle) * innerCutoff,
    );
    ctx.closePath();

    const pulseAlpha = 0.04 + Math.sin(timestamp * 0.006) * 0.03;
    ctx.fillStyle = this.isBuffed
      ? `rgba(255, 81, 0, ${0.12 + pulseAlpha})`
      : `rgba(255, 234, 0, ${pulseAlpha})`;
    ctx.fill();
    ctx.stroke();

    // Internal Matrix Scanline Overlay Grid
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = this.isBuffed
      ? "rgba(255, 81, 0, 0.3)"
      : "rgba(255, 234, 0, 0.14)";
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    const lineSpacing = 4;
    const scrollOffset = Math.floor(timestamp * 0.035) % lineSpacing;
    for (let y = -r; y < r; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(-r, y + scrollOffset);
      ctx.lineTo(r, y + scrollOffset);
      ctx.stroke();
    }
    ctx.restore();

    // --- REFINED ENGINE CORE HOUSING ---
    ctx.save();
    const coreRadius = r * 0.35;

    ctx.strokeStyle = this.isBuffed
      ? "rgba(255,255,255,0.95)"
      : "rgba(255, 234, 0, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = this.isBuffed ? 14 : 0;
    ctx.shadowColor = primaryColor;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (this.isBuffed) {
      const speedMult = timestamp * 0.045; // Sped up core rotation
      ctx.lineWidth = 2;

      for (let i = 0; i < 2; i++) {
        ctx.save();
        ctx.rotate(i === 0 ? speedMult : -speedMult * 1.4);
        const pulseRadius =
          coreRadius * (0.72 + Math.sin(timestamp * 0.025 + i) * 0.1);
        ctx.strokeStyle = i === 0 ? "#ffffff" : "#ff1100";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, pulseRadius, 0, Math.PI * 1.1);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.rotate(timestamp * 0.002);
      ctx.strokeStyle = structuralColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius * 0.6, 0, Math.PI * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius * 0.6, Math.PI, Math.PI * 1.4);
      ctx.stroke();
      ctx.fillStyle = primaryColor;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    ctx.restore();

    // Peripheral Antenna Tracking Arcs
    ctx.strokeStyle = structuralColor;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, Math.PI * 0.7, Math.PI * 1.3);
    ctx.stroke();

    ctx.fillStyle = primaryColor;
    ctx.fillRect(
      Math.cos(Math.PI * 0.7) * (r * 0.68) - 1,
      Math.sin(Math.PI * 0.7) * (r * 0.68) - 1,
      2,
      2,
    );
    ctx.fillRect(
      Math.cos(Math.PI * 1.3) * (r * 0.68) - 1,
      Math.sin(Math.PI * 1.3) * (r * 0.68) - 1,
      2,
      2,
    );

    ctx.restore();
  }

  private drawDead(): void {
    const p = Math.min(1, this.deathTimer / this.config.deathAnimationDuration);
    const ctx = this.ctx;
    const cx = this.x;
    const cy = this.y;
    const r = this.r;

    ctx.save();
    ctx.translate(cx, cy);

    if (p < 0.3) {
      const scale = 1.0 - (p / 0.3) * 0.75;
      const flashAlert = Math.floor(p * 40) % 2 === 0;

      ctx.strokeStyle = flashAlert ? "#ff3300" : "#ffaa00";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 20 * (1 - p);
      ctx.lineWidth = 3 * scale;

      ctx.save();
      ctx.scale(scale, scale);
      ctx.rotate(p * 15);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      const blastProgress = (p - 0.3) / 0.7;
      const alpha = Math.max(0, 1.0 - blastProgress);
      const blastColor = this.isBuffed ? "#ff5100" : "#ffea00";

      ctx.save();
      ctx.globalAlpha = alpha;

      if (blastProgress < 0.25) {
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 30;
        ctx.shadowColor = blastColor;
        ctx.beginPath();
        ctx.arc(0, 0, r * 2.0 * (1.0 - blastProgress * 4), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = blastColor;
      ctx.shadowColor = blastColor;
      ctx.shadowBlur = 15;

      const railLength = r * 4.5 * blastProgress;
      ctx.lineWidth = 4 * (1.0 - blastProgress);

      ctx.beginPath();
      ctx.moveTo(-railLength, 0);
      ctx.lineTo(railLength, 0);
      ctx.moveTo(0, -railLength);
      ctx.lineTo(0, railLength);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px 'Courier New'";
      ctx.textAlign = "center";
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const offsetDistance = r * 1.5 * (1.0 + blastProgress * 2);
        ctx.fillText(
          Math.random() > 0.5 ? "0" : "1",
          Math.cos(angle) * offsetDistance,
          Math.sin(angle) * offsetDistance,
        );
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
