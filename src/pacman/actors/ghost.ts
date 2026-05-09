// src/entities/Ghost.ts
import { CANVAS_CONFIG } from "../config/canvas.js";
import { Collision } from "../core/collision.js";
import { eventBus } from "../core/eventBus.js";
import { findLairExit, findShortestPath } from "../utils.js";
import { Actor } from "./actor.js";

/**
 * Призрак — враг Пакмана.
 * Имеет 4 состояния: CHASE, SCATTER, FRIGHTENED, EATEN.
 */
export class Ghost extends Actor {
  public name: string;
  public defaultColor: string;
  public color: string;

  public state: "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN" = "CHASE";

  private path: string[] = [];
  private currentPathTarget: { x: number; y: number } | null = null;
  private spawnGridX: number = 0;
  private spawnGridY: number = 0;
  private defaultSpeed: number;
  private isReturningHome: boolean = false;
  private isFlashing: boolean = false;
  private flashSpeed: number = 200;

  constructor(name: string, color: string) {
    super(CANVAS_CONFIG.canvasIds.ghosts);
    this.name = name;
    this.defaultColor = color;
    this.color = color;
    this.defaultSpeed = this.tileSize / 16;
    this.speed = this.defaultSpeed;
    this.direction = { dx: 0, dy: 0 };
  }

  // --- Lifecycle ---

  init(): void {
    this.getRandomDirection();
    this.initEventListeners();
  }

  reset(): void {
    this.lastTeleportExit = null;
    this.direction = { dx: 0, dy: 0 };
    this.speed = this.defaultSpeed;
    this.color = this.defaultColor;
    this.path = [];
    this.currentPathTarget = null;
    this.isReturningHome = false;
    this.isFlashing = false;
    this.state = "CHASE";
  }

  resetForLevel(): void {
    this.reset();
    this.spawn();
    this.getRandomDirection();
  }

  private initEventListeners(): void {
    eventBus.on("power_pill:activated", () => {
      if (this.state !== "EATEN") {
        this.state = "FRIGHTENED";
        this.isFlashing = false;
        this.reverseDirection();
        eventBus.emit("ghost:state_changed", {
          ghostName: this.name,
          from: this.state,
          to: "FRIGHTENED",
        });
      }
    });

    eventBus.on("power_pill:warning", () => {
      if (this.state === "FRIGHTENED") {
        this.isFlashing = true;
      }
    });

    eventBus.on("power_pill:expired", () => {
      this.isFlashing = false;
      if (this.state === "FRIGHTENED") {
        const previousState = this.state;
        this.state = "CHASE";
        eventBus.emit("ghost:state_changed", {
          ghostName: this.name,
          from: previousState,
          to: "CHASE",
        });
      }
    });

    eventBus.on("command:ghost_eaten", (data: { ghostName: string }) => {
      if (data && this.name === data.ghostName && this.state === "FRIGHTENED") {
        this.beEaten();
        // Let the Director/Tally handle the scoring and freeze frame
        // The ghost:eaten event is now emitted by the entity itself
        eventBus.emit("ghost:eaten", {
          ghostName: this.name,
          points: 0, // Points will be calculated by Tally
          ghostIndex: 0, // Set by Ghost config
        });
      }
    });
  }

  // --- Update ---

  update(dt: number): void {
    if (this.path.length > 0) {
      this.moveAlongPath();
      return;
    }

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

  private getNextPosition(): { newX: number; newY: number } {
    return {
      newX: this.x + this.direction.dx * this.speed,
      newY: this.y + this.direction.dy * this.speed,
    };
  }

  private moveAlongPath(): void {
    if (!this.currentPathTarget && this.path.length > 0) {
      const nextTileStr = this.path[0];
      const [ty, tx] = nextTileStr.split(",").map(Number);
      this.currentPathTarget = {
        x: tx * this.tileSize + this.tileSize / 2,
        y: ty * this.tileSize + this.tileSize / 2,
      };
    }

    if (this.currentPathTarget) {
      const dx = this.currentPathTarget.x - this.x;
      const dy = this.currentPathTarget.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = { dx: Math.sign(dx), dy: 0 };
      } else {
        this.direction = { dx: 0, dy: Math.sign(dy) };
      }

      if (distance < this.speed) {
        this.x = this.currentPathTarget.x;
        this.y = this.currentPathTarget.y;
        this.currentPathTarget = null;
        this.path.shift();

        if (this.path.length === 0) {
          if (this.isReturningHome) {
            const previousState = this.state;
            this.state = "CHASE";
            this.speed = this.defaultSpeed;
            this.color = this.defaultColor;
            this.isReturningHome = false;

            eventBus.emit("ghost:state_changed", {
              ghostName: this.name,
              from: previousState,
              to: "CHASE",
            });

            eventBus.emit("ghost:returned_home", { ghostName: this.name });
            this.calculateExitPath();
          } else {
            this.getRandomDirection();
          }
        }
      } else {
        this.x += (dx / distance) * this.speed;
        this.y += (dy / distance) * this.speed;
      }
    }
  }

