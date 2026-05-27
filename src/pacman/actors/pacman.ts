// src/entities/Pacman.ts
import { CFG_CANVAS } from "../config/canvas.js";
import { Collision } from "../core/collision.js";
import { eventBus } from "../core/eventBus.js";
import { GameRegistry } from "../game/gameRegistry.js";
import { Actor } from "./actor.js";
import type { Ghost } from "./ghost.js";

export class Pacman extends Actor {
  private registry: GameRegistry;

  public state: "ALIVE" | "EATEN" | "DYING" = "ALIVE";
  public nextDirection: { dx: number; dy: number } | null = null;

  private isBuffed: boolean = false;
  private deathTimer: number = 0;
  private lastDirection: { dx: number; dy: number } = { dx: 1, dy: 0 };

  constructor() {
    super(CFG_CANVAS.canvasIds.pacman);
    this.registry = GameRegistry.getInstance();
    this.speed = this.tileSize * 4.4;
    this.r = this.tileSize * 0.5;
  }

  // --- Lifecycle ---

  init(): void {
    this.spawn();
    this.initEventListeners();
  }

  reset(): void {
    this.isBuffed = false;
    this.state = "ALIVE";
    this.direction = { dx: 0, dy: 0 };
    this.nextDirection = null;
    this.lastDirection = { dx: 1, dy: 0 };
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

  private initEventListeners(): void {
    eventBus.on("power_pill:activated", () => {
      this.isBuffed = true;
    });
    eventBus.on("power_pill:expired", () => {
      this.isBuffed = false;
    });
  }

  // --- Update ---

  update(dt: number): void {
    if (this.state === "DYING") {
      this.deathTimer += dt;
      return;
    }
    if (this.gameState.mode !== "PLAYING") return;

    this.updateMovement(dt);
    this.teleport();

    const collidedGhost = this.getCollidedGhost();
    if (collidedGhost) {
      if (this.isBuffed && collidedGhost.state === "FRIGHTENED") {
        eventBus.emit("command:ghost_eaten", { ghostName: collidedGhost.name });
      } else if (
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

    const turnThreshold = this.tileSize * 0.5;
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

  private smoothAlignToAxis(): void {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    const pullSpeed = 0.3;
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

  // --- Collision ---

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
      eventBus.emit("dot:collect", { position: { i: tileY, j: tileX } });
    }
  }

  private tryEatPill(tileX: number, tileY: number): void {
    const pill = this.registry.getPills();
    const pillIndex = pill.positions.findIndex(
      (pos: { i: number; j: number }) => pos.i === tileY && pos.j === tileX,
    );
    if (pillIndex !== -1) {
      eventBus.emit("power_pill:collect", { position: { i: tileY, j: tileX } });
    }
  }

  // --- Death ---

  triggerDeath(): void {
    if (this.state === "DYING") return;
    this.state = "DYING";
    this.deathTimer = 0;
    eventBus.emit("pacman:death_triggered");
  }

  // --- Draw ---

  draw(): void {
    if (this.state === "DYING") {
      this.drawDead();
    } else {
      this.drawAlive();
    }
  }

  private getRotation(): number {
    const dir = this.direction.dx !== 0 || this.direction.dy !== 0 
      ? this.direction 
      : this.lastDirection;
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

    const maxMouthAngle = Math.PI / 2.8;
    let mouthAngle: number;
    if (isMoving) {
      mouthAngle = Math.abs(Math.sin(Date.now() * 0.015)) * maxMouthAngle;
    } else {
      mouthAngle = maxMouthAngle * 0.5;
    }

    const startAngle = mouthAngle;
    const endAngle = 2 * Math.PI - mouthAngle;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotation);

    const bodyColor = this.isBuffed ? "#00c8d4" : "#e6c800";
    const strokeColor = this.isBuffed ? "#008a94" : "#b8a000";
    
    // Very subtle outer glow
    this.ctx.shadowColor = bodyColor;
    this.ctx.shadowBlur = 4;
    
    // Solid body
    this.ctx.fillStyle = bodyColor;
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r - 1, startAngle, endAngle);
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Inner highlight arc
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    this.ctx.lineWidth = 1.5;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = "transparent";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.6, startAngle + 0.3, endAngle - 0.3);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawDead(): void {
    const deathDuration = 1.5;
    const p = Math.min(1, this.deathTimer / deathDuration);
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