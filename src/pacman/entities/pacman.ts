import { CANVAS_CONFIG } from "../config/canvas.js";
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
  private speed: number;
  private lastTeleportExit: { x: number; y: number } | null = null;

  private isBuffed: boolean;

  private mouthOpen: boolean = true;
  private mouthFrameCounter: number = 0;
  private mouthFrameSkip: number = 9; // 1/6 frame rate
  private mouthAngle: number = Math.PI / 4; // 45 degrees for classic wedge

  private deathTimer: number = 0; // 0 to 1

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
        eventBus.emit("COMMAND_GHOST_EATEN", { ghostName: collidedGhost.name });
      } else if (
        collidedGhost.state !== "FRIGHTENED" &&
        collidedGhost.state !== "EATEN"
      ) {
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
  }

  // 🌟 ОБНОВЛЕННОЕ ДВИЖЕНИЕ
  private updateMovement(dt: number) {
    this.checkAndTeleport();

    // СИСТЕМА СТАРТА: Если Пакман стоит, сразу даем ему новое направление
    if (
      this.direction.dx === 0 &&
      this.direction.dy === 0 &&
      this.nextDirection
    ) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
    }

    // Обработка намерения повернуть на перекрестке
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

    this.handleCollisionWithEatable(newX, newY);
  }

  private getNextPosition() {
    return {
      newX: this.x + this.direction.dx * this.speed,
      newY: this.y + this.direction.dy * this.speed,
    };
  }

  private tryExecuteTurn(): void {
    if (!this.nextDirection) return;

    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);
    const { tileX, tileY } = this.collision.getTile(this.x, this.y);

    // Разворот на 180 градусов
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
    const isTargetWall = this.collision.isWall(targetTileX, targetTileY);

    if (isTargetWall) return;

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
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);
    const pullSpeed = 0.3;

    if (this.direction.dx !== 0) {
      this.y += (centerY - this.y) * pullSpeed;
    }
    if (this.direction.dy !== 0) {
      this.x += (centerX - this.x) * pullSpeed;
    }
  }

  private snapToTileCenter() {
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);
    this.x = centerX;
    this.y = centerY;
  }

  private willHitWall(dir: { dx: number; dy: number }): boolean {
    if (dir.dx === 0 && dir.dy === 0) return false;

    const lookAheadDistance = this.speed + this.r;
    const boundX = this.x + dir.dx * lookAheadDistance;
    const boundY = this.y + dir.dy * lookAheadDistance;

    const { tileX, tileY } = this.collision.getTile(boundX, boundY);

    return this.collision.isWall(tileX, tileY);
  }

  public changeDirection(dir: { dx: number; dy: number }) {
    this.nextDirection = dir;
  }

  // 🌟 ВСЁ ОСТАЛЬНОЕ (Транспортная система, еда, отрисовка)

  private checkAndTeleport() {
    const { tileX, tileY } = this.collision.getTile(this.x, this.y);

    if (this.lastTeleportExit) {
      if (
        tileX === this.lastTeleportExit.x &&
        tileY === this.lastTeleportExit.y
      ) {
        return;
      } else {
        this.lastTeleportExit = null;
      }
    }

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
      eventBus.emit("DOT_EATEN");
    }
  }

  private tryEatPill(tileX: number, tileY: number) {
    const pill = this.entityManager.getPill();
    const pillIndex = pill.positions.findIndex(
      (pos) => pos.i === tileY && pos.j === tileX,
    );

    if (pillIndex !== -1) {
      pill.eat(tileY, tileX);
      eventBus.emit("POWER_PILL_EATEN");
      eventBus.emit("POWER_PILL_EATEN_BY_PACMAN");
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

    const p = Math.min(1, this.deathTimer / customDeathDuration);

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

    const startMouthAngle = this.mouthAngle || Math.PI / 4;
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

  private getRotation(): number {
    if (this.direction.dx === -1) return Math.PI;
    if (this.direction.dx === 1) return 0;
    if (this.direction.dy === -1) return -Math.PI / 2;
    if (this.direction.dy === 1) return Math.PI / 2;
    return 0;
  }
}

export { Pacman };