  private isAtTileCenter(): boolean {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    const tolerance = this.speed * 2;
    return (
      Math.abs(this.x - centerX) <= tolerance &&
      Math.abs(this.y - centerY) <= tolerance
    );
  }

  private snapToCenter(): void {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    if (this.direction.dx !== 0) this.x = centerX;
    if (this.direction.dy !== 0) this.y = centerY;
  }

  private willHitWall(): boolean {
    const boundX =
      this.x + this.direction.dx * (this.speed + this.tileSize / 2);
    const boundY =
      this.y + this.direction.dy * (this.speed + this.tileSize / 2);

    const { tileX, tileY } = Collision.getTile(boundX, boundY);
    const isExiting = this.path.length > 0;
    return Collision.isWall(tileX, tileY, isExiting);
  }

  getRandomDirection(): void {
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
      if (!Collision.isWall(tileX, tileY)) {
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
      if (!Collision.isWall(tileX, tileY)) {
        this.direction = dir;
        return;
      }
    }

    this.direction = { dx: 0, dy: 0 };
  }

  reverseDirection(): void {
    this.direction = {
      dx: -this.direction.dx,
      dy: -this.direction.dy,
    };
  }

  beEaten(): void {
    const previousState = this.state;
    this.state = "EATEN";
    this.speed = this.defaultSpeed * 2;
    this.isReturningHome = true;

    eventBus.emit("ghost:state_changed", {
      ghostName: this.name,
      from: previousState,
      to: "EATEN",
    });

    const { tileX, tileY } = Collision.getTile(this.x, this.y);
    const startNode = `${tileY},${tileX}`;
    const targetNode = `${this.spawnGridY},${this.spawnGridX}`;
    const graph = this.gameState.pathGraph;

    if (graph) {
      const foundPath = findShortestPath(graph, startNode, targetNode);
      if (foundPath) {
        this.path = foundPath;
      }
    }
  }

  // --- Spawn ---

  spawn(): void {
    const map = this.gameState.levelData.map;
    for (let y = 0; y < map.length; y++) {
      const x = map[y].findIndex((tile) => tile === this.name);
      if (x !== -1) {
        this.spawnGridX = x;
        this.spawnGridY = y;
        this.x = x * this.tileSize + this.tileSize / 2;
        this.y = y * this.tileSize + this.tileSize / 2;
        break;
      }
    }
  }

  calculateExitPath(): void {
    const map = this.gameState.levelData.map;
    const startNode = `${this.spawnGridY},${this.spawnGridX}`;
    const targetNode = findLairExit(map);
    const graph = this.gameState.pathGraph;

    if (graph) {
      const foundPath = findShortestPath(graph, startNode, targetNode);
      if (foundPath) {
        this.path = foundPath;
      }
    }
  }

  // --- Draw ---

  private getDirectionLabel(): "LEFT" | "RIGHT" | "UP" | "DOWN" {
    const { dx, dy } = this.direction;
    if (dx === 1) return "RIGHT";
    if (dx === -1) return "LEFT";
    if (dy === -1) return "UP";
    if (dy === 1) return "DOWN";
    return "RIGHT";
  }

