// src/entities/Ghost.ts
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
    if (this.gameState.mode !== "PLAYING") return;
    
    if (this.path.length > 0 || this.currentPathTarget !== null) {
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
              !this.willHitWall(budgetDistance / this.speed)
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
    let glowColor = this.defaultColor;
    let fillOpacity = 0.7;
    let shouldDrawBody = true;

    if (this.state === "FRIGHTENED") {
      if (this.isFlashing) {
        const isWhite = Math.floor(Date.now() / this.flashSpeed) % 2 === 0;
        primaryColor = isWhite ? "#ffffff" : "#1155cc";
        glowColor = isWhite ? "#ffffff" : "#0a3a88";
        fillOpacity = isWhite ? 0.85 : 0.7;
      } else {
        primaryColor = "#1155cc";
        glowColor = "#0a3a88";
        fillOpacity = 0.7;
      }
    } else if (this.state === "EATEN") {
      shouldDrawBody = false;
    }

    const isGamePlaying = this.gameState && this.gameState.mode === "PLAYING";
    const timeScale = isGamePlaying ? Date.now() * 0.003 : 0;

    if (shouldDrawBody) {
      const breath = isGamePlaying ? Math.sin(timeScale * 2.2) * 2.2 : 0;

      ctx.save();
      ctx.translate(this.x, top + s);
      ctx.scale(1 + breath * 0.006, 1 - breath * 0.006);
      ctx.translate(-this.x, -(top + s));

      // Body gradient fill
      ctx.save();
      this.traceMasterGhostShape(left, top, s, timeScale);
      ctx.clip();

      const bodyGrad = ctx.createLinearGradient(left, top, left, top + s);
      bodyGrad.addColorStop(0, primaryColor);
      bodyGrad.addColorStop(0.8, "#000000");
      ctx.globalAlpha = fillOpacity;
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(left - 2, top - 2, s + 4, s + 4);
      ctx.restore();

      // Neon outline
      ctx.save();
      ctx.shadowBlur = s * 0.35;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      this.traceMasterGhostShape(left, top, s, timeScale);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    }

    const dir = this.getDirectionLabel();
    const breathVal = isGamePlaying ? Math.sin(timeScale * 2.2) * 2.2 : 0;
    this.drawEyes(left, top, s, dir, breathVal);
  }

  private drawEyes(
    left: number,
    top: number,
    s: number,
    dir: string,
    breath: number,
  ): void {
    const ctx = this.ctx;

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

    const finalEyeY = top + s * 0.44 + breath * 0.02;
    const eyeX1 = left + s * 0.3;
    const eyeX2 = left + s * 0.7;

    if (this.state !== "FRIGHTENED") {
      // White sclera
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(eyeX1, finalEyeY, s * 0.11, 0, Math.PI * 2);
      ctx.arc(eyeX2, finalEyeY, s * 0.11, 0, Math.PI * 2);
      ctx.fill();

      // Colored iris
      const irisColor = this.state === "EATEN" ? "#1155cc" : this.defaultColor;
      ctx.fillStyle = irisColor;
      ctx.beginPath();
      ctx.arc(eyeX1 + lookX, finalEyeY + lookY, s * 0.05, 0, Math.PI * 2);
      ctx.arc(eyeX2 + lookX, finalEyeY + lookY, s * 0.05, 0, Math.PI * 2);
      ctx.fill();

      // Black pupil
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(eyeX1 + lookX * 1.2, finalEyeY + lookY * 1.2, s * 0.022, 0, Math.PI * 2);
      ctx.arc(eyeX2 + lookX * 1.2, finalEyeY + lookY * 1.2, s * 0.022, 0, Math.PI * 2);
      ctx.fill();

      // White glint
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(eyeX1 + lookX * 0.5, finalEyeY - 1.8, s * 0.016, 0, Math.PI * 2);
      ctx.arc(eyeX2 + lookX * 0.5, finalEyeY - 1.8, s * 0.016, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Frightened eyes - brighter Tron blue
      ctx.fillStyle = "#66aadd";
      ctx.shadowBlur = s * 0.1;
      ctx.shadowColor = "#4499cc";
      ctx.beginPath();
      ctx.arc(eyeX1, finalEyeY, s * 0.04, 0, Math.PI * 2);
      ctx.arc(eyeX2, finalEyeY, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  private traceMasterGhostShape(
    left: number,
    top: number,
    s: number,
    timeScale: number,
  ): void {
    const ctx = this.ctx;
    const centerX = left + s / 2;
    const waveHeight = s * 0.06;
    const waveCount = 3;

    ctx.beginPath();
    ctx.arc(centerX, top + s / 2, s / 2, Math.PI, 0, false);

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

  
}