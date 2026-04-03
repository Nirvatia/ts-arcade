import { CANVAS_CONFIG } from "../config/canvas.js";
import { AudioManager } from "../game/audio.js";
import { Collision } from "../game/collision.js";
import { eventBus } from "../game/eventBus.js";
import { GameState } from "../game/state.js";
import { Entity } from "./entity.js";
import { EntityManager } from "./entityManager.js";
import type { Ghost } from "./ghost.js";

class Pacman extends Entity {
  private gameState: GameState;
  private entityManager: EntityManager;
  private collision: Collision;

  public state: "ALIVE" | "EATEN" | "DYING" = "ALIVE";
  public x: number;
  public y: number;
  public direction: { dx: number; dy: number };
  public nextDirection: { dx: number; dy: number } | null;
  private needsAligning: boolean;
  private isTurning: boolean;
  private speed: number;
  private lastTeleportExit: { x: number; y: number } | null = null;

  private isBuffed: boolean;

  private mouthOpen: boolean = true;
  private mouthFrameCounter: number = 0;
  private mouthFrameSkip: number = 9; // 1/6 frame rate
  private mouthAngle: number = Math.PI / 4; // 45 degrees for classic wedge

  private deathTimer: number = 0; // 0 to 1
  private deathDuration: number = 3000; // 1 second death animation

  private r: number;
  private color: string;

  constructor() {
    super(CANVAS_CONFIG.canvasIds.pacman, true);

    this.gameState = GameState.getInstance();
    this.entityManager = EntityManager.getInstance();
    this.collision = Collision.getInstance();

    this.x = 0;
    this.y = 0;
    this.direction = { dx: 0, dy: 0 };
    this.nextDirection = null;
    this.needsAligning = false;
    this.isTurning = false;
    this.speed = Math.round((this.tileSize / 8) * 10) / 10;
    this.isBuffed = false;
    this.r = this.tileSize * 0.45;
    this.color = "rgb(255, 255, 0)";
  }

  public override init() {
    this.spawn();
    this.initEventListeners();
  }

  private initEventListeners() {
    eventBus.on("POWER_PILL_EATEN", () => {
      this.isBuffed = true;
    });

    eventBus.on("POWER_PILL_EXPIRED", () => {
      this.isBuffed = false;
    });
  }

  public override reset() {
    this.isBuffed = false;
    this.mouthOpen = true;
    this.direction = { dx: 0, dy: 0 };
    this.nextDirection = null;
    this.spawn();
  }

  public override resetForLevel() {
    this.reset();
    this.spawn();
  }

  public update(dt: number) {
    if (this.state === "DYING" || this.gameState.mode !== "PLAYING") return;

    this.updateMovement(dt);

    const collidedGhost = this.getCollidedGhost();

    if (collidedGhost) {
      if (this.isBuffed && collidedGhost.state === "FRIGHTENED") {
        // 1. Tell the system a ghost was eaten (for scoring)
        this.gameState.updateScore("GHOST");

        eventBus.emit("GHOST_EATEN", { ghostName: collidedGhost.name });
      } else if (collidedGhost.state !== "EATEN") {
        // Only die if the ghost isn't already "eyes" returning to base
        this.triggerDeath();
        this.gameState.triggerDeathSequence();
      }
    }
  }

  public spawn() {
    const map = this.gameState.levelData.map;

    for (let y = 0; y < map.length; y++) {
      let x = map[y].findIndex((tile: string) => tile === "PM");
      if (x !== -1) {
        this.x = x * this.tileSize + this.tileSize;
        this.y = y * this.tileSize + this.tileSize / 2;
        return;
      }
    }
  }

  public triggerDeath(): void {
    this.state = "DYING";
    this.deathTimer = 0;

    // 🔥 This circumvents circular references!
    const audioManager = AudioManager.getInstance();
    audioManager.stopMusic();
    audioManager.playSFX("death");
  }