  draw(animate: boolean, _dt?: number): void {
    const ctx = this.ctx;
    const s = this.tileSize;
    const left = this.x - s / 2;
    const top = this.y - s / 2;

    let bodyColor = this.defaultColor;
    let shouldDrawBody = true;

    if (this.state === "FRIGHTENED") {
      if (this.isFlashing) {
        const isWhite = Math.floor(Date.now() / this.flashSpeed) % 2 === 0;
        bodyColor = isWhite ? "#FFFFFF" : "#0000FF";
      } else {
        bodyColor = "#0000FF";
      }
    } else if (this.state === "EATEN") {
      shouldDrawBody = false;
    }

    if (shouldDrawBody) {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      this.drawBaseShape(left, top, s);

      if (animate) {
        this.animateWavyBottom(left, top, s);
      } else {
        this.drawStaticBottom(left, top, s);
      }

      ctx.closePath();
      ctx.fill();
    }

    const dir = this.getDirectionLabel();
    this.drawEyes(left, top, s, dir);
  }

  private drawBaseShape(left: number, top: number, s: number): void {
    const centerX = left + s / 2;
    const centerY = top + s / 2;
    this.ctx.arc(centerX, centerY, s / 2, Math.PI, 0, false);
  }

  private drawStaticBottom(left: number, top: number, s: number): void {
    const ctx = this.ctx;
    const bottomBaseY = top + s;
    const waveCount = 6;
    const segmentWidth = s / waveCount;
    const waveAmplitude = 2.5;

    let currentX = left + s;
    // Start at right edge with a slight wave offset
    let currentY = bottomBaseY + Math.sin(0) * waveAmplitude;
    ctx.lineTo(currentX, currentY);

    for (let i = waveCount - 1; i >= 0; i--) {
      const segmentStartX = left + (i + 1) * segmentWidth;
      const segmentEndX = left + i * segmentWidth;
      const segmentThirdX = segmentStartX - segmentWidth / 3;
      const segmentTwoThirdsX = segmentStartX - (2 * segmentWidth) / 3;

      // Frozen wave: use static phase offsets to create a permanent wave shape
      const startPhase = ((i + 1) / waveCount) * Math.PI * 4;
      const thirdPhase = ((i + 2 / 3) / waveCount) * Math.PI * 4;
      const twoThirdsPhase = ((i + 1 / 3) / waveCount) * Math.PI * 4;
      const endPhase = (i / waveCount) * Math.PI * 4;

      const startY = bottomBaseY + Math.sin(startPhase) * waveAmplitude;
      const thirdY = bottomBaseY + Math.sin(thirdPhase) * waveAmplitude;
      const twoThirdsY = bottomBaseY + Math.sin(twoThirdsPhase) * waveAmplitude;
      const endY = bottomBaseY + Math.sin(endPhase) * waveAmplitude;

      ctx.bezierCurveTo(
        segmentThirdX,
        thirdY,
        segmentTwoThirdsX,
        twoThirdsY,
        segmentEndX,
        endY,
      );
    }
  }

  private animateWavyBottom(left: number, top: number, s: number): void {
    const ctx = this.ctx;
    const bottomBaseY = top + s;
    const waveCount = 6;
    const segmentWidth = s / waveCount;
    const waveAmplitude = 2.5;

    const now = Date.now();
    const animationPhase = ((now % 1000) / 1000) * Math.PI * 2;

    let currentX = left + s;
    let currentY = bottomBaseY + Math.sin(animationPhase * 4) * waveAmplitude;
    ctx.lineTo(currentX, currentY);

    for (let i = waveCount - 1; i >= 0; i--) {
      const segmentStartX = left + (i + 1) * segmentWidth;
      const segmentEndX = left + i * segmentWidth;
      const segmentThirdX = segmentStartX - segmentWidth / 3;
      const segmentTwoThirdsX = segmentStartX - (2 * segmentWidth) / 3;

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

      ctx.bezierCurveTo(
        segmentThirdX,
        thirdY,
        segmentTwoThirdsX,
        twoThirdsY,
        segmentEndX,
        endY,
      );
    }
  }

  private drawEyes(left: number, top: number, s: number, dir: string): void {
    const ctx = this.ctx;

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(left + s * 0.3, top + s / 2, s / 6, 0, Math.PI * 2);
    ctx.arc(left + s * 0.7, top + s / 2, s / 6, 0, Math.PI * 2);
    ctx.fill();

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
