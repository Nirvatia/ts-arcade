import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import type { IGameScene } from "../interfaces.js";

interface Point {
  r: number;
  c: number;
}

interface VectorActor {
  x: number;
  y: number;
  angle: number;
  currentPathIndex: number;
  path: Point[];
  history: { x: number; y: number }[];
  speed: number;
  color: string;
  glowColor: string;
}

type SimulationState = "CHASE" | "PACMAN_ESCAPED" | "PACMAN_CAUGHT";

export class ClassicChaseScene implements IGameScene {
  public readonly id = "classic_chase";
  private layer: CanvasLayer;
  private fontStyle: string;

  private duration: number = 0;
  private elapsedTime: number = 0;
  private animTime: number = 0;
  private onCompleteCallback: (() => void) | null = null;

  private readonly rows = 21;
  private readonly cols = 25;
  private readonly tileSize = CFG_CANVAS.tile.size;

  private mapData: string[][] = [];

  private readonly startPacman: Point = { r: 1, c: 1 };
  private readonly startBlinky: Point = { r: 19, c: 23 };
  private readonly exitNode: Point = { r: 9, c: 13 };

  private pacman!: VectorActor;
  private blinky!: VectorActor;

  private simState: SimulationState = "CHASE";
  private fxRadius: number = 0;
  private fxAlpha: number = 1.0;

  constructor() {
    this.layer = new CanvasLayer(CFG_CANVAS.canvasIds.scene);
    this.fontStyle = "Jersey-Regular";
    this.generateDenseLabyrinth();
    this.initEntities();
  }

  private generateDenseLabyrinth(): void {
    this.mapData = Array.from({ length: this.rows }, () =>
      Array(this.cols).fill("1"),
    );
    const stack: Point[] = [];
    const startCell = { r: 1, c: 1 };
    this.mapData[startCell.r][startCell.c] = "0";
    stack.push(startCell);

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors: { next: Point; wall: Point }[] = [];
      const directions = [
        { dr: -2, dc: 0 },
        { dr: 0, dc: 2 },
        { dr: 2, dc: 0 },
        { dr: 0, dc: -2 },
      ];

      for (const d of directions) {
        const nr = current.r + d.dr;
        const nc = current.c + d.dc;
        if (nr > 0 && nr < this.rows - 1 && nc > 0 && nc < this.cols - 1) {
          if (this.mapData[nr][nc] === "1") {
            neighbors.push({
              next: { r: nr, c: nc },
              wall: { r: current.r + d.dr / 2, c: current.c + d.dc / 2 },
            });
          }
        }
      }

      if (neighbors.length > 0) {
        const choice = neighbors[Math.floor(Math.random() * neighbors.length)];
        this.mapData[choice.wall.r][choice.wall.c] = "0";
        this.mapData[choice.next.r][choice.next.c] = "0";
        stack.push(choice.next);
      } else {
        stack.pop();
      }
    }

    this.mapData[this.startPacman.r][this.startPacman.c] = "0";
    this.mapData[this.startBlinky.r][this.startBlinky.c] = "0";
    this.mapData[this.exitNode.r][this.exitNode.c] = "0";

