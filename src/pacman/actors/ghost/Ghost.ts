import {
  getBlinkyTarget,
  getClydeTarget,
  getInkyTarget,
  getPinkyTarget,
  getScatterTarget,
} from "../../ai/ghostAI.js";
import { eventBus } from "../../core/EventBus.js";
import { findLairExit } from "../../pathfinding/lair.js";
import { findShortestPath } from "../../pathfinding/search.js";
import { Actor } from "../Actor.js";

import type { TileType } from "../../shared/types.js";
import type { GhostConfig } from "../../config/ghost.config.js";
import type { TargetCoords } from "../../ai/ghostAI.js";
import type { LevelContext } from "../../core/LevelContext.js";
import type { CanvasLayer } from "../../render/CanvasLayer.js";

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  active: boolean; // Tracking property for Object Pooling
}

interface PathNode {
  ty: number;
  tx: number;
}

const MAX_PARTICLES = 60;
const TIME_STEP = 1 / 60;

export class Ghost extends Actor {
  public name: string;
  public codename: string;
  public defaultColor: string;
  public color: string;
  public state: "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN" = "CHASE";
  public personality: "shadow" | "ambush" | "wild" | "shy";

  private path: PathNode[] = [];
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

  private waveTimer: number = 0;
  private waveIndex: number = 0;
  private waveDurations: number[] = [
    7000, 20000, 7000, 20000, 5000, 20000, 5000, -1,
  ];

  // Rendering
  private trail: TrailParticle[] = [];
  private time = 0;
  private heading = 0;

  // Cached strings for rendering optimizations
  private cachedLensAlphaColor: string = "";
  private lastCachedColorBase: string = "";

