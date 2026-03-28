import { CANVAS_CONFIG } from "../config/canvas.js";
import { Collision } from "../game/collision.js";
import { eventBus } from "../game/eventBus.js";
import { GameState } from "../game/state.js";
import { Entity } from "./entity.js";

class Ghost extends Entity {
  // -------------------------
  // 1. Properties
  // -------------------------
  private gameState: GameState;
  private collision: Collision;

  private state: "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN" = "CHASE";
  private direction: { dx: number; dy: number };
  public name: string;
  public defaultColor: string;
  public color: string;
  public x: number;
  public y: number;
  public r: number;
  private defaultSpeed: number;
  private speed: number;
  private isFlashing: boolean;

  // -------------------------
  // 2. Constructor
  // -------------------------
  constructor(name: string, color: string) {
    super(CANVAS_CONFIG.canvasIds.ghosts, true);

    this.gameState = GameState.getInstance();
    this.collision = Collision.getInstance();
    this.name = name;
    this.defaultColor = color;
    this.color = color;
    this.direction = { dx: 0, dy: 0 };
    this.x = 0;
    this.y = 0;
    this.r = this.tileSize / 2;
    this.defaultSpeed = this.tileSize / 16;
    this.speed = this.defaultSpeed;
    this.isFlashing = false;
  }

  // -------------------------
  // 3. Lifecycle
  // -------------------------
  public override init() {
    this.getRandomDirection();
    this.initEventListeners();
  }

  private initEventListeners() {
    eventBus.on("POWER_PILL_EATEN", () => {
      if (this.state !== "EATEN") {
        this.state = "FRIGHTENED";
        // this.reverseDirection(); // Classic Pacman mechanic
      }
    });

    eventBus.on("POWER_PILL_WARNING", () => {
      if (this.state === "FRIGHTENED") {
        // Trigger white/blue flashing animation in your Render logic
        this.isFlashing = true;
      }
    });

    eventBus.on("POWER_PILL_EXPIRED", () => {
      this.isFlashing = false;
      if (this.state === "FRIGHTENED") {
        this.state = "CHASE";
      }
    });
  }

  public override reset() {
    this.direction = { dx: 0, dy: 0 };
    this.speed = this.defaultSpeed;
    this.color = this.defaultColor;
  }

  public override resetForLevel() {
    this.reset();
    this.getRandomDirection();
  }

  // -------------------------
  // 4. Update loop
  // -------------------------
  public update() {
    if (this.isAtTileCenter() && this.willHitWall()) {
      this.snapToCenter();
      this.getRandomDirection();
    }

    this.checkAndTeleport();

    if (
      (this.direction.dx !== 0 || this.direction.dy !== 0) &&
      !this.willHitWall()
    ) {
      const { newX, newY } = this.getNextPosition();
      this.x = newX;
      this.y = newY;
    }
  }

