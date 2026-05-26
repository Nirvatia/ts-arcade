// src/entities/Pacman.ts
import { CFG_CANVAS } from "../config/canvas.js";
import { Collision } from "../core/collision.js";
import { eventBus } from "../core/eventBus.js";
import { GameRegistry } from "../game/gameRegistry.js";

import { Tally } from "../game/tally.js";
import { Actor } from "./actor.js";
import type { Ghost } from "./ghost.js";

/**
 * Пакман — главный игровой персонаж.
 * Управляется игроком, ест точки и призраков.
 */
export class Pacman extends Actor {
  private registry: GameRegistry;

  public state: "ALIVE" | "EATEN" | "DYING" = "ALIVE";
  public nextDirection: { dx: number; dy: number } | null = null;

  private isBuffed: boolean = false;
  private deathTimer: number = 0;
  private color: string = "rgb(255, 255, 0)";

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
    if (this.state === "DYING") return;

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

    // Разворот на 180
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
    if (this.direction.dx === -1) return Math.PI;
    if (this.direction.dx === 1) return 0;
    if (this.direction.dy === -1) return -Math.PI / 2;
    if (this.direction.dy === 1) return Math.PI / 2;
    return 0;
  }

  private drawAlive(): void {
    const cx = this.x;
    const cy = this.y;
    const r = this.r;
    const rotation = this.getRotation();

    this.ctx.fillStyle = this.color;
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotation);

    // Check if Pacman is actively moving
    const isMoving = this.direction.dx !== 0 || this.direction.dy !== 0;

    const maxMouthAngle = Math.PI / 2.8;
    let currentAperture = 0;

    if (isMoving) {
      // Animate mouth only when moving
      const animationSpeed = 0.015;
      currentAperture =
        Math.abs(Math.sin(Date.now() * animationSpeed)) * maxMouthAngle;
    } else {
      // Keep mouth static (slightly open) when hitting a wall / stationary
      currentAperture = maxMouthAngle * 0.5;
    }

    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, currentAperture, 2 * Math.PI - currentAperture);
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawDead(): void {
    const customDeathDuration = 1500;

    const p = Math.min(1, this.deathTimer / customDeathDuration);

    const cx = this.x;
    const cy = this.y;
    const r = this.r;

    this.ctx.save();

    if (p > 0.7 && p < 0.9) {
      const shakeX = (Math.random() - 0.5) * 4;
      const shakeY = (Math.random() - 0.5) * 4;
      this.ctx.translate(cx + shakeX, cy + shakeY);
    } else {
      this.ctx.translate(cx, cy);
    }

    this.ctx.rotate(this.getRotation());
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);

    const startMouthAngle = Math.PI / 4;
    const mouthAperture = startMouthAngle + (Math.PI - startMouthAngle) * p;

    this.ctx.arc(0, 0, r, mouthAperture, 2 * Math.PI - mouthAperture);
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();

    if (p > 0.9) {
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * (1 - p) * 8, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }
}
