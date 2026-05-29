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

  // Система деликатных матричных частиц
  private particleTimer: number = 0;
  private trailParticles: Array<{
    x: number;
    y: number;
    alpha: number;
    maxAlpha: number;
    size: number;
    phase: number;
  }> = [];

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
    this.trailParticles = [];
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

  private getDirectionLabel(): "LEFT" | "RIGHT" | "UP" | "DOWN" {
    const { dx, dy } = this.direction;
    if (dx === 1) return "RIGHT";
    if (dx === -1) return "LEFT";
    if (dy === -1) return "UP";
    if (dy === 1) return "DOWN";
    return "RIGHT";
  }

  // --- Draw (Cute Jelly Ghost & Ambient Matrix Particles) ---

  draw(): void {
    const ctx = this.ctx;
    const r = this.tileSize / 2;

    let primaryColor = this.defaultColor;
    let glowColor = this.color;
    let shouldDrawBody = true;

    if (this.state === "FRIGHTENED") {
      if (this.isFlashing) {
        const isWhite = Math.floor(Date.now() / this.flashSpeed) % 2 === 0;
        primaryColor = isWhite ? "#ffffff" : "#1155cc";
        glowColor = isWhite ? "#ffffff" : "#9933ff";
      } else {
        primaryColor = "#1155cc";
        glowColor = "#9933ff";
      }
    } else if (this.state === "EATEN") {
      shouldDrawBody = false;
    }

    const isGamePlaying = this.gameState && this.gameState.mode === "PLAYING";
    const timeScale = isGamePlaying ? Date.now() * 0.003 : 0;

    // --- ОБНОВЛЕНИЕ ЧАСТИЦ (Ионизация пространства матрицы) ---
    if (isGamePlaying && shouldDrawBody) {
      const isMoving = this.direction.dx !== 0 || this.direction.dy !== 0;

      if (isMoving) {
        this.particleTimer++;
        // Стабильно раз в 5 кадров активируем «пиксель» вокруг призрака
        if (this.particleTimer >= 5) {
          // Выбираем случайный угол вокруг призрака, чуть дальше радиуса его тела
          const angle = Math.random() * Math.PI * 2;
          const spawnDist = r * (1.0 + Math.random() * 0.3);

          this.trailParticles.push({
            x: this.x + Math.cos(angle) * spawnDist,
            y: this.y + Math.sin(angle) * spawnDist,
            alpha: 0,        // Начинают с нуля и плавно загораются
            maxAlpha: 0.7,   // Максимальная яркость неонового пикселя
            size: Math.random() > 0.5 ? 1.5 : 2.0, // Строгие квадратные/круглые кванты (1.5-2px)
            phase: 0         // 0 = разгорается, 1 = увядает
          });
          this.particleTimer = 0;
        }
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    // --- ОТРИСОВКА МАТРИЧНЫХ КВАНТОВ (Они лежат под телом) ---
    if (this.trailParticles.length > 0) {
      ctx.save();
      ctx.shadowBlur = 4;
      ctx.shadowColor = glowColor;

      for (let i = this.trailParticles.length - 1; i >= 0; i--) {
        const p = this.trailParticles[i];

        ctx.fillStyle = glowColor;
        ctx.globalAlpha = p.alpha;

        // Рисуем маленькие аккуратные хай-тек квадратики вместо мягких кругов
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);

        // Жизненный цикл частицы (Pulse in -> Fade out) без движения
        if (p.phase === 0) {
          p.alpha += 0.15; // Быстро зажигается при приближении призрака
          if (p.alpha >= p.maxAlpha) {
            p.alpha = p.maxAlpha;
            p.phase = 1;
          }
        } else {
          p.alpha -= 0.04; // Мягко гаснет, оставаясь на месте в коридоре
        }

        if (p.alpha <= 0) {
          this.trailParticles.splice(i, 1);
        }
      }
      ctx.restore();
    }

    // --- ОТРИСОВКА ТЕЛА ---
    if (shouldDrawBody) {
      this.drawSolidGhostBody(
        ctx,
        this.x,
        this.y,
        r,
        primaryColor,
        glowColor,
        timeScale,
        false,
      );
    }

    // Отрисовка глаз поверх
    const dir = this.getDirectionLabel();
    this.drawEyes(this.x, this.y, r, dir, timeScale);

    ctx.restore();
  }

  /**
   * Отрисовка ПЛОТНОГО, заполненного тела призрака с аккуратным Tron-эффектом.
   */
  private drawSolidGhostBody(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    primaryColor: string,
    glowColor: string,
    timeScale: number,
    isTrail: boolean,
  ): void {
    ctx.save();

    ctx.beginPath();
    const pts = 40;
    const baseR = r * 1.1;

    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2 - Math.PI / 2;
      let rr =
        baseR +
        Math.sin(angle * 3 + timeScale * 4) * r * 0.1 +
        Math.cos(angle * 5 - timeScale * 3) * r * 0.06;

      if (angle > 0.3 && angle < Math.PI - 0.3) {
        rr = baseR + Math.sin(i * 0.7 + timeScale * 3.5) * r * 0.18;
      }

      const px = cx + Math.cos(angle) * rr;
      const py = cy + Math.sin(angle) * rr * 0.9;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    if (isTrail) {
      ctx.fillStyle = primaryColor;
      ctx.fill();
    } else {
      const bodyGrad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      bodyGrad.addColorStop(0, primaryColor); 
      bodyGrad.addColorStop(0.75, primaryColor + "bb");
      bodyGrad.addColorStop(1, primaryColor + "22"); 

      ctx.fillStyle = bodyGrad;
      ctx.fill();

      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8; 
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawEyes(
    cx: number,
    cy: number,
    r: number,
    dir: "LEFT" | "RIGHT" | "UP" | "DOWN",
    t: number,
  ): void {
    const ctx = this.ctx;
    ctx.shadowBlur = 0;

    const eyeY = cy - r * 0.28;
    const eyeSpacing = r * 0.34;
    const eyeR = r * 0.2;

    const leftEyeX = cx - eyeSpacing;
    const rightEyeX = cx + eyeSpacing;

    const blinkCycle = Math.sin(t * 1.5) * 0.5 + 0.5;
    const blinkFactor = blinkCycle > 0.92 ? 1 - (blinkCycle - 0.92) / 0.08 : 1;
    const eyeScaleY = Math.max(0.06, blinkFactor);

    let moveX = 0;
    let moveY = 0;
    const lookOffset = r * 0.05;

    switch (dir) {
      case "LEFT":  moveX = -lookOffset; break;
      case "RIGHT": moveX = lookOffset;  break;
      case "UP":    moveY = -lookOffset; break;
      case "DOWN":  moveY = lookOffset;  break;
    }

    const px = moveX * 2.8;
    const py = moveY * 2.8;

    const renderSingleEye = (ex: number, ey: number, er: number) => {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.scale(1, eyeScaleY);

      if (this.state !== "FRIGHTENED") {
        ctx.fillStyle = "#f8fcff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(0, 0, er, 0, Math.PI * 2);
        ctx.fill();

        const pupilR = er * 0.48;
        ctx.fillStyle = this.state === "EATEN" ? "#1155cc" : "#010510";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(px, py, pupilR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px + er * 0.28, py - er * 0.32, er * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px - er * 0.18, py + er * 0.08, er * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#66aadd";
        ctx.shadowBlur = er * 0.3;
        ctx.shadowColor = "#4499cc";
        ctx.beginPath();
        ctx.arc(0, 0, er * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    renderSingleEye(leftEyeX, eyeY, eyeR);
    renderSingleEye(rightEyeX, eyeY, eyeR);
  }
}