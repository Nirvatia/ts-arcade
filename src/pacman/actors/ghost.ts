import { CFG_CANVAS } from "../config/canvas.js";
import type { GhostConfig } from "../config/ghosts.js";
import { Collision } from "../core/collision.js";
import { eventBus } from "../core/eventBus.js";
import { findLairExit, findShortestPath } from "../utils.js";
import { Actor } from "./actor.js";

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
  private frightenedSpeed: number;
  private eatenSpeed: number;
  public personality: "shadow" | "ambush" | "wild" | "shy";
  private isReturningHome: boolean = false;
  private isFlashing: boolean = false;
  private flashSpeed: number = 200;

  // Scythe.sys Predatory Glitch Particle Trail
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
    this.getRandomDirection();
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
    this.trailParticles = [];
  }

  private initEventListeners(): void {
    eventBus.on("power_pill:activated", () => {
      if (this.state !== "EATEN") {
        this.state = "FRIGHTENED";
        this.isFlashing = false;
        this.speed = this.frightenedSpeed;
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
        this.speed = this.defaultSpeed;
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
        eventBus.emit("ghost:eaten", {
          ghostName: this.name,
          points: 0,
          ghostIndex: 0,
        });
      }
    });
  }

  // --- Update ---

  update(dt: number): void {
    if (this.gameState.mode !== "PLAYING") return;

    if (this.path.length > 0 || this.currentPathTarget !== null) {
      this.moveAlongPath(dt);
      this.needsRedraw = true;
      return;
    }

    if (this.isAtTileCenter(dt)) {
      if (this.willHitWall(dt)) {
        this.snapToCenter();
        this.getRandomDirection();
      }
    }

    this.teleport();

    if (
      (this.direction.dx !== 0 || this.direction.dy !== 0) &&
      !this.willHitWall(dt)
    ) {
      const { newX, newY } = this.getNextPosition(dt);
      this.x = newX;
      this.y = newY;
    }

    this.needsRedraw = true;
  }

  private getNextPosition(dt: number): { newX: number; newY: number } {
    return {
      newX: this.x + this.direction.dx * this.speed * dt,
      newY: this.y + this.direction.dy * this.speed * dt,
    };
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

            if (
              budgetDistance > 0 &&
              (this.direction.dx !== 0 || this.direction.dy !== 0) &&
              !this.willHitWallDirect(budgetDistance)
            ) {
              this.x += this.direction.dx * budgetDistance;
              this.y += this.direction.dy * budgetDistance;
            }
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

  private snapToCenter(): void {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    if (this.direction.dx !== 0) this.x = centerX;
    if (this.direction.dy !== 0) this.y = centerY;
  }

  private willHitWall(dt: number): boolean {
    if (this.direction.dx === 0 && this.direction.dy === 0) return false;
    const moveDistance = this.speed * dt;
    return this.willHitWallDirect(moveDistance);
  }

  private willHitWallDirect(distance: number): boolean {
    const lookAheadDistance = distance + this.r;

    const boundX = this.x + this.direction.dx * lookAheadDistance;
    const boundY = this.y + this.direction.dy * lookAheadDistance;

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

    const currentTile = Collision.getTile(this.x, this.y);

    for (const dir of preferredDirs) {
      const targetTileX = currentTile.tileX + dir.dx;
      const targetTileY = currentTile.tileY + dir.dy;

      if (!Collision.isWall(targetTileX, targetTileY)) {
        this.direction = dir;
        return;
      }
    }

    for (const dir of directions) {
      const targetTileX = currentTile.tileX + dir.dx;
      const targetTileY = currentTile.tileY + dir.dy;

      if (!Collision.isWall(targetTileX, targetTileY)) {
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

  private getOrientationAngle(): number {
    const { dx, dy } = this.direction;
    if (dx === 1) return Math.PI / 2; // Right
    if (dx === -1) return -Math.PI / 2; // Left
    if (dy === -1) return 0; // Up
    if (dy === 1) return Math.PI; // Down
    return 0;
  }

  // --- Draw (Scythe.sys Predator Protocol - Sleek Narrow Variant) ---

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

    // --- SLEEK SCANLINE DRIFT GLITCH TRAIL ---
    if (isGamePlaying && (this.direction.dx !== 0 || this.direction.dy !== 0)) {
      this.particleTimer++;
      if (this.particleTimer >= 3) {
        this.trailParticles.push({
          x: this.x + (Math.random() - 0.5) * (r * 0.7), // Concentrated layout width
          y: this.y + (Math.random() - 0.5) * r,
          alpha: 0.85,
          width: Math.random() > 0.5 ? r * 0.8 : r * 0.4, // Streamlined slice cuts
          height: 1.5,
          drift: (Math.random() - 0.5) * 3,
        });
        this.particleTimer = 0;
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    // --- RENDER TRAIL SLICES ---
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

        p.alpha -= 0.14; // Volatile rapid frame decay
        if (p.alpha <= 0) {
          this.trailParticles.splice(i, 1);
        }
      }
      ctx.restore();
    }

    // --- COORDINATE MATRIX TRANSFORM ---
    ctx.save();
    ctx.translate(this.x, this.y);

    const rotationAngle = this.getOrientationAngle();
    ctx.rotate(rotationAngle);

    // --- DESPATCH RENDER ENGINE CORES ---
    if (!isEaten) {
      this.drawVectorCore(ctx, r, vectorColor, isFrightened);
    } else {
      this.drawFleeingCore(ctx, r, vectorColor);
    }

    ctx.restore();
    ctx.restore();
  }

  /**
   * Balanced standard scale (r * 2.2).
   * Aggressively narrow coordinate geometry footprint (width pinched on X axis).
   */
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

    // 1. Solid High-Contrast Opaque Backdrop Fill (Pinched X positions: 88->72, 12->28)
    ctx.beginPath();
    ctx.moveTo(50, 8);
    ctx.lineTo(72, 78);
    ctx.lineTo(50, 62);
    ctx.lineTo(28, 78);
    ctx.closePath();
    ctx.fillStyle = "#000000";
    ctx.fill();

    // 2. Overdriven Outer Frame Stroke Line
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 3. Narrow Spiked Stabilizers (Pinched to closely trace the sharper body silhouette)
    ctx.beginPath();
    ctx.lineWidth = 2.0;
    // Left barb spike configuration
    ctx.moveTo(37, 69);
    ctx.lineTo(16, 75);
    ctx.lineTo(31, 62);
    // Right barb spike configuration
    ctx.moveTo(63, 69);
    ctx.lineTo(84, 75);
    ctx.lineTo(69, 62);
    ctx.stroke();

    // 4. Sleek Accent Internal Wire Tracking Shell
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

    // 5. Central Data Split Indicator Wires
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

  /**
   * Compact, narrow hyper-sharp fleeing kinetic splinter core.
   */
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

    // Opaque background layer mask
    ctx.beginPath();
    ctx.moveTo(50, 12);
    ctx.lineTo(68, 75);
    ctx.lineTo(50, 60);
    ctx.lineTo(32, 75);
    ctx.closePath();
    ctx.fillStyle = "#000000";
    ctx.fill();

    // Fluctuating unstable core frame pulse line
    const rapidBlink = Math.floor(Date.now() / 45) % 2 === 0;
    ctx.lineWidth = rapidBlink ? 3.5 : 1.5;
    ctx.stroke();

    ctx.restore();
  }
}