  constructor(
    canvasLayer: CanvasLayer,
    levelContext: LevelContext,
    config: GhostConfig,
  ) {
    super(canvasLayer, levelContext);
    this.name = config.name;
    this.codename = config.codename;
    this.defaultColor = config.defaultColor;
    this.color = config.color;
    this.personality = config.personality;
    this.defaultSpeed = this.tileSize * config.speedMultiplier;
    this.speed = this.defaultSpeed;
    this.frightenedSpeed = this.tileSize * config.frightenedSpeedMultiplier;
    this.eatenSpeed = this.tileSize * config.eatenSpeedMultiplier;
    this.direction = { dx: 0, dy: 0 };

    // Initialize Particle Object Pool
    this.trail = Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      size: 0,
      color: "",
      active: false,
    }));

    this.initEventListeners();
  }

  // ── Draw ──────────────────────────────────────────────────────
  public draw(): void {
    this.drawDebug();
    return;
    const ctx = this.layer.ctx;
    const r = this.tileSize * 0.42;
    let themeColor = this.color || this.defaultColor;
    let isFrightened = false;
    let isEaten = false;
    const t = Date.now();
    this.time = t;

    if (this.state === "FRIGHTENED") {
      isFrightened = true;
      if (this.isFlashing) {
        const isWhite = Math.floor(t / this.flashSpeed) % 2 === 0;
        themeColor = isWhite ? "#ffffff" : "#ee99ff";
      } else {
        themeColor = "#9966ee";
      }
    } else if (this.state === "EATEN") {
      isEaten = true;
      themeColor = "#9988cc";
    }

    // Performance Update: Fast Squared Magnitude check instead of Math.sqrt
    const spd = this.speed / (this.defaultSpeed || 1);
    const rawDx = this.direction.dx * spd;
    const rawDy = this.direction.dy * spd;
    const moveMagSq = rawDx * rawDx + rawDy * rawDy;

    if (moveMagSq > 0.0025) {
      // 0.05 squared is 0.0025
      const targetHeading = Math.atan2(rawDy, rawDx);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * 0.12;
    }

    // Emit trail
    if (moveMagSq > 0.0004) {
      // 0.02 squared is 0.0004
      this.emitTrail(r, themeColor, isFrightened, isEaten, moveMagSq);
    }
    this.updateTrail();

    // Render Character
    ctx.save();
    ctx.translate(this.x, this.y);

    if (!isEaten) {
      this.drawLens(ctx, r, themeColor, isFrightened);
      this.drawCore(ctx, r, themeColor, isFrightened);
    } else {
      // Pass square root down only here where calculations require vector translation scaling
      this.drawRemnant(ctx, r, themeColor, t, Math.sqrt(moveMagSq));
    }

    ctx.restore();

    this.drawTrail(ctx);
  }

  // ── Lens ──────────────────────────────────────────────────────
  private drawLens(
    ctx: CanvasRenderingContext2D,
    r: number,
    color: string,
    frenzied: boolean,
  ): void {
    const outerR = r * 1.5;
    const grad = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, outerR);

    // Performance Update: Dynamic color allocation caching mechanics
    if (this.lastCachedColorBase !== color) {
      this.lastCachedColorBase = color;
      const alpha = frenzied ? 0.12 : 0.06;
      this.cachedLensAlphaColor = `${color}${Math.floor(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;
    }

    grad.addColorStop(0, this.cachedLensAlphaColor);
    grad.addColorStop(0.5, `${color}03`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Core ──────────────────────────────────────────────────────
  private drawCore(
    ctx: CanvasRenderingContext2D,
    r: number,
    color: string,
    frenzied: boolean,
  ): void {
    const sz = r * 0.7;
    ctx.save();
    ctx.rotate(this.heading);

    // Context changes minimized by structuring alpha rules sequentially
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = frenzied ? 16 : 10;

    // Main diamond body
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(sz * 0.2, -sz * 0.65);
    ctx.lineTo(-sz * 0.85, 0);
    ctx.lineTo(sz * 0.2, sz * 0.65);
    ctx.closePath();
    ctx.fill();

    // Side shards
    ctx.globalAlpha = 0.7;
    ctx.shadowBlur = 5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sz * 0.25, side * sz * 0.6);
      ctx.lineTo(-sz * 0.15, side * sz * 0.28);
      ctx.lineTo(-sz * 0.55, side * sz * 0.55);
      ctx.lineTo(sz * 0.05, side * sz * 0.8);
      ctx.closePath();
      ctx.fill();
    }

    // White-hot inner core (drawn last to avoid toggling shadow styling variants back and forth)
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = frenzied ? 12 : 6;
    ctx.globalAlpha = frenzied ? 0.95 : 0.65;
    ctx.beginPath();
    ctx.moveTo(sz * 0.5, 0);
    ctx.lineTo(sz * 0.05, -sz * 0.32);
    ctx.lineTo(-sz * 0.38, 0);
    ctx.lineTo(sz * 0.05, sz * 0.32);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ── Trail ─────────────────────────────────────────────────────
  private emitTrail(
    r: number,
    color: string,
    frenzied: boolean,
    eaten: boolean,
    moveMagSq: number,
  ): void {
    const count = eaten ? 1 : frenzied ? 3 : 2;
    const backAngle = this.heading + Math.PI;
    const moveMag = Math.sqrt(moveMagSq);
    const cosAngle = Math.cos(backAngle);
    const sinAngle = Math.sin(backAngle);
    const backDist = r * 0.85;

    let emitted = 0;

    // Performance Update: Query pooled allocation structure index mappings directly
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (emitted >= count) break;

      const p = this.trail[i];
      if (p.active) continue;

      const ox =
        this.x + cosAngle * backDist + (Math.random() - 0.5) * r * 0.35;
      const oy =
        this.y + sinAngle * backDist + (Math.random() - 0.5) * r * 0.35;
      const isWhite = eaten ? false : Math.random() < 0.2;
      const lifeSpan = eaten ? 0.25 : 0.35;

      p.active = true;
      p.x = ox;
      p.y = oy;
      p.vx = cosAngle * (15 + moveMag * 30) + (Math.random() - 0.5) * 10;
      p.vy = sinAngle * (15 + moveMag * 30) + (Math.random() - 0.5) * 10;
      p.life = lifeSpan;
      p.maxLife = lifeSpan;
      p.size = eaten
        ? 0.6 + Math.random() * 1
        : frenzied
          ? 1.5 + Math.random() * 2.5
          : 0.8 + Math.random() * 2;
      p.color = isWhite ? "#ffffff" : color;

      emitted++;
    }
  }

  private updateTrail(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.trail[i];
      if (!p.active) continue;

      p.life -= TIME_STEP;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * TIME_STEP;
      p.y += p.vy * TIME_STEP;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    // Performance Update: Unified state initialization loop wrapper safely containing active context
    ctx.save();

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.trail[i];
      if (!p.active) continue;

      const a = p.life / p.maxLife;
      const sz = p.size * a;
      if (sz < 0.2) continue;

      ctx.globalAlpha = a * 0.7;

      // Bright center dot
      const dotR = sz * 0.25;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
      ctx.fill();

      // Colored square boundary footprint framing execution
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.color === "#ffffff" ? 5 : 2;
      ctx.fillRect(p.x - sz * 0.5, p.y - sz * 0.5, sz, sz);
    }

    ctx.restore();
  }

  // ── Eaten ─────────────────────────────────────────────────────
  private drawRemnant(
    ctx: CanvasRenderingContext2D,
    r: number,
    color: string,
    t: number,
    moveMag: number,
  ): void {
    const coreR = r * 0.12;

    // ── Scanner brackets ────────────────────────────────────
    ctx.save();
    const lx = Math.sin(t * 0.025) * 3;
    const ly = Math.cos(t * 0.031) * 2.5;
    ctx.strokeStyle = `${color}99`;
    ctx.lineWidth = 1.3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -5 + lx);
    ctx.lineTo(-r * 0.75, ly * 0.4);
    ctx.lineTo(-r * 0.55, 5 - lx);
    ctx.moveTo(r * 0.55, -5 - ly);
    ctx.lineTo(r * 0.75, -lx * 0.4);
    ctx.lineTo(r * 0.55, 5 + ly);
    ctx.stroke();
    ctx.restore();

    // ── Tiny crystal core ───────────────────────────────────
    ctx.save();
    const cs = coreR * 1.4;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(cs * 0.7, 0);
    ctx.lineTo(0, -cs);
    ctx.lineTo(-cs * 0.7, 0);
    ctx.lineTo(0, cs);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(cs * 0.25, 0);
    ctx.lineTo(0, -cs * 0.35);
    ctx.lineTo(-cs * 0.25, 0);
    ctx.lineTo(0, cs * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── AI & movement ─────────────────────────────────────────────
  private initEventListeners(): void {
    eventBus.on("power_pill:activated", () => {
      if (this.state !== "EATEN") {
        const ps = this.state;
        this.state = "FRIGHTENED";
        this.isFlashing = false;
        this.speed = this.frightenedSpeed;
        this.reverseDirection();
        eventBus.emit("ghost:state_changed", {
          ghostName: this.name,
          from: ps,
          to: "FRIGHTENED",
        });
      }
    });
    eventBus.on("power_pill:warning", () => {
      if (this.state === "FRIGHTENED") this.isFlashing = true;
    });
    eventBus.on("power_pill:expired", () => {
      this.isFlashing = false;
      if (this.state === "FRIGHTENED") {
        const ps = this.state;
        this.speed = this.defaultSpeed;
        const wave = this.getActiveWaveType();
        this.state = wave;
        eventBus.emit("ghost:state_changed", {
          ghostName: this.name,
          from: ps,
          to: wave,
        });
      }
    });
    eventBus.on("ghost:eaten", (data) => {
      if (data && this.name === data.ghostName && this.state === "FRIGHTENED")
        this.beEaten();
    });
  }

  public update(dt: number): void {
    if (this.gameState.mode !== "PLAYING") return;

    const dtMs = dt * 1000;

    this.updateStateTimer(dtMs);
    if (this.path.length > 0 || this.currentPathTarget !== null) {
      this.moveAlongPath(dt);
      this.needsRedraw = true;
      return;
    }

    let budget = this.speed * dt;

    while (budget > 0) {
      const { centerX, centerY } = this.gridContext.getTileCenter(
        this.x,
        this.y,
      );
      const ct = this.gridContext.getTile(this.x, this.y);
      let dtc = 0;
      if (this.direction.dx !== 0) dtc = (centerX - this.x) * this.direction.dx;
      else if (this.direction.dy !== 0)
        dtc = (centerY - this.y) * this.direction.dy;
      if (dtc > 0 && budget >= dtc) {
        this.x = centerX;
        this.y = centerY;
        budget -= dtc;
        if (
          this.lastEvaluatedGrid.x !== ct.tileX ||
          this.lastEvaluatedGrid.y !== ct.tileY
        ) {
          this.updateTargetNavigation();
          this.lastEvaluatedGrid = { x: ct.tileX, y: ct.tileY };
        }
      } else {
        const look = budget + this.r;
        const bx = this.x + this.direction.dx * look,
          by = this.y + this.direction.dy * look;
        const nt = this.gridContext.getTile(bx, by);
        if (this.gridContext.isWall(nt.tileX, nt.tileY)) {
          this.x = centerX;
          this.y = centerY;
          this.updateTargetNavigation();
          budget = 0;
        } else {
          this.x += this.direction.dx * budget;
          this.y += this.direction.dy * budget;
          budget = 0;
        }
      }
    }
    this.teleport();
    this.needsRedraw = true;
  }

  private updateStateTimer(dtMs: number): void {
    const lim = this.waveDurations[this.waveIndex];
    if (lim === -1) return;
    this.waveTimer += dtMs;
    if (this.waveTimer >= lim) {
      this.waveTimer -= lim;
      this.waveIndex++;
      const ns = this.getActiveWaveType();
      if (this.state === "CHASE" || this.state === "SCATTER") {
        const ps = this.state;
        this.state = ns;
        this.reverseDirection();
        eventBus.emit("ghost:state_changed", {
          ghostName: this.name,
          from: ps,
          to: ns,
        });
      }
    }
  }

  private getActiveWaveType(): "CHASE" | "SCATTER" {
    return this.waveIndex % 2 === 0 ? "SCATTER" : "CHASE";
  }

  private updateTargetNavigation(): void {
    const map = this.gameState.levelData.map;
    const ct = this.gridContext.getTile(this.x, this.y);
    const pacman = this.levelContext.pacman;
    if (this.state === "FRIGHTENED") {
      this.getRandomDirection();
      return;
    }
    let target: TargetCoords = { tileX: 0, tileY: 0 };
    if (this.state === "SCATTER") target = getScatterTarget(this.name, map);
    else if (this.state === "CHASE") {
      switch (this.name) {
        case "blinky":
          target = getBlinkyTarget(pacman, this.gridContext);
          break;
        case "pinky":
          target = getPinkyTarget(pacman, this.gridContext);
          break;
        case "inky": {
          const b = this.levelContext.ghosts.find((g) => g.name === "blinky");
          target = getInkyTarget(b, pacman, this.gridContext);
          break;
        }
        case "clyde":
          target = getClydeTarget(
            this.x,
            this.y,
            map,
            pacman,
            this.gridContext,
          );
          break;
        default:
          target = getScatterTarget(this.name, map);
      }
    }
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 0 },
    ];
    let best = this.direction,
      min = Infinity,
      found = false;
    for (const d of dirs) {
      if (d.dx === -this.direction.dx && d.dy === -this.direction.dy) continue;
      const nx = ct.tileX + d.dx,
        ny = ct.tileY + d.dy;
      if (!this.gridContext.isWall(nx, ny)) {
        found = true;
        const dist = (nx - target.tileX) ** 2 + (ny - target.tileY) ** 2;
        if (dist < min) {
          min = dist;
          best = d;
        }
      }
    }
    if (!found)
      for (const d of dirs) {
        if (!this.gridContext.isWall(ct.tileX + d.dx, ct.tileY + d.dy)) {
          best = d;
          break;
        }
      }
    this.direction = best;
  }

  private moveAlongPath(dt: number): void {
    let budget = this.speed * dt;
    while (budget > 0) {
      if (!this.currentPathTarget) {
        if (this.path.length > 0) {
          // Performance Update: Read coordinate objects directly without string parsing
          const node = this.path[0];
          this.currentPathTarget = {
            x: node.tx * this.tileSize + this.tileSize * 0.5,
            y: node.ty * this.tileSize + this.tileSize * 0.5,
          };
        } else break;
      }
      const dx = this.currentPathTarget.x - this.x,
        dy = this.currentPathTarget.y - this.y;

      // Performance Update: Squared distance calculation shortcut
      const distSq = dx * dx + dy * dy;
      if (distSq > 0.000001) {
        if (Math.abs(dx) > Math.abs(dy))
          this.direction = { dx: Math.sign(dx), dy: 0 };
        else this.direction = { dx: 0, dy: Math.sign(dy) };
      }

      const dist = Math.sqrt(distSq);
      if (dist <= budget) {
        this.x = this.currentPathTarget.x;
        this.y = this.currentPathTarget.y;
        budget -= dist;
        this.currentPathTarget = null;
        if (this.path.length > 0) this.path.shift();

        if (this.path.length === 0) {
          if (this.isReturningHome) {
            const ps = this.state;
            const wave = this.getActiveWaveType();
            this.state = wave;
            this.speed = this.defaultSpeed;
            this.color = this.defaultColor;
            this.isReturningHome = false;
            eventBus.emit("ghost:state_changed", {
              ghostName: this.name,
              from: ps,
              to: wave,
            });
            eventBus.emit("ghost:returned_home", { ghostName: this.name });
            this.calculateExitPath();
          } else {
            this.currentPathTarget = null;
            this.snapToMovementAxis();
            this.direction = { dx: 0, dy: 0 };
            this.lastEvaluatedGrid = { x: -1, y: -1 };
            this.updateTargetNavigation();

            const ct = this.gridContext.getTile(this.x, this.y);
            const nx = ct.tileX + this.direction.dx;
            const ny = ct.tileY + this.direction.dy;
            const currentTile =
              this.gameState.levelData.map[ct.tileY]?.[ct.tileX];
            const isExitingLair =
              currentTile === "LE" ||
              this.gameState.levelData.map[ny]?.[nx] === "LE";

            if (this.gridContext.isWall(nx, ny, isExitingLair)) {
              const dirs = [
                { dx: 0, dy: -1 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 1, dy: 0 },
              ];
              for (const d of dirs) {
                const tx = ct.tileX + d.dx;
                const ty = ct.tileY + d.dy;
                if (!this.gridContext.isWall(tx, ty, isExitingLair)) {
                  this.direction = d;
                  break;
                }
              }
            }

            budget = 0;
          }
        }
      } else {
        this.x += (dx / dist) * budget;
        this.y += (dy / dist) * budget;
        budget = 0;
      }
    }
  }

  private getRandomDirection(): void {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const horiz = dirs.filter((d) => d.dy === 0),
      vert = dirs.filter((d) => d.dx === 0);
    let pref = this.direction.dy === 0 ? vert : horiz;
    for (let i = pref.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pref[i], pref[j]] = [pref[j], pref[i]];
    }
    const ct = this.gridContext.getTile(this.x, this.y);
    for (const d of pref) {
      if (!this.gridContext.isWall(ct.tileX + d.dx, ct.tileY + d.dy)) {
        this.direction = d;
        return;
      }
    }
    if (
      !this.gridContext.isWall(
        ct.tileX + this.direction.dx,
        ct.tileY + this.direction.dy,
      )
    )
      return;
    const rev = { dx: -this.direction.dx, dy: -this.direction.dy };
    if (!this.gridContext.isWall(ct.tileX + rev.dx, ct.tileY + rev.dy)) {
      this.direction = rev;
      return;
    }
    this.direction = { dx: 0, dy: 0 };
  }

  private reverseDirection(): void {
    this.direction = { dx: -this.direction.dx, dy: -this.direction.dy };
  }

  private beEaten(): void {
    const ps = this.state;
    this.state = "EATEN";
    this.speed = this.eatenSpeed;
    this.isReturningHome = true;
    eventBus.emit("ghost:state_changed", {
      ghostName: this.name,
      from: ps,
      to: "EATEN",
    });
    const { tileX, tileY } = this.gridContext.getTile(this.x, this.y);

    const rawPath = findShortestPath(
      this.gameState.pathGraph!,
      `${tileY},${tileX}`,
      `${this.spawnGridY},${this.spawnGridX}`,
    );

    // Performance Update: Map returned string keys instantly to coordinate nodes
    if (rawPath) {
      this.path = rawPath.map((strNode) => {
        const [ty, tx] = strNode.split(",").map(Number);
        return { ty, tx };
      });
    }
  }

  public spawn(): void {
    const map = this.gameState.levelData.map;
    for (let y = 0; y < map.length; y++) {
      const x = map[y].findIndex((tile: TileType) => tile === this.codename);
      if (x !== -1) {
        this.spawnGridX = x;
        this.spawnGridY = y;
        this.x = x * this.tileSize + this.tileSize / 2;
        this.y = y * this.tileSize + this.tileSize / 2;
        break;
      }
    }
  }

  public calculateExitPath(): void {
    const map = this.gameState.levelData.map;
    const target = findLairExit(map);
    const rawPath = findShortestPath(
      this.gameState.pathGraph!,
      `${this.spawnGridY},${this.spawnGridX}`,
      target,
    );

    // Performance Update: Map serialization objects efficiently
    if (rawPath) {
      this.path = rawPath.map((strNode) => {
        const [ty, tx] = strNode.split(",").map(Number);
        return { ty, tx };
      });
    }
  }

  public drawDebug(): void {
    const ctx = this.layer.ctx;
    const r = this.tileSize * 0.42;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw basic classic ghost body shape
    ctx.fillStyle = this.color || this.defaultColor;
    ctx.beginPath();
    // Arc top half of the body
    ctx.arc(0, -r * 0.1, r, Math.PI, 0, false);
    // Right side wall down
    ctx.lineTo(r, r);
    // Bottom wiggly skirt waves
    ctx.lineTo(r * 0.5, r * 0.6);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.5, r * 0.6);
    ctx.lineTo(-r, r);
    // Left side wall back up
    ctx.closePath();
    ctx.fill();

    // Draw basic eyes
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.2, r * 0.25, 0, Math.PI * 2);
    ctx.arc(r * 0.35, -r * 0.2, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Draw basic pupils looking in movement direction
    ctx.fillStyle = "#0000ff";
    const dx = this.direction.dx * (r * 0.08);
    const dy = this.direction.dy * (r * 0.08);
    ctx.beginPath();
    ctx.arc(-r * 0.35 + dx, -r * 0.2 + dy, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.35 + dx, -r * 0.2 + dy, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
