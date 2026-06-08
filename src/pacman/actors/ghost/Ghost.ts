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
}

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

  private waveTimer: number = 0;
  private waveIndex: number = 0;
  private waveDurations: number[] = [
    7000, 20000, 7000, 20000, 5000, 20000, 5000, -1,
  ];

  // Rendering
  private trail: TrailParticle[] = [];
  private time = 0;
  private heading = 0;

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
    this.initEventListeners();
  }

  // ── Draw ──────────────────────────────────────────────────────
  public draw(): void {
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

    // Heading
    const spd = this.speed / (this.defaultSpeed || 1);
    const rawDx = this.direction.dx * spd;
    const rawDy = this.direction.dy * spd;
    const moveMag = Math.sqrt(rawDx ** 2 + rawDy ** 2);

    let targetHeading = this.heading;
    if (moveMag > 0.05) {
      targetHeading = Math.atan2(rawDy, rawDx);
    }
    let diff = targetHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * 0.12;

    // Emit trail — eaten state gets faint trailing particles too
    if (moveMag > 0.02) {
      this.emitTrail(r, themeColor, isFrightened, isEaten, moveMag);
    }
    this.updateTrail();

    // Render
    ctx.save();
    ctx.translate(this.x, this.y);

    if (!isEaten) {
      this.drawLens(ctx, r, themeColor, isFrightened);
      this.drawCore(ctx, r, themeColor, isFrightened);
    } else {
      this.drawRemnant(ctx, r, themeColor, t, moveMag);
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
    const alpha = frenzied ? 0.12 : 0.06;
    grad.addColorStop(
      0,
      `${color}${Math.floor(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`,
    );
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

    // Main diamond body
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = frenzied ? 16 : 10;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(sz * 0.2, -sz * 0.65);
    ctx.lineTo(-sz * 0.85, 0);
    ctx.lineTo(sz * 0.2, sz * 0.65);
    ctx.closePath();
    ctx.fill();

    // White-hot inner core
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

    // Side shards
    for (const side of [-1, 1]) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(sz * 0.25, side * sz * 0.6);
      ctx.lineTo(-sz * 0.15, side * sz * 0.28);
      ctx.lineTo(-sz * 0.55, side * sz * 0.55);
      ctx.lineTo(sz * 0.05, side * sz * 0.8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Trail ─────────────────────────────────────────────────────
  private emitTrail(
    r: number,
    color: string,
    frenzied: boolean,
    eaten: boolean,
    moveMag: number,
  ): void {
    const count = eaten ? 1 : frenzied ? 3 : 2;
    const backAngle = this.heading + Math.PI;

    for (let i = 0; i < count; i++) {
      const backDist = r * 0.85;
      const ox =
        this.x +
        Math.cos(backAngle) * backDist +
        (Math.random() - 0.5) * r * 0.35;
      const oy =
        this.y +
        Math.sin(backAngle) * backDist +
        (Math.random() - 0.5) * r * 0.35;

      const isWhite = eaten ? false : Math.random() < 0.2;
      this.trail.push({
        x: ox,
        y: oy,
        vx:
          Math.cos(backAngle) * (15 + moveMag * 30) +
          (Math.random() - 0.5) * 10,
        vy:
          Math.sin(backAngle) * (15 + moveMag * 30) +
          (Math.random() - 0.5) * 10,
        life: eaten ? 0.25 : frenzied ? 0.35 : 0.35,
        maxLife: eaten ? 0.25 : frenzied ? 0.35 : 0.35,
        size: eaten
          ? 0.6 + Math.random() * 1
          : frenzied
            ? 1.5 + Math.random() * 2.5
            : 0.8 + Math.random() * 2,
        color: isWhite ? "#ffffff" : color,
      });
    }
  }

  private updateTrail(): void {
    const dt = 1 / 60;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.trail.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    for (const p of this.trail) {
      const a = p.life / p.maxLife;
      const sz = p.size * a;
      if (sz < 0.2) continue;

      ctx.save();
      ctx.globalAlpha = a * 0.7;
      // Bright center dot
      const dotR = sz * 0.25;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
      ctx.fill();
      // Colored square around it
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.color === "#ffffff" ? 5 : 2;
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      ctx.restore();
    }
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
          const [ty, tx] = this.path[0].split(",").map(Number);
          this.currentPathTarget = {
            x: tx * this.tileSize + this.tileSize / 2,
            y: ty * this.tileSize + this.tileSize / 2,
          };
        } else break;
      }
      const dx = this.currentPathTarget.x - this.x,
        dy = this.currentPathTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.001) {
        if (Math.abs(dx) > Math.abs(dy))
          this.direction = { dx: Math.sign(dx), dy: 0 };
        else this.direction = { dx: 0, dy: Math.sign(dy) };
      }
      if (dist <= budget) {
        this.x = this.currentPathTarget.x;
        this.y = this.currentPathTarget.y;
        budget -= dist;
        this.currentPathTarget = null;
        if (this.path.length > 0) this.path.shift();
        // In moveAlongPath, replace the else block when path empties:

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

            // NEW: Verify the chosen direction is valid from current position
            const ct = this.gridContext.getTile(this.x, this.y);
            const nx = ct.tileX + this.direction.dx;
            const ny = ct.tileY + this.direction.dy;
            // Allow exiting through GL gate
            const currentTile =
              this.gameState.levelData.map[ct.tileY]?.[ct.tileX];
            const isExitingLair =
              currentTile === "LE" ||
              this.gameState.levelData.map[ny]?.[nx] === "LE";

            if (this.gridContext.isWall(nx, ny, isExitingLair)) {
              // Forced direction change — pick first valid non-wall direction
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
    const path = findShortestPath(
      this.gameState.pathGraph!,
      `${tileY},${tileX}`,
      `${this.spawnGridY},${this.spawnGridX}`,
    );
    if (path) this.path = path;
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
    const path = findShortestPath(
      this.gameState.pathGraph!,
      `${this.spawnGridY},${this.spawnGridX}`,
      target,
    );
    if (path) this.path = path;
  }
}
