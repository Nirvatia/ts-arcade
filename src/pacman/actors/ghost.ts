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
import {
  ClassicVectorGhostRenderer,
  type IGhostRenderer,
} from "./ghost/ghostRenderer.js";

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

  // --- Wave Timer State Tracker Variables ---
  private waveTimer: number = 0;
  private waveIndex: number = 0;
  private waveDurations: number[] = [
    7000, 20000, 7000, 20000, 5000, 20000, 5000, -1,
  ];

  private renderer: IGhostRenderer;

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
    this.renderer = new ClassicVectorGhostRenderer();
    this.initEventListeners();
  }

  public draw(): void {
    this.renderer.draw(this.ctx, this, this.tileSize);
  }

  // --- Lifecycle ---

  public init(): void {
    this.lastEvaluatedGrid = { x: -1, y: -1 };
    this.waveTimer = 0;
    this.waveIndex = 0;
    this.state = "SCATTER";
    this.updateTargetNavigation();
  }

  public reset(): void {
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
    this.needsRedraw = true;
    this.renderer.clear();
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

  public update(dt: number): void {
    if (this.gameState.mode !== "PLAYING") return;

    const dtMs = dt * 1000;
    this.updateStateTimer(dtMs);

    // 1. Scripted Path Control (Inside Lair / Eyeballs traveling home)
    if (this.path.length > 0 || this.currentPathTarget !== null) {
      this.moveAlongPath(dt);
      this.needsRedraw = true;
      return;
    }

    // 2. High-Precision Distance-Budget Movement Sub-stepping
    let budgetDistance = this.speed * dt;

    while (budgetDistance > 0) {
      const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
      const currentTile = Collision.getTile(this.x, this.y);

      // Determine distance to the tile intersection point along current axis
      let distanceToCenter = 0;
      if (this.direction.dx !== 0) {
        distanceToCenter = (centerX - this.x) * this.direction.dx;
      } else if (this.direction.dy !== 0) {
        distanceToCenter = (centerY - this.y) * this.direction.dy;
      }

      // If we are moving toward a tile center and can reach/cross it within this step's budget
      if (distanceToCenter > 0 && budgetDistance >= distanceToCenter) {
        // Perfect Snap directly to the pivot center to consume that precise piece of distance
        this.x = centerX;
        this.y = centerY;
        budgetDistance -= distanceToCenter;

        // Trigger AI updates exactly on the center pixel before consuming remaining budget
        if (
          this.lastEvaluatedGrid.x !== currentTile.tileX ||
          this.lastEvaluatedGrid.y !== currentTile.tileY
        ) {
          this.updateTargetNavigation();
          this.lastEvaluatedGrid = {
            x: currentTile.tileX,
            y: currentTile.tileY,
          };
        }
      } else {
        // We aren't crossing a tile center this sub-step, so we check for wall collisions
        // Create an explicit single-pass look-ahead check for the remaining budget
        const lookAheadDistance = budgetDistance + this.r;
        const boundX = this.x + this.direction.dx * lookAheadDistance;
        const boundY = this.y + this.direction.dy * lookAheadDistance;
        const nextTile = Collision.getTile(boundX, boundY);

        if (Collision.isWall(nextTile.tileX, nextTile.tileY)) {
          // Hit a wall: Move directly up to the center of the current tile and stop moving
          this.x = centerX;
          this.y = centerY;
          this.updateTargetNavigation(); // Re-evaluate path because we're blocked
          budgetDistance = 0;
        } else {
          // Path clear: Consume the rest of the distance budget cleanly
          this.x += this.direction.dx * budgetDistance;
          this.y += this.direction.dy * budgetDistance;
          budgetDistance = 0;
        }
      }
    }

    this.teleport();
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

  private getRandomDirection(): void {
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

  private reverseDirection(): void {
    this.direction = {
      dx: -this.direction.dx,
      dy: -this.direction.dy,
    };
  }

  private beEaten(): void {
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
}
