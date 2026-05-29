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
  private trailHistory: { x: number; y: number; alpha: number }[] = [];
  private eatParticles: {
    x: number;
    y: number;
    life: number;
    maxLife: number;
    color: string;
  }[] = [];
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
    this.trailHistory = [];
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

  // --- VFX ---

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
    for (let i = 0; i < 4; i++) {
      this.eatParticles.push({
        x: cx,
        y: cy,
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.2 + Math.random() * 0.2,
        color: "#ffcc00", // Dot particles match his TRON yellow theme
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
        color: "#ff3300", // Powered matrix color
      });
    }
  }

  private spawnGhostEatVFX(gx: number, gy: number): void {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.eatParticles.push({
        x: gx + Math.cos(angle) * 10,
        y: gy + Math.sin(angle) * 10,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
        color: "#fff",
      });
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
    this.drawTrailVFX();
    this.drawEatVFX();

    if (this.state === "DYING") {
      this.drawDead();
    } else {
      this.drawAlive();
    }
  }

  // NEW DESIGN: Geometric Grid Ribbon Trail
  private drawTrailVFX(): void {
    if (this.state === "DYING" || this.trailHistory.length < 2) return;

    const ctx = this.ctx;
    const color = this.isBuffed ? "#ff3300" : "#ffcc00";
    const width = this.r * 0.75;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.lineWidth = 1;

    // Draw the parallel bounds of the vector path
    for (let i = 0; i < this.trailHistory.length - 1; i++) {
      const p1 = this.trailHistory[i];
      const p2 = this.trailHistory[i + 1];
      const alpha = Math.max(0, p2.alpha);
      ctx.globalAlpha = alpha * 0.4;
      ctx.shadowBlur = 8 * alpha;

      // Draw lateral data crossbars linking paths to make a literal wire grid
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y - width / 2);
      ctx.lineTo(p1.x, p1.y + width / 2);
      ctx.stroke();

      // Outer bounding wireframes
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
      const alpha = p.life / p.maxLife;
      const size = 3 * alpha;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6 * alpha;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
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

    // Core Colors: TRON Yellow vs Overclocked Red
    const neonColor = this.isBuffed ? "#ff3300" : "#ffcc00";
    const coreColor = this.isBuffed ? "#ffaa00" : "#ffffff";

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // --- 1. OVERCLOCK/FLASH GLOW ---
    if (this.ghostEatFlash > 0) {
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 30 * this.ghostEatFlash;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * this.ghostEatFlash})`;
      ctx.beginPath();
      ctx.arc(0, 0, r + 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- 2. VECTOR OUTER SHELL ---
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = this.isBuffed ? 16 : 10;
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, startAngle, endAngle);
    
    // Visor cutout
    const innerCutoff = r * 0.4;
    ctx.lineTo(Math.cos(2 * Math.PI - mouthAngle) * innerCutoff, Math.sin(2 * Math.PI - mouthAngle) * innerCutoff);
    ctx.lineTo(Math.cos(mouthAngle) * innerCutoff, Math.sin(mouthAngle) * innerCutoff);
    ctx.closePath();
    
    ctx.fillStyle = this.isBuffed ? "rgba(255, 51, 0, 0.15)" : "rgba(255, 204, 0, 0.08)";
    ctx.fill();
    ctx.stroke();

    // --- 3. REDESIGNED CORE: Spinning Quantum Matrix ---
    ctx.save();
    // Core spin speed multiplies significantly when buffed
    const spinSpeed = timestamp * (this.isBuffed ? 0.012 : 0.004);
    ctx.rotate(spinSpeed);
    
    ctx.shadowBlur = this.isBuffed ? 10 : 5;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1.5;
    
    const boxSize = r * 0.4;
    ctx.strokeRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);
    
    // Secondary inner cross line if buffed to make the code core look complex
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

    // --- 4. SYSTEM ACCENT BUS ---
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();

    // Circuit trace nodes
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
    ctx.strokeStyle = neonColor;
    ctx.shadowColor = neonColor;
    
    if (p < 0.8) {
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8 * (1 - p);
      
      for (let i = -1; i <= 1; i += 0.5) {
        const offset = i * r * (1 - p);
        
        ctx.beginPath();
        ctx.globalAlpha = (1 - p) * 0.7;
        ctx.moveTo(-r, offset);
        ctx.lineTo(r, offset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(offset, -r);
        ctx.lineTo(offset, r);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffffff";
    
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const seedX = Math.sin(i * 452.13) * r;
      const seedY = Math.cos(i * 921.51) * r;
      
      const px = seedX;
      const py = seedY - p * 40; 
      
      const alpha = Math.max(0, 1 - p - (i / particleCount) * 0.2);
      const blockSize = 3 * alpha;

      ctx.globalAlpha = alpha;
      if (alpha > 0) {
        ctx.fillRect(px - blockSize / 2, py - blockSize / 2, blockSize, blockSize);
      }
    }

    ctx.restore();
  }
}