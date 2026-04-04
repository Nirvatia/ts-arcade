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
    // Listen to the actual event emitted by GameState when the buff active timer ticks
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
      // Use Pacman's local truth!
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

  private updateMovement(dt: number) {
    this.checkAndTeleport();

    // 1. Process intent to turn first
    if (this.nextDirection) {
      this.tryExecuteTurn();
    }

    // 2. Are we currently hitting a wall in our active direction?
    const isHittingWall = this.willHitWall(this.direction);

    if (isHittingWall) {
      // Snap strictly to the center of the current tile when stopping
      this.snapToTileCenter();
      return;
    }

    // 3. Normal movement
    const { newX, newY } = this.getNextPosition();
    this.x = newX;
    this.y = newY;

    // 4. Smooth corner drift (Subtle axis alignment)
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

    // If reversing direction (180 degree flip), let them do it instantly anywhere!
    if (
      this.nextDirection.dx === -this.direction.dx &&
      this.nextDirection.dy === -this.direction.dy
    ) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
      return;
    }

    // Check if the target corridor is actually open
    const targetTileX = tileX + this.nextDirection.dx;
    const targetTileY = tileY + this.nextDirection.dy;
    const isTargetWall = this.collision.isWall(targetTileX, targetTileY);

    if (isTargetWall) return; // Can't turn into a wall

    // BROAD TOLERANCE: Can we begin the turn?
    // We let Pac-Man turn if he is within half a tile's distance of the center.
    const turnThreshold = this.tileSize * 0.5;
    const distanceToCenter = Math.sqrt(
      (this.x - centerX) ** 2 + (this.y - centerY) ** 2,
    );

    if (distanceToCenter < turnThreshold) {
      // 🌟 CORNER CUTTING: Shift his position toward the center of the lane we are turning into
      // This pulls him diagonally into the turn instead of making hard 90-degree angle snaps!
      if (this.nextDirection.dx !== 0) this.y = centerY;
      if (this.nextDirection.dy !== 0) this.x = centerX;

      this.direction = this.nextDirection;
      this.nextDirection = null;
    }
  }

  private smoothAlignToAxis(): void {
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);
    const pullSpeed = 0.3; // How aggressively to pull toward center (0.1 to 0.5)

    if (this.direction.dx !== 0) {
      // Moving horizontally, smoothly pull Y toward the center line
      this.y += (centerY - this.y) * pullSpeed;
    }
    if (this.direction.dy !== 0) {
      // Moving vertically, smoothly pull X toward the center line
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

    // We look slightly ahead based on Pac-Man's radius and speed
    const lookAheadDistance = this.speed + this.r;
    const boundX = this.x + dir.dx * lookAheadDistance;
    const boundY = this.y + dir.dy * lookAheadDistance;

    const { tileX, tileY } = this.collision.getTile(boundX, boundY);

    return this.collision.isWall(tileX, tileY);
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

      // 🌟 THE FIX: Fired off to event bus instead of direct GameState calls
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

      // Broadcast to the whole game that a power pill was eaten!
      // (This is the event GameState listens to in order to fire back "POWER_PILL_EATEN")
      eventBus.emit("POWER_PILL_EATEN");

      // Keep this if the AudioController still relies on it for the gulp sound!
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
