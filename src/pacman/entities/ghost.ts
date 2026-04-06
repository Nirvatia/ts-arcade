import { CANVAS_CONFIG } from "../config/canvas.js";
import { Collision } from "../game/collision.js";
import { eventBus } from "../game/eventBus.js";
import { GameState } from "../game/state.js";
import { findLairExit, findShortestPath } from "../utils.js";
import { Entity } from "./entity.js";

class Ghost extends Entity {
  // -------------------------
  // 1. Properties
  // -------------------------
  private gameState: GameState;
  private collision: Collision;

  public state: "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN" = "CHASE";
  private direction: { dx: number; dy: number };
  private lastTeleportExit: { x: number; y: number } | null = null;
  private path: string[] = [];
  private currentPathTarget: { x: number; y: number } | null = null;
  private spawnGridX: number = 0;
  private spawnGridY: number = 0;
  public name: string;
  public defaultColor: string;
  public color: string;
  public x: number;
  public y: number;
  public r: number;
  private defaultSpeed: number;
  private speed: number;
  private isReturningHome: boolean = false;
  private isFlashing: boolean;
  private flashSpeed: number = 200;

  // -------------------------
  // 2. Constructor
  // -------------------------
  constructor(name: string, color: string) {
    super(CANVAS_CONFIG.canvasIds.ghosts, true);

    this.gameState = GameState.getInstance();
    this.collision = Collision.getInstance();
    this.name = name;
    this.defaultColor = color;
    this.color = color;
    this.direction = { dx: 0, dy: 0 };
    this.x = 0;
    this.y = 0;
    this.r = this.tileSize / 2;
    this.defaultSpeed = this.tileSize / 16;
    this.speed = this.defaultSpeed;
    this.isFlashing = false;
  }

  // -------------------------
  // 3. Lifecycle
  // -------------------------
  public override init() {
    this.getRandomDirection();
    this.initEventListeners();
  }

  private initEventListeners() {
    eventBus.on("POWER_PILL_EATEN", () => {
      if (this.state !== "EATEN") {
        this.state = "FRIGHTENED";
        this.isFlashing = false;
        this.reverseDirection();
      }
    });

    eventBus.on("POWER_PILL_WARNING", () => {
      if (this.state === "FRIGHTENED") {
        this.isFlashing = true;
      }
    });

    eventBus.on("POWER_PILL_EXPIRED", () => {
      this.isFlashing = false;
      if (this.state === "FRIGHTENED") {
        this.state = "CHASE";
      }
    });

    // 🌟 THE FIX: Listen to the COMMAND emitted by Pacman
    eventBus.on(
      "COMMAND_GHOST_EATEN",
      (data: { ghostName: string } | undefined) => {
        if (
          data &&
          this.name === data.ghostName &&
          this.state === "FRIGHTENED"
        ) {
          this.beEaten();

          // 🌟 Broadcast out to GameState and AudioController that the ghost is officially consumed
          eventBus.emit("GHOST_EATEN", { ghostName: this.name });
        }
      },
    );
  }

  public override reset() {
    this.lastTeleportExit = null;
    this.direction = { dx: 0, dy: 0 };
    this.speed = this.defaultSpeed;
    this.color = this.defaultColor;

    // 🔥 ADD THESE TO CLEAR PATHING & STATE ON RESET
    this.path = [];
    this.currentPathTarget = null;
    this.isReturningHome = false;
    this.isFlashing = false;
    this.state = "CHASE";
  }

  public override resetForLevel() {
    // 🔥 CHANGE THIS: Call this.spawn() instead of getRandomDirection.
    // This physically moves them back to the grid coords before picking a direction!
    this.reset();
    this.spawn();
    this.getRandomDirection();
  }