    this.mapData[this.exitNode.r - 1][this.exitNode.c] = "0";
    this.mapData[this.exitNode.r + 1][this.exitNode.c] = "0";
    this.mapData[this.exitNode.r][this.exitNode.c - 1] = "0";
    this.mapData[this.exitNode.r][this.exitNode.c + 1] = "0";
  }

  private initEntities(): void {
    this.pacman = {
      x: 0,
      y: 0,
      angle: 0,
      currentPathIndex: 0,
      path: [],
      history: [],
      speed: 310,
      color: "#00ffff",
      glowColor: "rgba(0, 255, 255, 0.25)",
    };
    this.blinky = {
      x: 0,
      y: 0,
      angle: 0,
      currentPathIndex: 0,
      path: [],
      history: [],
      speed: 340,
      color: "#ff5500",
      glowColor: "rgba(255, 85, 0, 0.25)",
    };
  }

  private computeDijkstra(start: Point, end: Point): Point[] {
    const queue: Point[] = [start];
    const visited = Array.from({ length: this.rows }, () =>
      Array(this.cols).fill(false),
    );
    const parentMap: { [key: string]: string } = {};

    visited[start.r][start.c] = true;
    const dirs = [
      { r: -1, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 0 },
      { r: 0, c: -1 },
    ];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.r === end.r && curr.c === end.c) {
        const path: Point[] = [];
        let traceKey = `${end.r},${end.c}`;
        while (traceKey) {
          const [r, c] = traceKey.split(",").map(Number);
          path.unshift({ r, c });
          traceKey = parentMap[traceKey];
        }
        return path;
      }

      for (const d of dirs) {
        const nr = curr.r + d.r;
        const nc = curr.c + d.c;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          if (this.mapData[nr][nc] === "0" && !visited[nr][nc]) {
            visited[nr][nc] = true;
            parentMap[`${nr},${nc}`] = `${curr.r},${curr.c}`;
            queue.push({ r: nr, c: nc });
          }
        }
      }
    }
    return [];
  }

  private getAbsoluteCoords(r: number, c: number): { x: number; y: number } {
    const offsetX = (this.layer.canvas.width - this.cols * this.tileSize) / 2;
    const offsetY = (this.layer.canvas.height - this.rows * this.tileSize) / 2;
    return {
      x: Math.floor(offsetX + c * this.tileSize + this.tileSize / 2),
      y: Math.floor(offsetY + r * this.tileSize + this.tileSize / 2),
    };
  }

  private getGridPosition(x: number, y: number): Point {
    const offsetX = (this.layer.canvas.width - this.cols * this.tileSize) / 2;
    const offsetY = (this.layer.canvas.height - this.rows * this.tileSize) / 2;
    const c = Math.floor((x - offsetX) / this.tileSize);
    const r = Math.floor((y - offsetY) / this.tileSize);
    return {
      r: Math.max(0, Math.min(this.rows - 1, r)),
      c: Math.max(0, Math.min(this.cols - 1, c)),
    };
  }

  public start(durationInSeconds: number, onComplete: () => void): void {
    this.onCompleteCallback = onComplete;
    this.duration = durationInSeconds;
    this.elapsedTime = 0;
    this.animTime = 0;
    this.simState = "CHASE";
    this.fxRadius = 0;
    this.fxAlpha = 1.0;

    this.layer.resize();
    this.generateDenseLabyrinth();
    this.initEntities();

    this.pacman.path = this.computeDijkstra(this.startPacman, this.exitNode);
    const pStart = this.getAbsoluteCoords(
      this.pacman.path[0].r,
      this.pacman.path[0].c,
    );
    this.pacman.x = pStart.x;
    this.pacman.y = pStart.y;
    this.pacman.history = [{ x: this.pacman.x, y: this.pacman.y }];

    this.blinky.path = this.computeDijkstra(this.startBlinky, this.startPacman);
    const bStart = this.getAbsoluteCoords(
      this.blinky.path[0].r,
      this.blinky.path[0].c,
    );
    this.blinky.x = bStart.x;
    this.blinky.y = bStart.y;
    this.blinky.history = [{ x: this.blinky.x, y: this.blinky.y }];
  }

  public update(dt: number): void {
    if (this.duration <= 0) return;
    this.elapsedTime += dt;
    this.animTime += dt;

    // --- 1. POST-CHASE RECONSTRUCTION VISUAL PHASE ---
    if (this.simState !== "CHASE") {
      this.fxRadius += 550 * dt;
      this.fxAlpha = Math.max(0, this.fxAlpha - 1.6 * dt);

      // FIX: Only wrap up the scene when the Director's allocated intermission clock completely runs out
      if (this.elapsedTime >= this.duration) {
        this.wrapUpScene();
      }
      return;
    }

    // --- 2. RUN ACTOR SIMULATION Ticks ---
    this.advancePacman(dt);
    this.advanceBlinkyHunt(dt);

    // --- 3. STATE MATCHING CALCULATIONS ---
    const distanceBetweenCrafts = Math.hypot(
      this.pacman.x - this.blinky.x,
      this.pacman.y - this.blinky.y,
    );
    if (distanceBetweenCrafts < this.tileSize * 0.7) {
      this.simState = "PACMAN_CAUGHT";
    }

    const pacmanGridLoc = this.getGridPosition(this.pacman.x, this.pacman.y);
    if (
      pacmanGridLoc.r === this.exitNode.r &&
      pacmanGridLoc.c === this.exitNode.c
    ) {
      this.simState = "PACMAN_ESCAPED";
    }

    // --- 4. GLOBAL TIMEOUT FALLBACK ---
    if (this.elapsedTime >= this.duration) {
      this.wrapUpScene();
    }
  }

  private advancePacman(dt: number): void {
    if (
      this.pacman.path.length === 0 ||
      this.pacman.currentPathIndex >= this.pacman.path.length - 1
    )
      return;

    const nextNode = this.pacman.path[this.pacman.currentPathIndex + 1];
    const target = this.getAbsoluteCoords(nextNode.r, nextNode.c);

    const dx = target.x - this.pacman.x;
    const dy = target.y - this.pacman.y;
    const dist = Math.hypot(dx, dy);
    const step = this.pacman.speed * dt;

    if (dist <= step) {
      this.pacman.x = target.x;
      this.pacman.y = target.y;
      this.pacman.currentPathIndex++;
      this.pacman.history.push({ x: this.pacman.x, y: this.pacman.y });
    } else {
      this.pacman.angle = Math.atan2(dy, dx);
      this.pacman.x += (dx / dist) * step;
      this.pacman.y += (dy / dist) * step;

      const lastPoint = this.pacman.history[this.pacman.history.length - 1];
      if (
        !lastPoint ||
        Math.hypot(this.pacman.x - lastPoint.x, this.pacman.y - lastPoint.y) > 6
      ) {
        this.pacman.history.push({ x: this.pacman.x, y: this.pacman.y });
      }
    }
    if (this.pacman.history.length > 30) this.pacman.history.shift();
  }

  private advanceBlinkyHunt(dt: number): void {
    if (this.blinky.path.length === 0) return;

    if (this.blinky.currentPathIndex >= this.blinky.path.length - 1) {
      const bGrid = this.getGridPosition(this.blinky.x, this.blinky.y);
      const pGrid = this.getGridPosition(this.pacman.x, this.pacman.y);
      const freshPath = this.computeDijkstra(bGrid, pGrid);
      if (freshPath.length > 1) {
        this.blinky.path = freshPath;
        this.blinky.currentPathIndex = 0;
      } else {
        return;
      }
    }

    const nextNode = this.blinky.path[this.blinky.currentPathIndex + 1];
    const target = this.getAbsoluteCoords(nextNode.r, nextNode.c);

    const dx = target.x - this.blinky.x;
    const dy = target.y - this.blinky.y;
    const dist = Math.hypot(dx, dy);
    const step = this.blinky.speed * dt;

    if (dist <= step) {
      this.blinky.x = target.x;
      this.blinky.y = target.y;
      this.blinky.currentPathIndex++;
      this.blinky.history.push({ x: this.blinky.x, y: this.blinky.y });

      const currentGridPos = this.getGridPosition(this.blinky.x, this.blinky.y);
      const pacmanGridPos = this.getGridPosition(this.pacman.x, this.pacman.y);

      const dynamicPath = this.computeDijkstra(currentGridPos, pacmanGridPos);
      if (dynamicPath.length > 1) {
        this.blinky.path = dynamicPath;
        this.blinky.currentPathIndex = 0;
      }
    } else {
      this.blinky.angle = Math.atan2(dy, dx);
      this.blinky.x += (dx / dist) * step;
      this.blinky.y += (dy / dist) * step;

      const lastPoint = this.blinky.history[this.blinky.history.length - 1];
      if (
        !lastPoint ||
        Math.hypot(this.blinky.x - lastPoint.x, this.blinky.y - lastPoint.y) > 6
      ) {
        this.blinky.history.push({ x: this.blinky.x, y: this.blinky.y });
      }
    }
    if (this.blinky.history.length > 30) this.blinky.history.shift();
  }

  private wrapUpScene(): void {
    this.layer.clear();
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
      this.onCompleteCallback = null;
    }
  }

  private drawPacmanArt(
    ctx: CanvasRenderingContext2D,
    actor: VectorActor,
  ): void {
    ctx.save();
    ctx.translate(actor.x, actor.y);
    ctx.rotate(actor.angle);

    ctx.shadowBlur = 8;
    ctx.shadowColor = actor.color;
    ctx.strokeStyle = actor.color;
    ctx.lineWidth = 2;
    ctx.fillStyle = "#020914";

    const mouthAngle = (Math.sin(this.animTime * 24) + 1) * 0.2 + 0.05;

    ctx.beginPath();
    ctx.arc(0, 0, 9, mouthAngle, Math.PI * 2 - mouthAngle, false);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawBlinkyArt(
    ctx: CanvasRenderingContext2D,
    actor: VectorActor,
  ): void {
    ctx.save();
    ctx.translate(actor.x, actor.y);
    ctx.rotate(actor.angle);

    ctx.shadowBlur = 8;
    ctx.shadowColor = actor.color;
    ctx.strokeStyle = actor.color;
    ctx.lineWidth = 2;
    ctx.fillStyle = "#020914";

    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-4, -9);
    ctx.lineTo(-11, -5);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-11, 5);
    ctx.lineTo(-4, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-2, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawLightTrail(
    ctx: CanvasRenderingContext2D,
    actor: VectorActor,
  ): void {
    if (actor.history.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const head = { x: actor.x, y: actor.y };
    const tail = actor.history[0];

    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.3, actor.glowColor);
    grad.addColorStop(1, actor.color);

    const coreGrad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    coreGrad.addColorStop(0, "rgba(0,0,0,0)");
    coreGrad.addColorStop(0.5, "rgba(255,255,255,0.3)");
    coreGrad.addColorStop(1, "rgba(255,255,255,0.9)");

    ctx.beginPath();
    ctx.moveTo(actor.history[0].x, actor.history[0].y);
    for (let i = 1; i < actor.history.length; i++) {
      ctx.lineTo(actor.history[i].x, actor.history[i].y);
    }
    ctx.lineTo(actor.x, actor.y);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  private renderFXLayer(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    canvasW: number,
    canvasH: number,
  ): void {
    ctx.save();
    const pulseFade = Math.max(0, this.fxAlpha);
    ctx.globalAlpha = pulseFade;

    if (this.simState === "PACMAN_CAUGHT") {
      ctx.strokeStyle = "#ff3300";
      ctx.shadowColor = "#ff3300";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;

      ctx.strokeRect(
        centerX - this.fxRadius,
        centerY - this.fxRadius,
        this.fxRadius * 2,
        this.fxRadius * 2,
      );
      ctx.strokeRect(
        centerX - this.fxRadius * 0.4,
        centerY - this.fxRadius * 0.4,
        this.fxRadius * 0.8,
        this.fxRadius * 0.8,
      );
    } else if (this.simState === "PACMAN_ESCAPED") {
      ctx.strokeStyle = "rgba(0, 240, 255, " + pulseFade * 0.8 + ")";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvasW, centerY);
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, canvasH);
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        centerX - this.fxRadius * 0.5,
        centerY - this.fxRadius * 0.5,
        this.fxRadius,
        this.fxRadius,
      );

      ctx.strokeStyle = "#00f0ff";
      ctx.strokeRect(
        centerX - this.fxRadius * 0.9,
        centerY - this.fxRadius * 0.9,
        this.fxRadius * 1.8,
        this.fxRadius * 1.8,
      );

      ctx.fillStyle = "#00f0ff";
      ctx.font = "14px monospace";
      const sizeOffset = this.fxRadius * 0.7;
      ctx.fillText("1", centerX + sizeOffset, centerY + sizeOffset);
      ctx.fillText("0", centerX - sizeOffset, centerY - sizeOffset);
      ctx.fillText("0", centerX + sizeOffset, centerY - sizeOffset);
      ctx.fillText("1", centerX - sizeOffset, centerY + sizeOffset);
    }
    ctx.restore();
  }

  public draw(): void {
    this.layer.clear();
    const ctx = this.layer.ctx;
    const w = this.layer.canvas.width;
    const h = this.layer.canvas.height;

    const offsetX = Math.floor((w - this.cols * this.tileSize) / 2);
    const offsetY = Math.floor((h - this.rows * this.tileSize) / 2);

    ctx.fillStyle = "#000207";
    ctx.fillRect(0, 0, w, h);

    // --- 1. VISIBLE TRON BACKGROUND GRID ---
    ctx.save();
    ctx.strokeStyle = "rgba(0, 160, 255, 0.12)"; // Increased visibility
    ctx.lineWidth = 1.0;

    for (
      let x = offsetX;
      x <= offsetX + this.cols * this.tileSize;
      x += this.tileSize
    ) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, offsetY);
      ctx.lineTo(x + 0.5, offsetY + this.rows * this.tileSize);
      ctx.stroke();
    }
    for (
      let y = offsetY;
      y <= offsetY + this.rows * this.tileSize;
      y += this.tileSize
    ) {
      ctx.beginPath();
      ctx.moveTo(offsetX, y + 0.5);
      ctx.lineTo(offsetX + this.cols * this.tileSize, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    // --- 2. SINGLE-PASS NON-OVERLAPPING VECTOR MAZE CONDUITS ---
    ctx.save();
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";

    ctx.beginPath(); // Gather all layout paths cleanly before running stroke() memory mechanics
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.mapData[r][c] === "0") {
          const tx = offsetX + c * this.tileSize;
          const ty = offsetY + r * this.tileSize;

          const upWall = r > 0 && this.mapData[r - 1][c] === "1";
          const rightWall = c < this.cols - 1 && this.mapData[r][c + 1] === "1";
          const downWall = r < this.rows - 1 && this.mapData[r + 1][c] === "1";
          const leftWall = c > 0 && this.mapData[r][c - 1] === "1";

          if (upWall) {
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + this.tileSize, ty);
          }
          if (rightWall) {
            ctx.moveTo(tx + this.tileSize, ty);
            ctx.lineTo(tx + this.tileSize, ty + this.tileSize);
          }
          if (downWall) {
            ctx.moveTo(tx, ty + this.tileSize);
            ctx.lineTo(tx + this.tileSize, ty + this.tileSize);
          }
          if (leftWall) {
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx, ty + this.tileSize);
          }
        }
      }
    }

    // Single-Pass Neon Glow Environment Ring (Lowered global alpha to 0.3 for transparency balance)
    ctx.strokeStyle = "rgba(0, 210, 255, 0.3)";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#00bfff";
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Single-Pass Electric White Center Core Filament
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();

    // --- 3. FOREGROUND RENDER LINES ---
    this.drawLightTrail(ctx, this.pacman);
    this.drawLightTrail(ctx, this.blinky);

    const exitCoord = this.getAbsoluteCoords(this.exitNode.r, this.exitNode.c);

    ctx.save();
    ctx.translate(exitCoord.x, exitCoord.y);
    ctx.strokeStyle = "#00ffea";
    ctx.shadowColor = "#00ffea";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.5;
    ctx.rotate(this.animTime * 1.5);
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();

    if (this.simState === "CHASE") {
      this.drawPacmanArt(ctx, this.pacman);
      this.drawBlinkyArt(ctx, this.blinky);
    } else {
      this.renderFXLayer(
        ctx,
        this.simState === "PACMAN_CAUGHT" ? this.pacman.x : exitCoord.x,
        this.simState === "PACMAN_CAUGHT" ? this.pacman.y : exitCoord.y,
        w,
        h,
      );
    }

    // --- TELEMETRY DATA HUDS ---
    ctx.fillStyle = "rgba(0, 210, 255, 0.45)";
    ctx.font = `17px ${this.fontStyle}`;
    ctx.textBaseline = "top";

    if (this.simState === "CHASE") {
      ctx.textAlign = "left";
      ctx.fillText(`// I/O_PORT_TRACE: RUNNING`, offsetX, offsetY - 35);
      ctx.textAlign = "right";
      ctx.fillText(
        `GRID_SEGMENT: 0x4F9B`,
        offsetX + this.cols * this.tileSize,
        offsetY - 35,
      );
    } else if (this.simState === "PACMAN_CAUGHT") {
      ctx.fillStyle = "rgba(255, 45, 0, 0.85)";
      ctx.textAlign = "center";
      ctx.fillText(
        `>> CORE_ERR: SOCKET_CLOSED_BY_INTERCEPTOR <<`,
        w / 2,
        offsetY - 35,
      );
    } else if (this.simState === "PACMAN_ESCAPED") {
      ctx.fillStyle = "#00ffd5";
      ctx.textAlign = "center";
      ctx.fillText(
        `>> DE_RES_COMPLETE: OVERRIDE_VECTOR_LOADED <<`,
        w / 2,
        offsetY - 35,
      );
    }
  }

  public clear(): void {
    this.layer.clear();
  }
}
