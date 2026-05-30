// src/entities/Pacman.ts
import { CFG_CANVAS } from "../config/canvas.js";
import type { PacmanConfig } from "../config/pacman.js";
import { Collision } from "../core/collision.js";
import { eventBus } from "../core/eventBus.js";
import { GameRegistry } from "../game/gameRegistry.js";
import { Actor } from "./actor.js";
import type { Ghost } from "./ghost.js";

interface EatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  type: "SHARD" | "RING" | "LINE";
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

  init(): void {
  }

  reset(): void {
    this.state = "ALIVE";
    this.direction = { dx: 0, dy: 0 };
    this.nextDirection = null;
    this.lastDirection = { dx: 1, dy: 0 };
    this.speed = this.normalSpeed;
    this.trailHistory = [];
    this.eatParticles = [];
    this.ghostEatFlash = 0;
  }

  spawn(): void {
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

  update(dt: number): void {
    this.updateTrail(dt);
    this.updateEatParticles(dt);
    if (this.ghostEatFlash > 0) this.ghostEatFlash -= dt * 3;

    if (this.state === "DYING") {
      this.deathTimer += dt;
      if (this.deathTimer >= this.config.deathAnimationDuration) {
        eventBus.emit("pacman:death_animation_end");
      }
      return;
    }
    if (this.gameState.mode !== "PLAYING") return;

    this.speed = this.isBuffed ? this.buffedSpeed : this.normalSpeed;

    if (this.direction.dx !== 0 || this.direction.dy !== 0) {
      this.spawnTrailParticle();
    }

    this.updateMovement(dt);
    this.teleport();

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

    const isHittingWall = this.willHitWall(this.direction, dt);
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

  private getNextPosition(dt: number): { newX: number; newY: number } {
    return {
      newX: this.x + this.direction.dx * this.speed * dt,
      newY: this.y + this.direction.dy * this.speed * dt,
    };
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

  private snapToTileCenter(): void {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    this.x = centerX;
    this.y = centerY;
  }

  private willHitWall(dir: { dx: number; dy: number }, dt: number): boolean {
    if (dir.dx === 0 && dir.dy === 0) return false;
    const moveDistance = this.speed * dt;
    const lookAheadDistance = moveDistance + this.r;
    const boundX = this.x + dir.dx * lookAheadDistance;
    const boundY = this.y + dir.dy * lookAheadDistance;
    const { tileX, tileY } = Collision.getTile(boundX, boundY);
    return Collision.isWall(tileX, tileY);
  }

  changeDirection(dir: { dx: number; dy: number }): void {
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
    const pillIndex = pill.positions.findIndex(
      (pos: { i: number; j: number }) => pos.i === tileY && pos.j === tileX,
    );
    if (pillIndex !== -1) {
      this.spawnPillEatVFX(tileX, tileY);
      eventBus.emit("power_pill:collect", { position: { i: tileY, j: tileX } });
    }
  }

  // --- VFX Engine ---

  private spawnTrailParticle(): void {
    this.trailHistory.push({ x: this.x, y: this.y, alpha: 1.0 });
    if (this.trailHistory.length > 8) {
      this.trailHistory.shift();
    }
  }

  private updateTrail(dt: number): void {
    for (let i = 0; i < this.trailHistory.length; i++) {
      this.trailHistory[i].alpha -= dt * 2.2;
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
        color: "#ffcc00",
        type: "SHARD",
        size: 2 + Math.random() * 2
      });
    }
  }

  private spawnPillEatVFX(tileX: number, tileY: number): void {
    const cx = tileX * this.tileSize + this.tileSize / 2;
    const cy = tileY * this.tileSize + this.tileSize / 2;

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 90 + Math.random() * 40;
      this.eatParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        color: "#ff3300",
        type: "SHARD",
        size: 3
      });
    }
  }

  private spawnGhostEatVFX(gx: number, gy: number): void {
    const particleCount = 28;

    // Outer quantum shockwave ring boundary
    this.eatParticles.push({
      x: gx,
      y: gy,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      color: "#ffffff",
      type: "RING",
      size: 4
    });

    // Vector fragmentation data shards and code lines
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
        color: Math.random() > 0.35 ? "#ffffff" : "#00ffff",
        type: isLine ? "LINE" : "SHARD",
        size: isLine ? 4 + Math.random() * 6 : 2.5 + Math.random() * 2.5
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

      if (p.type !== "RING") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Matrix computational atmosphere drag friction
        p.vx *= 0.93;
        p.vy *= 0.93;
      } else {
        // Linear structural square expansion factor
        p.size += 260 * dt;
      }
    }
  }

  triggerDeath(): void {
    if (this.state === "DYING") return;
    this.state = "DYING";
    this.deathTimer = 0;
    this.speed = 0;
    eventBus.emit("pacman:death_triggered");
    eventBus.emit("pacman:death_animation_start", { x: this.x, y: this.y });
  }

  // --- Rendering Pipeline ---

  draw(): void {
    // Layer 1: Vector trails draw first (bottom layer)
    this.drawTrailVFX();

    // Layer 2: Core entities render in center structure
    if (this.state === "DYING") {
      this.drawDead();
    } else {
      this.drawAlive();
    }

    // Layer 3: High-intensity blast particles drawn over top body (top layer)
    this.drawEatVFX();
  }

  private drawTrailVFX(): void {
    if (this.state === "DYING" || this.trailHistory.length < 2) return;

    const ctx = this.ctx;
    const color = this.isBuffed ? "#ff3300" : "#ffcc00";
    const width = this.r * 0.75;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.lineWidth = 1;

    for (let i = 0; i < this.trailHistory.length - 1; i++) {
      const p1 = this.trailHistory[i];
      const p2 = this.trailHistory[i + 1];
      const alpha = Math.max(0, p2.alpha);
      ctx.globalAlpha = alpha * 0.4;
      ctx.shadowBlur = 8 * alpha;

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
      ctx.shadowBlur = 10 * alpha;

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
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 3.5);
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
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

    let mouthAngle: number;
    const timestamp = Date.now();
    if (isMoving) {
      mouthAngle = Math.abs(Math.sin(timestamp * this.config.mouthSpeed)) * this.config.maxMouthAngle;
    } else {
      mouthAngle = this.config.idleMouthAngle;
    }

    const startAngle = mouthAngle;
    const endAngle = 2 * Math.PI - mouthAngle;

    const neonColor = this.isBuffed ? "#ff3300" : "#ffcc00";
    const coreColor = this.isBuffed ? "#ffaa00" : "#ffffff";

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    if (this.ghostEatFlash > 0) {
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 30 * this.ghostEatFlash;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * this.ghostEatFlash})`;
      ctx.beginPath();
      ctx.arc(0, 0, r + 15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowColor = neonColor;
    ctx.shadowBlur = this.isBuffed ? 16 : 10;
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, startAngle, endAngle);
    
    const innerCutoff = r * 0.4;
    ctx.lineTo(Math.cos(2 * Math.PI - mouthAngle) * innerCutoff, Math.sin(2 * Math.PI - mouthAngle) * innerCutoff);
    ctx.lineTo(Math.cos(mouthAngle) * innerCutoff, Math.sin(mouthAngle) * innerCutoff);
    ctx.closePath();
    
    ctx.fillStyle = this.isBuffed ? "rgba(255, 51, 0, 0.15)" : "rgba(255, 204, 0, 0.08)";
    ctx.fill();
    ctx.stroke();

    ctx.save();
    const spinSpeed = timestamp * (this.isBuffed ? 0.012 : 0.004);
    ctx.rotate(spinSpeed);
    
    ctx.shadowBlur = this.isBuffed ? 10 : 5;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1.5;
    
    const boxSize = r * 0.4;
    ctx.strokeRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);
    
    if (this.isBuffed) {
      ctx.strokeStyle = neonColor;
      ctx.beginPath();
      ctx.moveTo(-boxSize / 2, 0);
      ctx.lineTo(boxSize / 2, 0);
      ctx.moveTo(0, -boxSize / 2);
      ctx.lineTo(0, boxSize / 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();

    ctx.fillStyle = neonColor;
    ctx.fillRect(Math.cos(Math.PI * 0.65) * (r * 0.68) - 1, Math.sin(Math.PI * 0.65) * (r * 0.68) - 1, 2, 2);
    ctx.fillRect(Math.cos(Math.PI * 1.35) * (r * 0.68) - 1, Math.sin(Math.PI * 1.35) * (r * 0.68) - 1, 2, 2);

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

    const neonColor = this.isBuffed ? "#ff3300" : "#ffcc00";
    
    // Stage 1: Structural Grid Distortion Wave
    if (p < 0.4) {
      const glitcheffect = Math.sin(p * 120) * 3 * (p / 0.4);
      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 12 * (1 - p);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(glitcheffect, 0, r - 2, 0, Math.PI * 2);
      ctx.stroke();

      // Deforming core box matrix lines
      ctx.strokeRect((-r * 0.4) / 2, (-r * 0.4) / 2 - glitcheffect, r * 0.4, r * 0.4);
    } 
    // Stage 2: Complete Code Fragment De-Rez Collapse
    else {
      const collapseProgress = (p - 0.4) / 0.6;
      ctx.fillStyle = neonColor;
      ctx.shadowColor = neonColor;
      
      const particleRows = 14;
      for (let i = 0; i < particleRows; i++) {
        const angle = (i / particleRows) * Math.PI * 2;
        
        // Displace coordinate structures down screen like data leaks
        const driftRadius = r * (1 + collapseProgress * 1.8);
        const px = Math.cos(angle) * driftRadius + (Math.sin(i + p * 10) * 4);
        const py = Math.sin(angle) * driftRadius + (collapseProgress * collapseProgress * 45);

        const alpha = Math.max(0, 1 - collapseProgress);
        const blockDimensions = Math.max(1, 3.5 * alpha);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 6 * alpha;
        
        if (i % 3 === 0) {
          // Horizontal binary line segments
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px - blockDimensions * 2, py);
          ctx.lineTo(px + blockDimensions * 2, py);
          ctx.stroke();
        } else {
          // Standard system data shards
          ctx.fillRect(px - blockDimensions / 2, py - blockDimensions / 2, blockDimensions, blockDimensions);
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }
}