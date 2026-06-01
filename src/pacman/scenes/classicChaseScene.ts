// src/game/scenes/classicChaseScene.ts
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
      glowColor: "rgba(0, 255, 255, 0.8)",
    };
    this.blinky = {
      x: 0,
      y: 0,
      angle: 0,
      currentPathIndex: 0,
      path: [],
      history: [],
      speed: 340,
      color: "#ff0055",
      glowColor: "rgba(255, 0, 85, 0.8)",
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

    if (this.simState !== "CHASE") {
      this.fxRadius += 450 * dt;
      this.fxAlpha = Math.max(0, this.fxAlpha - 1.8 * dt);

      if (this.elapsedTime >= this.duration || this.fxAlpha <= 0) {
        this.wrapUpScene();
      }
      return;
    }

    this.advancePacman(dt);
    this.advanceBlinkyHunt(dt);

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
      if (this.pacman.history.length > 150) this.pacman.history.shift();
    } else {
      this.pacman.angle = Math.atan2(dy, dx);
      this.pacman.x += (dx / dist) * step;
      this.pacman.y += (dy / dist) * step;
    }
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
      if (this.blinky.history.length > 150) this.blinky.history.shift();

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
    }
  }

  private wrapUpScene(): void {
    this.layer.clear();
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
      this.onCompleteCallback = null;
    }
  }

  /** Renders Pacman as an advanced Sector-Disk Glider with an oscillating aperture jaw */
  private drawPacmanArt(
    ctx: CanvasRenderingContext2D,
    actor: VectorActor,
  ): void {
    ctx.save();
    ctx.translate(actor.x, actor.y);
    ctx.rotate(actor.angle);

    ctx.shadowBlur = 15;
    ctx.shadowColor = actor.color;
    ctx.strokeStyle = actor.color;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#01040a";

    // Modulate the wedge arc aperture sweep angle smoothly over time
    const mouthAngle = (Math.sin(this.animTime * 24) + 1) * 0.22 + 0.05;

    // Draw main sector hull shell
    ctx.beginPath();
    ctx.arc(0, 0, 11, mouthAngle, Math.PI * 2 - mouthAngle, false);
    ctx.lineTo(2, 0); // Connect back to core root anchor
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Internal power core design asset
    ctx.fillStyle = actor.color;
    ctx.beginPath();
    ctx.arc(-2, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
  }

  /** Renders Blinky as an aerodynamic tracking interceptor with iconic mechanical ghost elements */
  private drawBlinkyArt(
    ctx: CanvasRenderingContext2D,
    actor: VectorActor,
  ): void {
    ctx.save();
    ctx.translate(actor.x, actor.y);
    ctx.rotate(actor.angle);

    ctx.shadowBlur = 15;
    ctx.shadowColor = actor.color;
    ctx.strokeStyle = actor.color;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#01040a";

    // Animated dual exhaust flames
    const flameFlicker = Math.sin(this.animTime * 50);
    ctx.fillStyle = actor.glowColor;
    ctx.beginPath();
    ctx.fillRect(-12, -5, -4 + flameFlicker * 3, 2);
    ctx.fillRect(-12, 3, -4 - flameFlicker * 3, 2);

    // Draw customized aggressive ghost crown hull plating
    ctx.fillStyle = "#01040a";
    ctx.beginPath();
    ctx.moveTo(12, 0); // Prow nose tip
    ctx.lineTo(-2, -8); // Left sweeping flank
    ctx.lineTo(-10, -8); // Left engine pod mount
    ctx.lineTo(-7, -3); // Left skirt notch
    ctx.lineTo(-10, 0); // Center skirt point
    ctx.lineTo(-7, 3); // Right skirt notch
    ctx.lineTo(-10, 8); // Right engine pod mount
    ctx.lineTo(-2, 8); // Right sweeping flank
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tactical Visor Array Panel
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.lineTo(7, -2);
    ctx.lineTo(7, 2);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(5, -1.5, 2, 3);

    ctx.restore();
    ctx.shadowBlur = 0;
  }

  private drawLightTrail(
    ctx: CanvasRenderingContext2D,
    actor: VectorActor,
  ): void {
    if (actor.history.length === 0) return;
    ctx.save();
    ctx.lineWidth = 4.5;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.strokeStyle = actor.glowColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = actor.color;

    ctx.beginPath();
    ctx.moveTo(actor.history[0].x, actor.history[0].y);
    for (let i = 1; i < actor.history.length; i++) {
      ctx.lineTo(actor.history[i].x, actor.history[i].y);
    }
    ctx.lineTo(actor.x, actor.y);
    ctx.stroke();
    ctx.restore();
  }

  private renderFXLayer(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
  ): void {
    ctx.save();
    if (this.simState === "PACMAN_CAUGHT") {
      ctx.strokeStyle = `rgba(255, 0, 85, ${this.fxAlpha})`;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#ff0055";
      ctx.beginPath();
      ctx.arc(centerX, centerY, this.fxRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1;
      ctx.strokeRect(
        centerX - this.fxRadius,
        centerY - this.fxRadius,
        this.fxRadius * 2,
        this.fxRadius * 2,
      );
    } else if (this.simState === "PACMAN_ESCAPED") {
      ctx.strokeStyle = `rgba(0, 255, 243, ${this.fxAlpha})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#00f3ff";
      ctx.beginPath();
      ctx.arc(centerX, centerY, this.fxRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${this.fxAlpha * 0.5})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((i * Math.PI) / 4 + this.animTime);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.fxRadius * 1.2, 0);
        ctx.stroke();
        ctx.restore();
      }
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

    const bgGrad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      50,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.6,
    );
    bgGrad.addColorStop(0, "#050d22");
    bgGrad.addColorStop(1, "#010408");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0, 170, 255, 0.03)";
    ctx.lineWidth = 1.0;
    for (let x = 0; x < w; x += this.tileSize) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += this.tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0, 170, 255, 0.3)";
    ctx.lineWidth = 2;
    const bounds = {
      x1: offsetX - 10,
      y1: offsetY - 10,
      x2: offsetX + this.cols * this.tileSize + 10,
      y2: offsetY + this.rows * this.tileSize + 10,
    };
    ctx.beginPath();
    ctx.moveTo(bounds.x1, bounds.y1 + 15);
    ctx.lineTo(bounds.x1, bounds.y1);
    ctx.lineTo(bounds.x1 + 15, bounds.y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bounds.x2, bounds.y1 + 15);
    ctx.lineTo(bounds.x2, bounds.y1);
    ctx.lineTo(bounds.x2 - 15, bounds.y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bounds.x1, bounds.y2 - 15);
    ctx.lineTo(bounds.x1, bounds.y2);
    ctx.lineTo(bounds.x1 + 15, bounds.y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bounds.x2, bounds.y2 - 15);
    ctx.lineTo(bounds.x2, bounds.y2);
    ctx.lineTo(bounds.x2 - 15, bounds.y2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0, 160, 255, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(0, 100, 255, 0.4)";

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.mapData[r][c] === "0") {
          const tx = offsetX + c * this.tileSize;
          const ty = offsetY + r * this.tileSize;

          const upWall = r > 0 && this.mapData[r - 1][c] === "1";
          const rightWall = c < this.cols - 1 && this.mapData[r][c + 1] === "1";
          const downWall = r < this.rows - 1 && this.mapData[r + 1][c] === "1";
          const leftWall = c > 0 && this.mapData[r][c - 1] === "1";

          ctx.beginPath();
          if (upWall) {
            ctx.moveTo(tx + 0.5, ty + 0.5);
            ctx.lineTo(tx + this.tileSize + 0.5, ty + 0.5);
          }
          if (rightWall) {
            ctx.moveTo(tx + this.tileSize + 0.5, ty + 0.5);
            ctx.lineTo(tx + this.tileSize + 0.5, ty + this.tileSize + 0.5);
          }
          if (downWall) {
            ctx.moveTo(tx + 0.5, ty + this.tileSize + 0.5);
            ctx.lineTo(tx + this.tileSize + 0.5, ty + this.tileSize + 0.5);
          }
          if (leftWall) {
            ctx.moveTo(tx + 0.5, ty + 0.5);
            ctx.lineTo(tx + 0.5, ty + this.tileSize + 0.5);
          }
          ctx.stroke();
        }
      }
    }
    ctx.shadowBlur = 0;

    // --- LINEAR LIGHT PATHS ---
    this.drawLightTrail(ctx, this.pacman);
    this.drawLightTrail(ctx, this.blinky);

    // --- TERMINAL NEXUS CORE ---
    const exitCoord = this.getAbsoluteCoords(this.exitNode.r, this.exitNode.c);
    ctx.save();
    ctx.translate(exitCoord.x, exitCoord.y);
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffffff";

    ctx.save();
    ctx.strokeStyle = "rgba(0, 255, 243, 0.8)";
    ctx.rotate(this.animTime * 1.2);
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.rotate(-this.animTime * 2.0);
    ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.restore();

    // --- GRAPHICS ROUTINES ---
    if (this.simState === "CHASE") {
      this.drawPacmanArt(ctx, this.pacman);
      this.drawBlinkyArt(ctx, this.blinky);
    } else if (this.simState === "PACMAN_CAUGHT") {
      this.renderFXLayer(ctx, this.pacman.x, this.pacman.y);
    } else if (this.simState === "PACMAN_ESCAPED") {
      this.renderFXLayer(ctx, exitCoord.x, exitCoord.y);
    }

    // --- INTERFACE HUD DISPLAY ---
    ctx.fillStyle = "rgba(0, 243, 255, 0.4)";
    ctx.font = `18px ${this.fontStyle}`;
    ctx.textBaseline = "top";

    if (this.simState === "CHASE") {
      ctx.textAlign = "left";
      ctx.fillText(
        `// STATUS: AI_HUNT_SEQUENCE_ENGAGED`,
        offsetX,
        offsetY - 35,
      );
      ctx.textAlign = "right";
      ctx.fillText(
        `THREAT_PROXIMITY: ACTIVE`,
        offsetX + this.cols * this.tileSize,
        offsetY - 35,
      );
    } else if (this.simState === "PACMAN_CAUGHT") {
      ctx.fillStyle = "rgba(255, 0, 85, 0.8)";
      ctx.textAlign = "center";
      ctx.fillText(
        `!! SYSTEM CRITICAL: PROGRAM COLLISION INTERCEPT DETECTED !!`,
        w / 2,
        offsetY - 35,
      );
    } else if (this.simState === "PACMAN_ESCAPED") {
      ctx.fillStyle = "rgba(0, 255, 250, 0.8)";
      ctx.textAlign = "center";
      ctx.fillText(
        `>> ACCESS GRANTED: CORE DATA EXTRACTION COMPILED SUCCESS <<`,
        w / 2,
        offsetY - 35,
      );
    }
  }

  public clear(): void {
    this.layer.clear();
  }
}
