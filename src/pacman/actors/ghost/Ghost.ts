import * as PIXI from "pixi.js";
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

import type { GhostConfig } from "../../config/ghost.config.js";
import type { TargetCoords } from "../../ai/ghostAI.js";
import type { LevelContext } from "../../core/LevelContext.js";

interface PathNode {
  ty: number;
  tx: number;
}

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

  public container: PIXI.Container;
  private gfx: PIXI.Graphics;

  private time: number = 0;

  constructor(levelContext: LevelContext, config: GhostConfig) {
    super(levelContext);
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

    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);

    this.initEventListeners();
  }

  // ══════════════════════════════════════════
  // DRAW — Basic shapes only. Clean slate.
  // ══════════════════════════════════════════

  public draw(): void {
    this.container.x = this.x;
    this.container.y = this.y;

    this.gfx.clear();

    const r = this.tileSize * 0.4;

    if (this.state === "EATEN") {
      // Two small dots
      this.gfx.circle(-r * 0.3, -r * 0.1, r * 0.15);
      this.gfx.fill({ color: 0xffffff });
      this.gfx.circle(r * 0.3, -r * 0.1, r * 0.15);
      this.gfx.fill({ color: 0xffffff });
      return;
    }

    let colorHex = 0xff0000;
    if (this.state === "FRIGHTENED") {
      colorHex = this.isFlashing
        ? (Math.floor(this.time / this.flashSpeed) % 2 === 0 ? 0xffffff : 0x9999ff)
        : 0x6666cc;
    } else if (this.state === "CHASE" || this.state === "SCATTER") {
      colorHex = PIXI.Color.shared.setValue(this.color || this.defaultColor).toNumber();
    }

    // Body: circle
    this.gfx.circle(0, -r * 0.15, r);
    this.gfx.fill({ color: colorHex });

    // Wavy bottom edge: a few overlapping circles
    const waveCount = 3;
    const waveWidth = (r * 2) / waveCount;
    for (let i = 0; i < waveCount; i++) {
      const wx = -r + waveWidth * 0.5 + i * waveWidth;
      this.gfx.circle(wx, r * 0.5, waveWidth * 0.55);
      this.gfx.fill({ color: colorHex });
    }

    // Eyes: two white circles
    const eyeR = r * 0.22;
    this.gfx.circle(-r * 0.3, -r * 0.2, eyeR);
    this.gfx.fill({ color: 0xffffff });
    this.gfx.circle(r * 0.3, -r * 0.2, eyeR);
    this.gfx.fill({ color: 0xffffff });

    // Pupils: two small blue circles, offset in movement direction
    const pupilR = eyeR * 0.45;
    const lookX = this.direction.dx * pupilR * 0.5;
    const lookY = this.direction.dy * pupilR * 0.5;
    this.gfx.circle(-r * 0.3 + lookX, -r * 0.2 + lookY, pupilR);
    this.gfx.fill({ color: 0x2244aa });
    this.gfx.circle(r * 0.3 + lookX, -r * 0.2 + lookY, pupilR);
    this.gfx.fill({ color: 0x2244aa });
  }

  // ══════════════════════════════════════════
  // AI & MOVEMENT
  // ══════════════════════════════════════════

  private initEventListeners(): void {
    eventBus.on("power_pill:activated", () => {
      if (this.state !== "EATEN") {
        const ps = this.state;
        this.state = "FRIGHTENED";
        this.isFlashing = false;
        this.speed = this.frightenedSpeed;
        this.reverseDirection();
        eventBus.emit("ghost:state_changed", {
          ghostName: this.name, from: ps, to: "FRIGHTENED",
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
          ghostName: this.name, from: ps, to: wave,
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
    this.time += dtMs;

    if (this.path.length > 0 || this.currentPathTarget !== null) {
      this.moveAlongPath(dt);
      this.needsRedraw = true;
      return;
    }

    let budget = this.speed * dt;
    while (budget > 0) {
      const { centerX, centerY } = this.gridContext.getTileCenter(this.x, this.y);
      const ct = this.gridContext.getTile(this.x, this.y);
      let dtc = 0;
      if (this.direction.dx !== 0) dtc = (centerX - this.x) * this.direction.dx;
      else if (this.direction.dy !== 0) dtc = (centerY - this.y) * this.direction.dy;

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
        const bx = this.x + this.direction.dx * look;
        const by = this.y + this.direction.dy * look;
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
          ghostName: this.name, from: ps, to: ns,
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
          target = getClydeTarget(this.x, this.y, map, pacman, this.gridContext);
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
    let best = this.direction;
    let min = Infinity;
    let found = false;
    for (const d of dirs) {
      if (d.dx === -this.direction.dx && d.dy === -this.direction.dy) continue;
      const nx = ct.tileX + d.dx;
      const ny = ct.tileY + d.dy;
      if (!this.gridContext.isWall(nx, ny)) {
        found = true;
        const dist = (nx - target.tileX) ** 2 + (ny - target.tileY) ** 2;
        if (dist < min) {
          min = dist;
          best = d;
        }
      }
    }
    if (!found) {
      for (const d of dirs) {
        if (!this.gridContext.isWall(ct.tileX + d.dx, ct.tileY + d.dy)) {
          best = d;
          break;
        }
      }
    }
    this.direction = best;
  }

  private moveAlongPath(dt: number): void {
    let budget = this.speed * dt;
    while (budget > 0) {
      if (!this.currentPathTarget) {
        if (this.path.length > 0) {
          const node = this.path[0];
          this.currentPathTarget = {
            x: node.tx * this.tileSize + this.tileSize * 0.5,
            y: node.ty * this.tileSize + this.tileSize * 0.5,
          };
        } else break;
      }
      const dx = this.currentPathTarget.x - this.x;
      const dy = this.currentPathTarget.y - this.y;
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
              ghostName: this.name, from: ps, to: wave,
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
            const currentTile = this.gameState.levelData.map[ct.tileY]?.[ct.tileX];
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
    const horiz = dirs.filter((d) => d.dy === 0);
    const vert = dirs.filter((d) => d.dx === 0);
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
    if (!this.gridContext.isWall(ct.tileX + this.direction.dx, ct.tileY + this.direction.dy)) return;
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
      ghostName: this.name, from: ps, to: "EATEN",
    });
    const { tileX, tileY } = this.gridContext.getTile(this.x, this.y);
    const rawPath = findShortestPath(
      this.gameState.pathGraph!,
      `${tileY},${tileX}`,
      `${this.spawnGridY},${this.spawnGridX}`,
    );
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

  public calculateExitPath(): void {
    const map = this.gameState.levelData.map;
    const target = findLairExit(map);
    const rawPath = findShortestPath(
      this.gameState.pathGraph!,
      `${this.spawnGridY},${this.spawnGridX}`,
      target,
    );
    if (rawPath) {
      this.path = rawPath.map((strNode) => {
        const [ty, tx] = strNode.split(",").map(Number);
        return { ty, tx };
      });
    }
  }
}