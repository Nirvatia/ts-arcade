// src/entities/Pacman.ts
import { CANVAS_CONFIG } from "../config/canvas.js";
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
  private tally: Tally;

  public state: "ALIVE" | "EATEN" | "DYING" = "ALIVE";
  public nextDirection: { dx: number; dy: number } | null = null;

  private isBuffed: boolean = false;
  private deathTimer: number = 0;
  private color: string = "rgb(255, 255, 0)";

  constructor() {
    super(CANVAS_CONFIG.canvasIds.pacman);
    this.registry = GameRegistry.getInstance();
    this.tally = Tally.getInstance();
    this.speed = Math.round((this.tileSize / 8) * 10) / 10;
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

    this.updateMovement();
    this.checkAndTeleport();

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

  private updateMovement(): void {
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

    const isHittingWall = this.willHitWall(this.direction);
    if (isHittingWall) {
      this.snapToTileCenter();
      return;
    }

    const { newX, newY } = this.getNextPosition();
    this.x = newX;
    this.y = newY;

    this.smoothAlignToAxis();

    const { tileX, tileY } = Collision.getTile(this.x, this.y);
    this.tryEatFood(tileX, tileY);
    this.tryEatPill(tileX, tileY);
  }

  private getNextPosition(): { newX: number; newY: number } {
    return {
      newX: this.x + this.direction.dx * this.speed,
      newY: this.y + this.direction.dy * this.speed,
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

  private willHitWall(dir: { dx: number; dy: number }): boolean {
    if (dir.dx === 0 && dir.dy === 0) return false;

    const lookAheadDistance = this.speed + this.r;
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
      dot.eat(tileY, tileX);
      this.tally.addDot();
      this.tally.checkBonusLife();
    }
  }

  private tryEatPill(tileX: number, tileY: number): void {
    const pill = this.registry.getPills();
    const pillIndex = pill.positions.findIndex(
      (pos: { i: number; j: number }) => pos.i === tileY && pos.j === tileX,
    );

    if (pillIndex !== -1) {
      pill.eat(tileY, tileX);
      this.tally.addPowerPellet();
      this.tally.checkBonusLife();
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

  draw(animate: boolean, dt: number): void {
    if (this.state === "DYING") {
      this.drawDead(dt);
    } else {
      this.drawNormal(animate);
    }
  }

  private getRotation(): number {
    if (this.direction.dx === -1) return Math.PI;
    if (this.direction.dx === 1) return 0;
    if (this.direction.dy === -1) return -Math.PI / 2;
    if (this.direction.dy === 1) return Math.PI / 2;
    return 0;
  }

  private drawNormal(animate: boolean): void {
    const cx = this.x;
    const cy = this.y;
    const r = this.r;
    const rotation = this.getRotation();

    this.ctx.fillStyle = this.color;
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotation);

    if (animate) {
      const maxMouthAngle = Math.PI / 2.8;
      const animationSpeed = 0.015;
      const currentAperture =
        Math.abs(Math.sin(Date.now() * animationSpeed)) * maxMouthAngle;

      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, currentAperture, 2 * Math.PI - currentAperture);
      this.ctx.lineTo(0, 0);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private drawDead(dt: number): void {
    this.deathTimer += dt;
    const customDeathDuration = 1500;

    // THE FIX: Never transition to ALIVE here.
    // Director controls when Pacman resets via resetPositionsForDeath()
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
