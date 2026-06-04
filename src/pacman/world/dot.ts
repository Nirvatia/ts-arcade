// src/entities/dot.ts
import { CFG_CANVAS } from "../config/canvas.js";
import { eventBus } from "../core/eventBus.js";
import type { Collectible } from "../interfaces.js";
import { WorldObject } from "./worldObject.js";

export class Dot extends WorldObject implements Collectible {
  private dotSize: number;
  public positions: Set<string> = new Set<string>();

  constructor() {
    super(CFG_CANVAS.canvasIds.dots);
    this.dotSize = this.tileSize * 0.16; // Marginally increased for vector tracking lines
    this.initEventListeners();
  }

  private initEventListeners(): void {
    eventBus.on(
      "dot:collect",
      (data: { position: { i: number; j: number } }) => {
        this.collect(data.position.i, data.position.j);
      },
    );
  }

  spawn(): void {
    this.positions.clear();
    this.clearCanvas();

    const map = this.gameState.levelData.map;
    let cnt = 0;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (map[i][j] === "FD") {
          this.positions.add(`${i},${j}`);
          cnt++;
        }
      }
    }

    this.needsRedraw = true;
    eventBus.emit("dot:spawned", { count: cnt });
  }

  collect(i: number, j: number): void {
    this.positions.delete(`${i},${j}`);
    this.clearCanvas(
      j * this.tileSize - 2,
      i * this.tileSize - 2,
      this.tileSize + 4,
      this.tileSize + 4,
    );
    eventBus.emit("dot:eaten", {
      position: { i, j },
      dotsRemaining: this.positions.size,
    });
  }

  override reset(): void {
    super.reset();
    this.positions.clear();
  }

  draw(): void {
    this.clearCanvas();
    const ctx = this.ctx;
    const ts = this.tileSize;

    ctx.save();
    // Using screen composition so overlapping neon vectors blend cleanly
    ctx.globalCompositeOperation = "screen";

    this.positions.forEach((pos) => {
      const [i, j] = pos.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;
      const r = this.dotSize * 0.5;

      ctx.save();
      ctx.translate(cx, cy);

      // --- PASS 1: TRON GRID GLOW MATRIX ---
      ctx.shadowColor = "rgba(0, 180, 255, 0.85)";
      ctx.shadowBlur = 4;
      ctx.strokeStyle = "rgba(0, 210, 255, 0.65)";
      ctx.lineWidth = 1.0;

      // Draw horizontal and vertical tracking crosses
      ctx.beginPath();
      ctx.moveTo(-r * 1.5, 0);
      ctx.lineTo(r * 1.5, 0);
      ctx.moveTo(0, -r * 1.5);
      ctx.lineTo(0, r * 1.5);
      ctx.stroke();

      // --- PASS 2: COMPRESSED DATA CORE ---
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 2;
      ctx.fillRect(-r * 0.5, -r * 0.5, r, r);

      ctx.restore();
    });

    ctx.restore();
  }
}