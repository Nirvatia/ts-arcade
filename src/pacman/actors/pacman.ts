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

  private isBuffed: boolean = false;
  private deathTimer: number = 0;
  private lastDirection: { dx: number; dy: number } = { dx: 1, dy: 0 };

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
    this.speed = this.normalSpeed;
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
      this.speed = this.buffedSpeed;
    });

    eventBus.on("power_pill:expired", () => {
      this.isBuffed = false;
      this.speed = this.normalSpeed;
    });
  }

  // --- Update ---

  update(dt: number): void {
    if (this.state === "DYING") {
      this.deathTimer += dt;
      if (this.deathTimer >= this.config.deathAnimationDuration) {
        eventBus.emit("pacman:death_animation_end");
      }
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
    this.speed = 0;
    eventBus.emit("pacman:death_triggered");
    eventBus.emit("pacman:death_animation_start", { x: this.x, y: this.y });
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
    const cx = this.x;
    const cy = this.y;
    const r = this.r;
    const rotation = this.getRotation();
    const isMoving = this.direction.dx !== 0 || this.direction.dy !== 0;

    let mouthAngle: number;
    if (isMoving) {
      mouthAngle =
        Math.abs(Math.sin(Date.now() * this.config.mouthSpeed)) *
        this.config.maxMouthAngle;
    } else {
      mouthAngle = this.config.idleMouthAngle;
    }

    const startAngle = mouthAngle;
    const endAngle = 2 * Math.PI - mouthAngle;

    const colors = this.isBuffed
      ? this.config.colors.buffed
      : this.config.colors.normal;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotation);

    this.ctx.shadowColor = colors.glow;
    this.ctx.shadowBlur = 4;

    this.ctx.fillStyle = colors.body;
    this.ctx.strokeStyle = colors.stroke;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r - 1, startAngle, endAngle);
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

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
      for (
        let currentR = r * collapseScale;
        currentR > r * 0.05;
        currentR -= r * 0.3
      ) {
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