  private isAtTileCenter(): boolean {
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);
    const tolerance = this.speed * 2;
    return (
      Math.abs(this.x - centerX) <= tolerance &&
      Math.abs(this.y - centerY) <= tolerance
    );
  }

  private getNextPosition() {
    return {
      newX: this.x + this.direction.dx * this.speed,
      newY: this.y + this.direction.dy * this.speed,
    };
  }

  private snapToCenter() {
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);

    if (this.direction.dx != 0) this.x = centerX;
    if (this.direction.dy != 0) this.y = centerY;
  }

  private willHitWall(): boolean {
    const boundX =
      this.x + this.direction.dx * (this.speed + this.tileSize / 2);
    const boundY =
      this.y + this.direction.dy * (this.speed + this.tileSize / 2);

    const { tileX, tileY } = this.collision.getTile(boundX, boundY);

    return this.collision.isWall(tileX, tileY);
  }

  public getRandomDirection() {
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    const horizontalDirs = directions.filter((dir) => dir.dy === 0);
    const verticalDirs = directions.filter((dir) => dir.dx === 0);

    const isCurrentlyHorizontal = this.direction.dy === 0;
    const isCurrentlyVertical = this.direction.dx === 0;

    let preferredDirs;
    if (Math.random() < 0.7) {
      preferredDirs = isCurrentlyHorizontal ? verticalDirs : horizontalDirs;
    } else {
      preferredDirs = isCurrentlyHorizontal ? horizontalDirs : verticalDirs;
    }

    for (let i = preferredDirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [preferredDirs[i], preferredDirs[j]] = [
        preferredDirs[j],
        preferredDirs[i],
      ];
    }

    for (const dir of preferredDirs) {
      const tileX = Math.floor(
        (this.x + dir.dx * (this.tileSize / 2 + this.speed)) / this.tileSize,
      );
      const tileY = Math.floor(
        (this.y + dir.dy * (this.tileSize / 2 + this.speed)) / this.tileSize,
      );
      if (!this.collision.isWall(tileX, tileY)) {
        this.direction = dir;
        return;
      }
    }

    for (const dir of directions) {
      const tileX = Math.floor(
        (this.x + dir.dx * (this.tileSize / 2 + this.speed)) / this.tileSize,
      );
      const tileY = Math.floor(
        (this.y + dir.dy * (this.tileSize / 2 + this.speed)) / this.tileSize,
      );
      if (!this.collision.isWall(tileX, tileY)) {
        this.direction = dir;
        return;
      }
    }

    this.direction = { dx: 0, dy: 0 };
  }

  private checkAndTeleport() {
    const { tileX, tileY } = this.collision.getTile(this.x, this.y);

    if (this.collision.isTeleport(tileX, tileY)) {
      const exit = this.collision.getTeleportExit(tileX, tileY);
      if (exit) {
        this.x = exit.x * this.tileSize + this.tileSize / 2;
        this.y = exit.y * this.tileSize + this.tileSize / 2;
      }
    }
  }

  // -------------------------
  // 5. Spawning
  // -------------------------
  public spawn() {
    const map = this.gameState.levelData.map;
    for (let y = 0; y < map.length; y++) {
      let x = map[y].findIndex((tile) => tile === this.name);
      if (x !== -1) {
        this.x = x * this.tileSize + this.tileSize / 2;
        this.y = y * this.tileSize + this.tileSize / 2;
        return;
      }
    }
  }

  // -------------------------
  // 6. Rendering
  // -------------------------
  private getDirectionLabel(): "LEFT" | "RIGHT" | "UP" | "DOWN" {
    const { dx, dy } = this.direction;
    if (dx === 1) return "RIGHT";
    if (dx === -1) return "LEFT";
    if (dy === -1) return "UP";
    if (dy === 1) return "DOWN";
    return "RIGHT";
  }

  public draw(animate: boolean): void {
    const ctx = this.ctx;
    const s = this.tileSize;
    const left = this.x - s / 2;
    const top = this.y - s / 2;

    const dir = this.getDirectionLabel();

    ctx.fillStyle = this.color;
    ctx.beginPath();

    // Draw base ghost shape
    this.drawBaseShape(left, top, s);

    // Draw wavy bottom - animated or static
    if (animate) {
      this.animateWavyBottom(left, top, s);
    } else {
      this.drawStaticBottom(left, top, s);
    }

    ctx.closePath();
    ctx.fill();

    // Draw eyes and pupils
    this.drawEyes(left, top, s, dir);
  }

  private drawBaseShape(left: number, top: number, s: number): void {
    const centerX = left + s / 2;
    const centerY = top + s / 2;

    // Main ghost body - rounded top (semi-circle)
    this.ctx.arc(centerX, centerY, s / 2, Math.PI, 0, false);
  }

  private drawStaticBottom(left: number, top: number, s: number): void {
    const bottomBaseY = top + s;

    // Simple straight bottom for static version
    this.ctx.lineTo(left + s, bottomBaseY);
    this.ctx.lineTo(left, bottomBaseY);
  }

  private animateWavyBottom(left: number, top: number, s: number): void {
    const ctx = this.ctx;
    const bottomBaseY = top + s;
    const waveCount = 6;
    const segmentWidth = s / waveCount;
    const waveAmplitude = 2.5;

    // Self-contained animation timing
    const now = Date.now();
    const animationPhase = ((now % 1000) / 1000) * Math.PI * 2;

    // Start from right side
    let currentX = left + s;
    let currentY = bottomBaseY + Math.sin(animationPhase * 4) * waveAmplitude;

    ctx.lineTo(currentX, currentY);

    // Create ultra-smooth waves using cubic bezier curves
    for (let i = waveCount - 1; i >= 0; i--) {
      const segmentStartX = left + (i + 1) * segmentWidth;
      const segmentEndX = left + i * segmentWidth;
      const segmentThirdX = segmentStartX - segmentWidth / 3;
      const segmentTwoThirdsX = segmentStartX - (2 * segmentWidth) / 3;

      // Calculate wave heights
      const startPhase =
        ((i + 1) / waveCount) * Math.PI * 4 + animationPhase * 4;
      const thirdPhase =
        ((i + 2 / 3) / waveCount) * Math.PI * 4 + animationPhase * 4;
      const twoThirdsPhase =
        ((i + 1 / 3) / waveCount) * Math.PI * 4 + animationPhase * 4;
      const endPhase = (i / waveCount) * Math.PI * 4 + animationPhase * 4;

      const startY = bottomBaseY + Math.sin(startPhase) * waveAmplitude;
      const thirdY = bottomBaseY + Math.sin(thirdPhase) * waveAmplitude;
      const twoThirdsY = bottomBaseY + Math.sin(twoThirdsPhase) * waveAmplitude;
      const endY = bottomBaseY + Math.sin(endPhase) * waveAmplitude;

      // Cubic bezier for ultra-smooth curves
      ctx.bezierCurveTo(
        segmentThirdX,
        thirdY, // First control point
        segmentTwoThirdsX,
        twoThirdsY, // Second control point
        segmentEndX,
        endY, // End point
      );
    }
  }

  private drawEyes(left: number, top: number, s: number, dir: string): void {
    const ctx = this.ctx;

    // Eyes with good spacing (20% from edges, 20% gap in middle)
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();

    // Left eye at 30% from left edge
    ctx.arc(left + s * 0.3, top + s / 2, s / 6, 0, Math.PI * 2);
    // Right eye at 70% from left edge (40% gap between eyes)
    ctx.arc(left + s * 0.7, top + s / 2, s / 6, 0, Math.PI * 2);

    ctx.fill();

    // Pupils - directional
    ctx.fillStyle = "#0000AA";
    ctx.beginPath();

    const pupilOffset = s / 10;
    let leftPupilX = left + s * 0.3;
    let leftPupilY = top + s / 2;
    let rightPupilX = left + s * 0.7;
    let rightPupilY = top + s / 2;

    switch (dir) {
      case "LEFT":
        leftPupilX -= pupilOffset;
        rightPupilX -= pupilOffset;
        break;
      case "RIGHT":
        leftPupilX += pupilOffset;
        rightPupilX += pupilOffset;
        break;
      case "UP":
        leftPupilY -= pupilOffset;
        rightPupilY -= pupilOffset;
        break;
      case "DOWN":
        leftPupilY += pupilOffset;
        rightPupilY += pupilOffset;
        break;
    }

    ctx.arc(leftPupilX, leftPupilY, s / 12, 0, Math.PI * 2);
    ctx.arc(rightPupilX, rightPupilY, s / 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

export { Ghost };
