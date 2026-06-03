import { CFG_CANVAS } from "../config/canvas.js";
import { Collision } from "../core/collision.js";
import { eventBus } from "../core/eventBus.js";
import { Actor } from "./actor.js";
import type { GhostConfig } from "../config/ghosts.js";
import { findShortestPath } from "../pathfinding/search.js";
import { findLairExit } from "../pathfinding/lair.js";
import {
  getScatterTarget,
  getBlinkyTarget,
  getPinkyTarget,
  getInkyTarget,
  getClydeTarget,
  type TargetCoords,
} from "../ai/ghostAI.js";

export class Ghost extends Actor {
  public name: string;
  public codename: string;
  public defaultColor: string;
  public color: string;

  public state: "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN" = "CHASE";
  public personality: "shadow" | "ambush" | "wild" | "shy";

  private path: string[] = [];
  private currentPathTarget: { x: number; y: number } | null = null;
  private lastEvaluatedGrid: { x: number; y: number } = { x: -1, y: -1 };
  private spawnGridX: number = 0;
  private spawnGridY: number = 0;
  private defaultSpeed: number;
  private frightenedSpeed: number;
  private eatenSpeed: number;
  private isReturningHome: boolean = false;
  private isFlashing: boolean = false;
  private flashSpeed: number = 200;

  private lastEvaluatedTile: string = "";

  // --- Wave Timer State Tracker Variables ---
  private waveTimer: number = 0;
  private waveIndex: number = 0;
  private waveDurations: number[] = [
    7000, 20000, 7000, 20000, 5000, 20000, 5000, -1,
  ];

  private particleTimer: number = 0;
  private trailParticles: Array<{
    x: number;
    y: number;
    alpha: number;
    width: number;
    height: number;
    drift: number;
  }> = [];

  constructor(config: GhostConfig, sharedCtx?: CanvasRenderingContext2D) {
    super(CFG_CANVAS.canvasIds.ghosts, sharedCtx);
    this.name = config.name;
    this.codename = config.codename;
    this.defaultColor = config.defaultColor;
    this.color = config.color;
    this.personality = config.personality;

    const tileSize = CFG_CANVAS.tile.size;
    this.defaultSpeed = tileSize * config.speedMultiplier;
    this.speed = this.defaultSpeed;
    this.frightenedSpeed = tileSize * config.frightenedSpeedMultiplier;
    this.eatenSpeed = tileSize * config.eatenSpeedMultiplier;

    this.direction = { dx: 0, dy: 0 };
    this.initEventListeners();
  }

  // --- Lifecycle ---

  init(): void {
    this.lastEvaluatedGrid = { x: -1, y: -1 };
    this.waveTimer = 0;
    this.waveIndex = 0;
    this.state = "SCATTER";
    this.updateTargetNavigation();
  }

  reset(): void {
    this.lastEvaluatedGrid = { x: -1, y: -1 };
    this.lastTeleportExit = null;
    this.direction = { dx: 0, dy: 0 };
    this.speed = this.defaultSpeed;
    this.color = this.defaultColor;
    this.path = [];
    this.currentPathTarget = null;
    this.isReturningHome = false;
    this.isFlashing = false;
    this.state = "SCATTER";
    this.waveTimer = 0;
    this.waveIndex = 0;
    this.trailParticles = [];
    this.lastEvaluatedTile = "";
    this.needsRedraw = true;
  }