  private updateMovement(dt: number) {
    if (this.willHitWall()) return;

    this.checkAndTeleport();

    if (this.isTurning) this.tryTurn();

    const { newX, newY } = this.getNextPosition();

    this.x = newX;
    this.y = newY;

    if (this.needsAligning) this.alignToAxis();

    this.handleCollisionWithEatable(newX, newY);
  }

  private getNextPosition() {
    return {
      newX: this.x + this.direction.dx * this.speed,
      newY: this.y + this.direction.dy * this.speed,
    };
  }

  private snapToTileCenter() {
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);

    if (this.direction.dx !== 0) this.x = centerX;
    if (this.direction.dy !== 0) this.y = centerY;
  }

  private alignToAxis(): void {
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);

    const tolerance = Math.floor(2 * this.speed);

    if (this.direction.dx !== 0 && Math.abs(this.y - centerY) < tolerance)
      this.y = centerY;
    if (this.direction.dy !== 0 && Math.abs(this.x - centerX) < tolerance)
      this.x = centerX;

    this.needsAligning = false;
  }

  private isAtTileCenter(): boolean {
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);

    const tolerance = 3 * this.speed;

    if (
      (this.direction.dx !== 0 && Math.abs(this.x - centerX) <= tolerance) ||
      (this.direction.dy !== 0 && Math.abs(this.y - centerY) <= tolerance)
    ) {
      return true;
    }

    return false;
  }

  private isNextTileWall(): boolean {
    if (!this.nextDirection) return false;

    const { tileX, tileY } = this.collision.getTile(this.x, this.y);

    const nextTileX = tileX + this.nextDirection.dx;
    const nextTileY = tileY + this.nextDirection.dy;

    return this.collision.isWall(nextTileX, nextTileY);
  }

  private willChangeAxis(): boolean {
    if (!this.nextDirection) return false;

    return (
      (this.direction.dx !== 0 && this.nextDirection.dy !== 0) ||
      (this.direction.dy !== 0 && this.nextDirection.dx !== 0)
    );
  }

  public changeDirection(dir: { dx: number; dy: number }) {
    this.nextDirection = dir;

    if (!this.willChangeAxis() && !this.isNextTileWall()) {
      this.direction = this.nextDirection;
      return;
    }

    if (!this.tryTurn()) this.tryBufferTurn();
  }

  private tryTurn(): boolean {
    if (!this.nextDirection) return false;

    if (this.isAtTileCenter() && !this.isNextTileWall()) {
      this.snapToTileCenter();
      this.direction = this.nextDirection;
      this.nextDirection = null;
      this.isTurning = false;
      this.needsAligning = true;

      return true;
    }

    return false;
  }

  private tryBufferTurn() {
    if (!this.nextDirection) return false;

    const { tileX, tileY } = this.collision.getTile(this.x, this.y);

    const bufferTileX =
      tileX +
      (this.direction.dx !== 0 ? this.direction.dx : this.nextDirection.dx);
    const bufferTileY =
      tileY +
      (this.direction.dy !== 0 ? this.direction.dy : this.nextDirection.dy);

    if (!this.collision.isWall(bufferTileX, bufferTileY)) this.isTurning = true;
  }

  private willHitWall(): boolean {
    const boundX = this.x + this.direction.dx * (this.speed + this.r);
    const boundY = this.y + this.direction.dy * (this.speed + this.r);

    const { tileX, tileY } = this.collision.getTile(boundX, boundY);

    return this.collision.isWall(tileX, tileY);
  }

  private checkAndTeleport() {
    const { tileX, tileY } = this.collision.getTile(this.x, this.y);

    // If we just teleported, check if Pacman has moved off the exit tile
    if (this.lastTeleportExit) {
      if (
        tileX === this.lastTeleportExit.x &&
        tileY === this.lastTeleportExit.y
      ) {
        // Still on exit tile, do nothing
        return;
      } else {
        // Pacman has left exit tile
        this.lastTeleportExit = null;
      }
    }

    // Normal teleport check
    if (this.collision.isTeleport(tileX, tileY)) {
      const exit = this.collision.getTeleportExit(tileX, tileY);

      if (exit) {
        this.x = exit.x * this.tileSize + this.tileSize / 2;
        this.y = exit.y * this.tileSize + this.tileSize / 2;
        this.lastTeleportExit = exit;
      }
    }
  }

  private getCollidedGhost(): Ghost | null {
    const ghosts = this.entityManager.getGhosts();
    for (const g of ghosts) {
      const distance = Math.sqrt((this.x - g.x) ** 2 + (this.y - g.y) ** 2);
      if (distance < this.r + g.r) return g;
    }
    return null;
  }

  private handleCollisionWithEatable(x: number, y: number) {
    const { tileX, tileY } = this.collision.getTile(this.x, this.y);
    this.tryEatFood(tileX, tileY);
    this.tryEatPill(tileX, tileY);
  }

  public hasCollidedWithGhost(): boolean {
    const ghosts = this.entityManager.getGhosts();

    for (const g of ghosts) {
      const distance = Math.sqrt((this.x - g.x) ** 2 + (this.y - g.y) ** 2);
      const collisionDistance = this.r + g.r;

      if (distance < collisionDistance) {
        return true;
      }
    }

    return false;
  }

  private tryEatFood(tileX: number, tileY: number) {
    const food = this.entityManager.getFood();
    if (food.positions.has(`${tileY},${tileX}`)) {
      food.eat(tileY, tileX);
      this.gameState.updateScore("DOT");
    }
  }

  private tryEatPill(tileX: number, tileY: number) {
    const pill = this.entityManager.getPill();
    const pillIndex = pill.positions.findIndex(
      (pos) => pos.i === tileY && pos.j === tileX,
    );

    if (pillIndex !== -1) {
      pill.eat(tileY, tileX);
      this.gameState.updateScore("POWER_PELLET");
    }
  }

  public draw(animate: boolean, dt: number): void {
    if (this.state === "DYING") {
      this.drawDead(dt);
    } else {
      this.drawNormal(animate);
    }
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

    if (this.mouthOpen) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, this.mouthAngle, 2 * Math.PI - this.mouthAngle);
      this.ctx.lineTo(0, 0);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    this.ctx.restore();

    if (animate) {
      this.mouthFrameCounter++;
      if (this.mouthFrameCounter < this.mouthFrameSkip) return;

      this.mouthFrameCounter = 0;
      this.mouthOpen = !this.mouthOpen;
    }
  }

  private drawDead(dt: number): void {
    this.deathTimer += dt;

    // 🔥 THE FIX: Speed up the duration!
    // Let's set it to 1.5 seconds (1500ms) instead of 3000ms.
    const customDeathDuration = 1500;

    if (this.deathTimer >= customDeathDuration) {
      this.state = "ALIVE";
      this.deathTimer = 0;
      this.gameState.completeDeathSequence();
      return;
    }

    const cx = this.x;
    const cy = this.y;
    const r = this.r;

    // Use the new custom duration for our progress percentage
    const p = Math.min(1, this.deathTimer / customDeathDuration);

    this.ctx.save();

    // 🌟 ADDITION: Screen shake right before he vanishes!
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

    const startMouthAngle = this.mouthAngle || Math.PI / 4;
    const mouthAperture = startMouthAngle + (Math.PI - startMouthAngle) * p;

    this.ctx.arc(0, 0, r, mouthAperture, 2 * Math.PI - mouthAperture);

    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();

    // The classic arcade "spark" pop
    if (p > 0.9) {
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * (1 - p) * 8, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private getRotation(): number {
    if (this.direction.dx === -1) return Math.PI;
    if (this.direction.dx === 1) return 0;
    if (this.direction.dy === -1) return -Math.PI / 2;
    if (this.direction.dy === 1) return Math.PI / 2;
    return 0;
  }
}

export { Pacman };