  // -------------------------
  // 4. Update loop
  // -------------------------
  public update() {
    // 1. PATHFINDING OVERRIDE (For exiting lair or returning home)
    if (this.path.length > 0) {
      this.moveAlongPath();
      return; // Skip normal random movement while on a scripted path
    }

    // 2. Normal movement logic (your current code)
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

  private moveAlongPath() {
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
        this.path.shift(); // Remove handled tile

        if (this.path.length === 0) {
          if (this.isReturningHome) {
            this.state = "CHASE";
            this.speed = this.defaultSpeed;
            this.color = this.defaultColor;
            this.isReturningHome = false;

            // 🌟 4. GHOST RETURNS HOME: Drop the hardcoded audio swaps.
            // Let the game shout that this ghost returned to base!
            eventBus.emit("GHOST_RETURNED_HOME", { ghostName: this.name });

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
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);
    const tolerance = this.speed * 2;
    return (
      Math.abs(this.x - centerX) <= tolerance &&
      Math.abs(this.y - centerY) <= tolerance
    );
  }

  private getNextPosition() {
    return {
      newX: this.x + this.direction.dx * this.speed,
      newY: this.y + this.direction.dy * this.speed,
    };
  }

  private snapToCenter() {
    const { centerX, centerY } = this.collision.getTileCenter(this.x, this.y);

    if (this.direction.dx != 0) this.x = centerX;
    if (this.direction.dy != 0) this.y = centerY;
  }

  private willHitWall(): boolean {
    const boundX =
      this.x + this.direction.dx * (this.speed + this.tileSize / 2);
    const boundY =
      this.y + this.direction.dy * (this.speed + this.tileSize / 2);

    const { tileX, tileY } = this.collision.getTile(boundX, boundY);

    // Check if we are currently on a path (meaning we are exiting)
    const isExiting = this.path.length > 0;

    // Pass it to the collision system!
    return this.collision.isWall(tileX, tileY, isExiting);
  }

  public getRandomDirection() {
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
      if (!this.collision.isWall(tileX, tileY)) {
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
      if (!this.collision.isWall(tileX, tileY)) {
        this.direction = dir;
        return;
      }
    }

    this.direction = { dx: 0, dy: 0 };
  }

  public reverseDirection() {
    this.direction = {
      dx: -this.direction.dx,
      dy: -this.direction.dy,
    };
  }

  private checkAndTeleport() {
    // 1. Если призрак идет по выверенному алгоритмом пути,
    // не даем ему случайно телепортироваться и сломать маршрут
    if (this.path.length > 0) return;

    const { tileX, tileY } = this.collision.getTile(this.x, this.y);

    // 2. Проверяем, не стоим ли мы на точке, куда только что телепортировались
    if (this.lastTeleportExit) {
      if (
        tileX === this.lastTeleportExit.x &&
        tileY === this.lastTeleportExit.y
      ) {
        return; // Еще не сошли с портала, игнорируем
      } else {
        this.lastTeleportExit = null; // Сошли с портала — забываем его
      }
    }

    if (this.collision.isTeleport(tileX, tileY)) {
      const exit = this.collision.getTeleportExit(tileX, tileY);
      if (exit) {
        this.x = exit.x * this.tileSize + this.tileSize / 2;
        this.y = exit.y * this.tileSize + this.tileSize / 2;

        // 3. Запоминаем новые координаты плитки, чтобы не прыгнуть назад
        this.lastTeleportExit = exit;
      }
    }
  }

  public beEaten() {
    this.state = "EATEN";
    this.speed = this.defaultSpeed * 2; // Eyes retreat quickly
    this.isReturningHome = true;

    const { tileX, tileY } = this.collision.getTile(this.x, this.y);
    const startNode = `${tileY},${tileX}`;

    // Target is the ghost's unique starting cage position
    const targetNode = `${this.spawnGridY},${this.spawnGridX}`;
    const graph = this.gameState.pathGraph;

    if (graph) {
      const foundPath = findShortestPath(graph, startNode, targetNode);
      if (foundPath) {
        this.path = foundPath;
      }
    }

    // 🌟 3. IF GHOST EATEN: Removed audio calls here.
    // Notice how this method does not need to broadcast "GHOST_EATEN"
    // because that broadcast originally initiated this call from Pacman or GameState!
  }

  // -------------------------
  // 5. Spawning
  // -------------------------
  public spawn() {
    const map = this.gameState.levelData.map;
    for (let y = 0; y < map.length; y++) {
      let x = map[y].findIndex((tile) => tile === this.name);
      if (x !== -1) {
        this.spawnGridX = x;
        this.spawnGridY = y;

        this.x = x * this.tileSize + this.tileSize / 2;
        this.y = y * this.tileSize + this.tileSize / 2;

        // 🔥 REMOVED: map[y][x] = "ES";
        // We keep the map pure so that resets can read it again!
        break;
      }
    }
  }

  public calculateExitPath() {
    const map = this.gameState.levelData.map;

    // 2. Use those preserved grid coordinates! No pixel math rounding errors.
    const startNode = `${this.spawnGridY},${this.spawnGridX}`;

    const targetNode = findLairExit(map);
    const graph = this.gameState.pathGraph;

    if (graph) {
      const foundPath = findShortestPath(graph, startNode, targetNode);

      if (foundPath) {
        console.log(`${this.name} found path: `, foundPath);
        this.path = foundPath;
      }
    } else {
      console.error(
        `Graph not found in GameState when ${this.name} tried to calculate path!`,
      );
    }
  }

  // -------------------------
  // 6. Rendering
  // -------------------------
  private getDirectionLabel(): "LEFT" | "RIGHT" | "UP" | "DOWN" {
    const { dx, dy } = this.direction;
    if (dx === 1) return "RIGHT";
    if (dx === -1) return "LEFT";
    if (dy === -1) return "UP";
    if (dy === 1) return "DOWN";
    return "RIGHT";
  }

  public draw(animate: boolean): void {
    const ctx = this.ctx;
    const s = this.tileSize;
    const left = this.x - s / 2;
    const top = this.y - s / 2;

    let currentColor = this.defaultColor;
    let shouldDrawBody = true; // Flag to toggle body rendering

    if (this.state === "FRIGHTENED") {
      if (this.isFlashing) {
        // 1. FIXED: Now actually using the modulo to swap colors
        const isWhite = Math.floor(Date.now() / this.flashSpeed) % 2 === 0;
        currentColor = isWhite ? "#FFFFFF" : "#0000FF";
      } else {
        currentColor = "#0000FF";
      }
    } else if (this.state === "EATEN") {
      // 2. FIXED: Hide the body entirely instead of painting it light cyan!
      // This matches the true arcade experience where only the eyes retreat.
      shouldDrawBody = false;
    }

    // Only draw the body shape if they are not in the EATEN state
    if (shouldDrawBody) {
      ctx.fillStyle = currentColor;
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

    // Eyes always render, handling the "floating eyes" retreat perfectly
    const dir = this.getDirectionLabel();
    this.drawEyes(left, top, s, dir);
  }

  private drawBaseShape(left: number, top: number, s: number): void {
    const centerX = left + s / 2;
    const centerY = top + s / 2;

    // Main ghost body - rounded top (semi-circle)
    this.ctx.arc(centerX, centerY, s / 2, Math.PI, 0, false);
  }

  private drawStaticBottom(left: number, top: number, s: number): void {
    const ctx = this.ctx;
    const bottomBaseY = top + s;
    const waveCount = 6;
    const segmentWidth = s / waveCount;
    const waveAmplitude = 2.5;

    // --- KEY FIX ---
    // Instead of getting the current time, we freeze time at '0'.
    // This locks the animation phase, making the waves stationary.
    const now = 0; // Frozen time!
    const animationPhase = ((now % 1000) / 1000) * Math.PI * 2;

    // The rest of this is a direct copy from animateWavyBottom:
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

  private animateWavyBottom(left: number, top: number, s: number): void {
    const ctx = this.ctx;
    const bottomBaseY = top + s;
    const waveCount = 6;
    const segmentWidth = s / waveCount;
    const waveAmplitude = 2.5;

    // Self-contained animation timing
    const now = Date.now();
    const animationPhase = ((now % 1000) / 1000) * Math.PI * 2;

    // Start from right side
    let currentX = left + s;
    let currentY = bottomBaseY + Math.sin(animationPhase * 4) * waveAmplitude;

    ctx.lineTo(currentX, currentY);

    // Create ultra-smooth waves using cubic bezier curves
    for (let i = waveCount - 1; i >= 0; i--) {
      const segmentStartX = left + (i + 1) * segmentWidth;
      const segmentEndX = left + i * segmentWidth;
      const segmentThirdX = segmentStartX - segmentWidth / 3;
      const segmentTwoThirdsX = segmentStartX - (2 * segmentWidth) / 3;

      // Calculate wave heights
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

      // Cubic bezier for ultra-smooth curves
      ctx.bezierCurveTo(
        segmentThirdX,
        thirdY, // First control point
        segmentTwoThirdsX,
        twoThirdsY, // Second control point
        segmentEndX,
        endY, // End point
      );
    }
  }

  private drawEyes(left: number, top: number, s: number, dir: string): void {
    const ctx = this.ctx;

    // Eyes with good spacing (20% from edges, 20% gap in middle)
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();

    // Left eye at 30% from left edge
    ctx.arc(left + s * 0.3, top + s / 2, s / 6, 0, Math.PI * 2);
    // Right eye at 70% from left edge (40% gap between eyes)
    ctx.arc(left + s * 0.7, top + s / 2, s / 6, 0, Math.PI * 2);

    ctx.fill();

    // Pupils - directional
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

export { Ghost };
