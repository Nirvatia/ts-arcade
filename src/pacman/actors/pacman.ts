// src/entities/Pacman.ts
import { CFG_CANVAS } from "../config/canvas.js";
import type { PacmanConfig } from "../config/pacman.js";
import { Collision } from "../core/collision.js";
import { eventBus } from "../core/eventBus.js";
import { GameRegistry } from "../game/gameRegistry.js";
import { Actor } from "./actor.js";
import type { Ghost } from "./ghost.js";

export class Pacman extends Actor {
  private registry: GameRegistry;
  private config: PacmanConfig;

  public state: "ALIVE" | "EATEN" | "DYING" = "ALIVE";
  public nextDirection: { dx: number; dy: number } | null = null;

  private deathTimer: number = 0;
  private lastDirection: { dx: number; dy: number } = { dx: 1, dy: 0 };
  
  // VFX state
  private trailParticles: { x: number; y: number; life: number; maxLife: number }[] = [];
  private eatParticles: { x: number; y: number; life: number; maxLife: number; color: string }[] = [];
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
    this.spawn();
  }

  reset(): void {
    this.state = "ALIVE";
    this.direction = { dx: 0, dy: 0 };
    this.nextDirection = null;
    this.lastDirection = { dx: 1, dy: 0 };
    this.speed = this.normalSpeed;
    this.trailParticles = [];
    this.eatParticles = [];
    this.ghostEatFlash = 0;
    this.spawn();
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
    // Update VFX
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
    
    // Spawn trail particles while moving
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
    if (this.direction.dx === 0 && this.direction.dy === 0 && this.nextDirection) {
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

    this.smoothAlignToAxis();

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

    if (this.nextDirection.dx === -this.direction.dx && this.nextDirection.dy === -this.direction.dy) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
      return;
    }

    const targetTileX = tileX + this.nextDirection.dx;
    const targetTileY = tileY + this.nextDirection.dy;
    if (Collision.isWall(targetTileX, targetTileY)) return;

    const turnThreshold = this.tileSize * this.config.turnThreshold;
    const distanceToCenter = Math.sqrt((this.x - centerX) ** 2 + (this.y - centerY) ** 2);

    if (distanceToCenter < turnThreshold) {
      if (this.nextDirection.dx !== 0) this.y = centerY;
      if (this.nextDirection.dy !== 0) this.x = centerX;
      this.direction = this.nextDirection;
      this.nextDirection = null;
    }
  }

  private smoothAlignToAxis(): void {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    const pullSpeed = this.config.axisAlignSpeed;
    if (this.direction.dx !== 0) {
      this.y += (centerY - this.y) * pullSpeed;
    }
    if (this.direction.dy !== 0) {
      this.x += (centerX - this.x) * pullSpeed;
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

  // --- VFX ---

  private spawnTrailParticle(): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.r * 0.6;
    this.trailParticles.push({
      x: this.x + Math.cos(angle) * dist,
      y: this.y + Math.sin(angle) * dist,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.3 + Math.random() * 0.3,
    });
    if (this.trailParticles.length > 15) this.trailParticles.shift();
  }

  private spawnDotEatVFX(tileX: number, tileY: number): void {
    const cx = tileX * this.tileSize + this.tileSize / 2;
    const cy = tileY * this.tileSize + this.tileSize / 2;
    for (let i = 0; i < 4; i++) {
      this.eatParticles.push({
        x: cx,
        y: cy,
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.2 + Math.random() * 0.2,
        color: '#0ff',
      });
    }
  }

  private spawnPillEatVFX(tileX: number, tileY: number): void {
    const cx = tileX * this.tileSize + this.tileSize / 2;
    const cy = tileY * this.tileSize + this.tileSize / 2;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      this.eatParticles.push({
        x: cx + Math.cos(angle) * 5,
        y: cy + Math.sin(angle) * 5,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.4 + Math.random() * 0.3,
        color: '#f0f',
      });
    }
  }

  private spawnGhostEatVFX(gx: number, gy: number): void {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      this.eatParticles.push({
        x: gx + Math.cos(angle) * 10,
        y: gy + Math.sin(angle) * 10,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
        color: '#fff',
      });
    }
  }

  private updateTrail(dt: number): void {
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      this.trailParticles[i].life -= dt;
      if (this.trailParticles[i].life <= 0) {
        this.trailParticles.splice(i, 1);
      }
    }
  }

  private updateEatParticles(dt: number): void {
    for (let i = this.eatParticles.length - 1; i >= 0; i--) {
      this.eatParticles[i].life -= dt;
      if (this.eatParticles[i].life <= 0) {
        this.eatParticles.splice(i, 1);
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

  // --- Draw ---

  draw(): void {
    // Draw VFX behind Pacman
    this.drawTrailVFX();
    this.drawEatVFX();
    
    if (this.state === "DYING") {
      this.drawDead();
    } else {
      this.drawAlive();
    }
  }

  private drawTrailVFX(): void {
    if (this.state === "DYING") return;
    
    const ctx = this.ctx;
    const color = this.isBuffed ? '#0ff' : '#e6c800';
    
    for (const p of this.trailParticles) {
      const alpha = p.life / p.maxLife;
      const size = 2 * alpha;
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4 * alpha;
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawEatVFX(): void {
    const ctx = this.ctx;
    
    for (const p of this.eatParticles) {
      const alpha = p.life / p.maxLife;
      const size = 3 * alpha;
      const dist = (1 - alpha) * 20;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6 * alpha;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      // Diamond particles
      ctx.moveTo(p.x, p.y - size);
      ctx.lineTo(p.x + size, p.y);
      ctx.lineTo(p.x, p.y + size);
      ctx.lineTo(p.x - size, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private getRotation(): number {
    const dir = this.direction.dx !== 0 || this.direction.dy !== 0 ? this.direction : this.lastDirection;
    if (dir.dx === -1) return Math.PI;
    if (dir.dx === 1) return 0;
    if (dir.dy === -1) return -Math.PI / 2;
    if (dir.dy === 1) return Math.PI / 2;
    return 0;
  }

  private drawAlive(): void {
    const cx = this.x;
    const cy = this.y;
    const r = this.r;
    const rotation = this.getRotation();
    const isMoving = this.direction.dx !== 0 || this.direction.dy !== 0;

    let mouthAngle: number;
    if (isMoving) {
      mouthAngle = Math.abs(Math.sin(Date.now() * this.config.mouthSpeed)) * this.config.maxMouthAngle;
    } else {
      mouthAngle = this.config.idleMouthAngle;
    }

    const startAngle = mouthAngle;
    const endAngle = 2 * Math.PI - mouthAngle;

    const colors = this.isBuffed ? this.config.colors.buffed : this.config.colors.normal;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotation);

    // Ghost eat flash
    if (this.ghostEatFlash > 0) {
      this.ctx.shadowColor = '#fff';
      this.ctx.shadowBlur = 20 * this.ghostEatFlash;
      this.ctx.fillStyle = `rgba(255,255,255,${0.2 * this.ghostEatFlash})`;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Outer glow
    this.ctx.shadowColor = colors.glow;
    this.ctx.shadowBlur = this.ghostEatFlash > 0 ? 12 : 6;
    
    // Solid body
    this.ctx.fillStyle = colors.body;
    this.ctx.strokeStyle = colors.stroke;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r - 1, startAngle, endAngle);
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Inner highlight
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    this.ctx.lineWidth = 1.5;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = "transparent";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.55, startAngle + 0.3, endAngle - 0.3);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawDead(): void {
    const p = Math.min(1, this.deathTimer / this.config.deathAnimationDuration);
    const cx = this.x;
    const cy = this.y;
    const r = this.r;
    const rotation = this.getRotation();

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotation);

    const startAngle = Math.PI / 4;
    const mouthAngle = startAngle + (Math.PI - startAngle) * p;
    const start = mouthAngle;
    const end = 2 * Math.PI - mouthAngle;

    this.ctx.strokeStyle = "#e6c800";
    this.ctx.shadowColor = "#e6c800";
    this.ctx.shadowBlur = 3 * (1 - p);
    this.ctx.lineWidth = 1.5;

    const collapseScale = 1 - p;
    if (collapseScale > 0.05) {
      for (let currentR = r * collapseScale; currentR > r * 0.05; currentR -= r * 0.3) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, currentR, start, end, false);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(Math.cos(start) * currentR, Math.sin(start) * currentR);
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(Math.cos(end) * currentR, Math.sin(end) * currentR);
        this.ctx.stroke();
      }
    }

    if (p > 0.9) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = "#ffffff";
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * (1 - p) * 8, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }
}