  private initEventListeners(): void {
    eventBus.on("power_pill:activated", () => {
      if (this.state !== "EATEN") {
        const previousState = this.state;
        this.state = "FRIGHTENED";
        this.isFlashing = false;
        this.speed = this.frightenedSpeed;
        this.reverseDirection();
        eventBus.emit("ghost:state_changed", {
          ghostName: this.name,
          from: previousState,
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
        this.speed = this.defaultSpeed;

        const activeWaveType = this.getActiveWaveType();
        this.state = activeWaveType;

        eventBus.emit("ghost:state_changed", {
          ghostName: this.name,
          from: previousState,
          to: activeWaveType,
        });
      }
    });

    eventBus.on("command:ghost_eaten", (data: { ghostName: string }) => {
      if (data && this.name === data.ghostName && this.state === "FRIGHTENED") {
        this.beEaten();
        eventBus.emit("ghost:eaten", {
          ghostName: this.name,
          points: 0,
          ghostIndex: 0,
        });
      }
    });
  }

  // --- Update Loop Engine ---

  update(dt: number): void {
    if (this.gameState.mode !== "PLAYING") return;

    const dtMs = dt * 1000;
    this.updateStateTimer(dtMs);

    // 1. Scripted Path Control (Inside Lair / Eyeballs traveling home)
    if (this.path.length > 0 || this.currentPathTarget !== null) {
      this.moveAlongPath(dt);
      this.needsRedraw = true;
      return;
    }

    // 2. Tile Center Intersection Navigation Check
    const currentTile = Collision.getTile(this.x, this.y);

    if (this.isAtTileCenter(dt)) {
      if (
        this.lastEvaluatedGrid.x !== currentTile.tileX ||
        this.lastEvaluatedGrid.y !== currentTile.tileY
      ) {
        this.snapToMovementAxis();
        this.updateTargetNavigation();
        this.lastEvaluatedGrid = { x: currentTile.tileX, y: currentTile.tileY };
      }
    }

    this.teleport();

    // 3. Single-Pass Movement execution
    if (!this.willHitWall(dt)) {
      const { newX, newY } = this.getNextPosition(dt);
      this.x = newX;
      this.y = newY;
    } else {
      // Corner-case emergency routing check (Handles dead ends without double-moving coordinates)
      this.snapToMovementAxis();
      this.updateTargetNavigation();
    }

    this.needsRedraw = true;
  }

  /**
   * Evaluates background wave configuration states independently of underlying active behaviors
   */
  private updateStateTimer(dtMs: number): void {
    const currentLimit = this.waveDurations[this.waveIndex];
    if (currentLimit === -1) return;

    this.waveTimer += dtMs;

    if (this.waveTimer >= currentLimit) {
      this.waveTimer -= currentLimit;
      this.waveIndex++;

      const nextState = this.getActiveWaveType();

      if (this.state === "CHASE" || this.state === "SCATTER") {
        const previousState = this.state;
        this.state = nextState;
        this.reverseDirection();

        eventBus.emit("ghost:state_changed", {
          ghostName: this.name,
          from: previousState,
          to: nextState,
        });
      }
    }
  }

  /**
   * Helper utility to determine what structural mode the global pattern clock expects
   */
  private getActiveWaveType(): "CHASE" | "SCATTER" {
    return this.waveIndex % 2 === 0 ? "SCATTER" : "CHASE";
  }

  /**
   * Evaluates valid tiles and processes targeting routing logic by ghost name.
   */
  private updateTargetNavigation(): void {
    const map = this.gameState.levelData.map;
    const currentTile = Collision.getTile(this.x, this.y);

    if (this.state === "FRIGHTENED") {
      this.getRandomDirection();
      return;
    }

    let target: TargetCoords = { tileX: 0, tileY: 0 };

    if (this.state === "SCATTER") {
      target = getScatterTarget(this.name, map);
    } else if (this.state === "CHASE") {
      switch (this.name) {
        case "blinky":
          target = getBlinkyTarget();
          break;
        case "pinky":
          target = getPinkyTarget();
          break;
        case "inky":
          target = getInkyTarget();
          break;
        case "clyde":
          target = getClydeTarget(this.x, this.y, map);
          break;
        default:
          target = getScatterTarget(this.name, map);
      }
    }

    const directions = [
      { dx: 0, dy: -1 }, // Up
      { dx: -1, dy: 0 }, // Left
      { dx: 0, dy: 1 }, // Down
      { dx: 1, dy: 0 }, // Right
    ];

    let bestDir = this.direction;
    let minDistance = Infinity;
    let foundValidMove = false;

    for (const dir of directions) {
      // Disallow 180 direct turnaround flips
      if (dir.dx === -this.direction.dx && dir.dy === -this.direction.dy) {
        continue;
      }

      const nextTileX = currentTile.tileX + dir.dx;
      const nextTileY = currentTile.tileY + dir.dy;

      if (!Collision.isWall(nextTileX, nextTileY)) {
        foundValidMove = true;

        const diffX = nextTileX - target.tileX;
        const diffY = nextTileY - target.tileY;
        const dist = diffX * diffX + diffY * diffY;

        if (dist < minDistance) {
          minDistance = dist;
          bestDir = dir;
        }
      }
    }

    if (!foundValidMove) {
      for (const dir of directions) {
        const nextTileX = currentTile.tileX + dir.dx;
        const nextTileY = currentTile.tileY + dir.dy;
        if (!Collision.isWall(nextTileX, nextTileY)) {
          bestDir = dir;
          break;
        }
      }
    }

    this.direction = bestDir;
  }

  private moveAlongPath(dt: number): void {
    let budgetDistance = this.speed * dt;

    while (budgetDistance > 0) {
      if (!this.currentPathTarget) {
        if (this.path.length > 0) {
          const nextTileStr = this.path[0];
          const [ty, tx] = nextTileStr.split(",").map(Number);
          this.currentPathTarget = {
            x: tx * this.tileSize + this.tileSize / 2,
            y: ty * this.tileSize + this.tileSize / 2,
          };
        } else {
          break;
        }
      }

      const dx = this.currentPathTarget.x - this.x;
      const dy = this.currentPathTarget.y - this.y;
      const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

      if (distanceToTarget > 0.001) {
        if (Math.abs(dx) > Math.abs(dy)) {
          this.direction = { dx: Math.sign(dx), dy: 0 };
        } else {
          this.direction = { dx: 0, dy: Math.sign(dy) };
        }
      }

      if (distanceToTarget <= budgetDistance) {
        this.x = this.currentPathTarget.x;
        this.y = this.currentPathTarget.y;
        budgetDistance -= distanceToTarget;

        this.currentPathTarget = null;
        if (this.path.length > 0) {
          this.path.shift();
        }

        if (this.path.length === 0) {
          if (this.isReturningHome) {
            const previousState = this.state;
            const activeWaveType = this.getActiveWaveType();
            this.state = activeWaveType;
            this.speed = this.defaultSpeed;
            this.color = this.defaultColor;
            this.isReturningHome = false;

            eventBus.emit("ghost:state_changed", {
              ghostName: this.name,
              from: previousState,
              to: activeWaveType,
            });

            eventBus.emit("ghost:returned_home", { ghostName: this.name });
            this.calculateExitPath();
          } else {
            this.currentPathTarget = null;
            this.snapToMovementAxis();

            this.direction = { dx: 0, dy: 0 };
            this.lastEvaluatedGrid = { x: -1, y: -1 };

            this.updateTargetNavigation();
            budgetDistance = 0;
          }
        }
      } else {
        this.x += (dx / distanceToTarget) * budgetDistance;
        this.y += (dy / distanceToTarget) * budgetDistance;
        budgetDistance = 0;
      }
    }
  }

  private isAtTileCenter(dt: number): boolean {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    const maxSpeed = Math.max(this.defaultSpeed, this.eatenSpeed, this.speed);
    const tolerance = maxSpeed * dt;
    return (
      Math.abs(this.x - centerX) <= tolerance &&
      Math.abs(this.y - centerY) <= tolerance
    );
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

    let preferredDirs = isCurrentlyHorizontal ? verticalDirs : horizontalDirs;

    for (let i = preferredDirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [preferredDirs[i], preferredDirs[j]] = [
        preferredDirs[j],
        preferredDirs[i],
      ];
    }

    const currentTile = Collision.getTile(this.x, this.y);

    for (const dir of preferredDirs) {
      const targetTileX = currentTile.tileX + dir.dx;
      const targetTileY = currentTile.tileY + dir.dy;

      if (!Collision.isWall(targetTileX, targetTileY)) {
        this.direction = dir;
        return;
      }
    }

    const straightDir = this.direction;
    if (
      !Collision.isWall(
        currentTile.tileX + straightDir.dx,
        currentTile.tileY + straightDir.dy,
      )
    ) {
      return;
    }

    const reverseDir = { dx: -this.direction.dx, dy: -this.direction.dy };
    if (
      !Collision.isWall(
        currentTile.tileX + reverseDir.dx,
        currentTile.tileY + reverseDir.dy,
      )
    ) {
      this.direction = reverseDir;
      return;
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
    this.speed = this.eatenSpeed;
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

  spawn(): void {
    const map = this.gameState.levelData.map;
    for (let y = 0; y < map.length; y++) {
      const x = map[y].findIndex((tile) => tile === this.codename);
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

  private getOrientationAngle(): number {
    const { dx, dy } = this.direction;
    if (dx === 1) return Math.PI / 2;
    if (dx === -1) return -Math.PI / 2;
    if (dy === -1) return 0;
    if (dy === 1) return Math.PI;
    return 0;
  }

  draw(): void {
    const ctx = this.ctx;
    const r = this.tileSize / 2;

    let vectorColor = this.color || this.defaultColor;
    let isFrightened = false;
    let isEaten = false;

    if (this.state === "FRIGHTENED") {
      isFrightened = true;
      if (this.isFlashing) {
        const isWhite = Math.floor(Date.now() / this.flashSpeed) % 2 === 0;
        vectorColor = isWhite ? "#ffffff" : "#1144bb";
      } else {
        vectorColor = "#1144bb";
      }
    } else if (this.state === "EATEN") {
      isEaten = true;
      vectorColor = "rgba(0, 240, 255, 0.9)";
    }

    const isGamePlaying = this.gameState && this.gameState.mode === "PLAYING";

    if (isGamePlaying && (this.direction.dx !== 0 || this.direction.dy !== 0)) {
      this.particleTimer++;
      if (this.particleTimer >= 3) {
        const baseRoundedX = Math.round(this.x);
        const baseRoundedY = Math.round(this.y);

        this.trailParticles.push({
          x: baseRoundedX + (Math.random() - 0.5) * (r * 0.7),
          y: baseRoundedY + (Math.random() - 0.5) * r,
          alpha: 0.85,
          width: Math.random() > 0.5 ? r * 0.8 : r * 0.4,
          height: 1.5,
          drift: (Math.random() - 0.5) * 3,
        });
        this.particleTimer = 0;
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    if (this.trailParticles.length > 0) {
      ctx.save();
      for (let i = this.trailParticles.length - 1; i >= 0; i--) {
        const p = this.trailParticles[i];
        ctx.fillStyle = vectorColor;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(
          p.x - p.width / 2 + p.drift,
          p.y - p.height / 2,
          p.width,
          p.height,
        );

        p.alpha -= 0.14;
        if (p.alpha <= 0) {
          this.trailParticles.splice(i, 1);
        }
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));

    const rotationAngle = this.getOrientationAngle();
    ctx.rotate(rotationAngle);

    if (!isEaten) {
      this.drawVectorCore(ctx, r, vectorColor, isFrightened);
    } else {
      this.drawFleeingCore(ctx, r, vectorColor);
    }

    ctx.restore();
    ctx.restore();
  }

  private drawVectorCore(
    ctx: CanvasRenderingContext2D,
    r: number,
    themeColor: string,
    isFrightened: boolean,
  ): void {
    ctx.save();
    const scaleFactor = (r * 2.2) / 100;
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-50, -50);

    ctx.shadowBlur = isFrightened ? 6 : 15;
    ctx.shadowColor = themeColor;
    ctx.strokeStyle = themeColor;
    ctx.lineJoin = "miter";
    ctx.miterLimit = 4;

    ctx.beginPath();
    ctx.moveTo(50, 8);
    ctx.lineTo(72, 78);
    ctx.lineTo(50, 62);
    ctx.lineTo(28, 78);
    ctx.closePath();
    ctx.fillStyle = "#000000";
    ctx.fill();

    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 2.0;
    ctx.moveTo(37, 69);
    ctx.lineTo(16, 75);
    ctx.lineTo(31, 62);
    ctx.moveTo(63, 69);
    ctx.lineTo(84, 75);
    ctx.lineTo(69, 62);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = 0.55;
    ctx.moveTo(50, 24);
    ctx.lineTo(66, 67);
    ctx.lineTo(50, 56);
    ctx.lineTo(34, 67);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.moveTo(50, 8);
    ctx.lineTo(50, 56);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private drawFleeingCore(
    ctx: CanvasRenderingContext2D,
    r: number,
    themeColor: string,
  ): void {
    ctx.save();
    const scaleFactor = (r * 1.8) / 100;
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-50, -50);

    ctx.shadowBlur = 12;
    ctx.shadowColor = themeColor;
    ctx.strokeStyle = themeColor;
    ctx.lineJoin = "miter";

    ctx.beginPath();
    ctx.moveTo(50, 12);
    ctx.lineTo(68, 75);
    ctx.lineTo(50, 60);
    ctx.lineTo(32, 75);
    ctx.closePath();
    ctx.fillStyle = "#000000";
    ctx.fill();

    const rapidBlink = Math.floor(Date.now() / 45) % 2 === 0;
    ctx.lineWidth = rapidBlink ? 3.5 : 1.5;
    ctx.stroke();

    ctx.restore();
  }
}
