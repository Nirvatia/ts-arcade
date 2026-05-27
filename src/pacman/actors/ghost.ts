// src/entities/Ghost.ts
import { CFG_CANVAS } from "../config/canvas.js";
import type { GhostConfig } from "../config/ghosts.js";
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
  private frightenedSpeed: number;
  private eatenSpeed: number;
  public personality: "shadow" | "ambush" | "wild" | "shy";
  private isReturningHome: boolean = false;
  private isFlashing: boolean = false;
  private flashSpeed: number = 200;

  // In Ghost.ts constructor
  constructor(config: GhostConfig) {
    super(CFG_CANVAS.canvasIds.ghosts);
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
    if (this.path.length > 0) {
      this.moveAlongPath(dt);
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
  }

  private getNextPosition(dt: number): { newX: number; newY: number } {
    return {
      newX: this.x + this.direction.dx * this.speed * dt,
      newY: this.y + this.direction.dy * this.speed * dt,
    };
  }

  private moveAlongPath(dt: number): void {
    let budgetDistance = this.speed * dt;

    while (
      budgetDistance > 0 &&
      (this.currentPathTarget || this.path.length > 0)
    ) {
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
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

        // Map facing vector to standard look directions
        if (distanceToTarget > 0.001) {
          if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = { dx: Math.sign(dx), dy: 0 };
          } else {
            this.direction = { dx: 0, dy: Math.sign(dy) };
          }
        }

        if (distanceToTarget <= budgetDistance) {
          // Snap directly to this layout crossroads target
          this.x = this.currentPathTarget.x;
          this.y = this.currentPathTarget.y;
          budgetDistance -= distanceToTarget; // Spend distance allocation
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
            break;
          }
        } else {
          // Normal linear frame step translation
          this.x += (dx / distanceToTarget) * budgetDistance;
          this.y += (dy / distanceToTarget) * budgetDistance;
          budgetDistance = 0; // Exhausted frame time budget
        }
      }
    }
  }

  private isAtTileCenter(dt: number): boolean {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    const tolerance = this.speed * dt;
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
    const lookAheadDistance = moveDistance + this.r;

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

  draw(): void {
    const ctx = this.ctx;
    const s = this.tileSize;
    const left = this.x - s / 2;
    const top = this.y - s / 2;

    let primaryColor = this.defaultColor;
    let coreGradientTop = this.defaultColor;
    let coreGradientBottom = "#000000"; // Deep base fade
    let glowColor = this.defaultColor;
    let fillOpacity = 0.45; // Increased from 0.15 for a much more solid body presence
    let shouldDrawBody = true;

    // Determine state color schemes and enhance the blue contrast
    if (this.state === "FRIGHTENED") {
      if (this.isFlashing) {
        const isWhite = Math.floor(Date.now() / this.flashSpeed) % 2 === 0;
        primaryColor = isWhite ? "#FFFFFF" : "#00d9ff"; // Electric high-vis cyan
        glowColor = isWhite ? "#FFFFFF" : "#0055ff";
        coreGradientTop = isWhite ? "#FFFFFF" : "#0077ff";
        coreGradientBottom = isWhite ? "#B0B0B0" : "#001144";
        fillOpacity = isWhite ? 0.7 : 0.55;
      } else {
        // High-contrast neon cyan/blue mix to pop perfectly off dark backgrounds
        primaryColor = "#00f3ff";
        glowColor = "#0055ff";
        coreGradientTop = "#00bdff";
        coreGradientBottom = "#001155";
        fillOpacity = 0.55;
      }
    } else if (this.state === "EATEN") {
      shouldDrawBody = false;
    }

    const isGamePlaying = this.gameState && this.gameState.mode === "PLAYING";
    const timeScale = isGamePlaying ? Date.now() * 0.003 : 0;

    if (shouldDrawBody) {
      // 1. Biological breathing scale translation matrix
      const breath = isGamePlaying ? Math.sin(timeScale * 2.2) * 3.5 : 0;
      const breathPercentY = breath * 0.01;

      ctx.save();
      // Anchor expansion from the absolute center baseline of the tile coordinate
      ctx.translate(this.x, top + s);
      ctx.scale(1 + breathPercentY * 1.2, 1 - breathPercentY);
      ctx.translate(-this.x, -(top + s));

      // 2. Layer A: High-Visibility Solid/Translucent Core Gradient
      ctx.save();
      this.traceMasterGhostShape(left, top, s, timeScale);
      ctx.clip();

      let bodyGrad = ctx.createLinearGradient(left, top, left, top + s);
      bodyGrad.addColorStop(0, coreGradientTop);
      bodyGrad.addColorStop(1, coreGradientBottom);

      ctx.globalAlpha = fillOpacity;
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(left - 2, top - 2, s + 4, s + 4);
      ctx.restore();

      // 3. Layer B: Premium Clean Neon Glow Border
      ctx.save();
      ctx.shadowBlur = s * 0.5; // Slightly larger bloom to emphasize position
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = Math.max(2.0, s * 0.085); // Thickened stroke edge for clarity
      this.traceMasterGhostShape(left, top, s, timeScale);
      ctx.stroke();
      ctx.restore();

      ctx.restore(); // End of breathing translation matrix
    }

    // 4. Layer C: Sentient Ocular Array
    const dir = this.getDirectionLabel();
    this.drawEyes(
      left,
      top,
      s,
      dir,
      isGamePlaying ? Math.sin(timeScale * 2.2) * 3.5 : 0,
    );
  }

  /**
   * Generates a definitive, high-accuracy master vector boundary
   */
  private traceMasterGhostShape(
    left: number,
    top: number,
    s: number,
    timeScale: number,
  ): void {
    const ctx = this.ctx;
    const centerX = left + s / 2;
    const waveHeight = s * 0.06; // Tight, optimized amplitude ceiling for stable reading profiles
    const waveCount = 3;

    ctx.beginPath();
    // Dome top perimeter configuration
    ctx.arc(centerX, top + s / 2, s / 2, Math.PI, 0, false);

    // Smooth master mathematical base wave loop
    ctx.lineTo(left + s, top + s - waveHeight);
    const precisionSteps = 40;
    const waveOffset = timeScale * 1.8;

    for (let i = 0; i <= precisionSteps; i++) {
      const pct = i / precisionSteps;
      const currX = left + s - s * pct;
      const angle = pct * Math.PI * 2 * waveCount + waveOffset;
      const currY = top + s - waveHeight + Math.sin(angle) * waveHeight;
      ctx.lineTo(currX, currY);
    }

    ctx.lineTo(left, top + s - waveHeight);
    ctx.closePath();
  }

  private drawEyes(
    left: number,
    top: number,
    s: number,
    dir: string,
    breath: number,
  ): void {
    const ctx = this.ctx;

    // Compute targeted look angles mapped to actual facing direction labels
    let lookX = 0;
    let lookY = 0;
    const pupilOffset = s * 0.06;

    switch (dir) {
      case "LEFT":
        lookX = -pupilOffset;
        break;
      case "RIGHT":
        lookX = pupilOffset;
        break;
      case "UP":
        lookY = -pupilOffset;
        break;
      case "DOWN":
        lookY = pupilOffset;
        break;
    }

    // Track vertical frame height shift linked directly with the breathing cycle context
    const finalEyeY = top + s * 0.48 + breath * 0.04;
    const eyeX1 = left + s * 0.32;
    const eyeX2 = left + s * 0.68;

    if (this.state !== "FRIGHTENED") {
      // Sclera base lens vector
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(eyeX1, finalEyeY, s * 0.1, 0, Math.PI * 2);
      ctx.arc(eyeX2, finalEyeY, s * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Active targeted iris core tracker
      const irisColor = this.state === "EATEN" ? "#00f3ff" : this.defaultColor;
      ctx.fillStyle = irisColor;
      ctx.beginPath();
      ctx.arc(eyeX1 + lookX, finalEyeY + lookY, s * 0.045, 0, Math.PI * 2);
      ctx.arc(eyeX2 + lookX, finalEyeY + lookY, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Enhanced arcade expressions for the blue vulnerable phase
      ctx.fillStyle = "#ffcc00"; // High visibility retro tracking yellow
      ctx.shadowBlur = s * 0.15;
      ctx.shadowColor = "#ffcc00";

      ctx.beginPath();
      ctx.arc(eyeX1, finalEyeY, s * 0.04, 0, Math.PI * 2);
      ctx.arc(eyeX2, finalEyeY, s * 0.04, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }
  }
}
