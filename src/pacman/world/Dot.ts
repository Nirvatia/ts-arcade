// world/Dot.ts
import { eventBus } from "../core/EventBus.js";
import { WorldObject } from "./WorldObject.js";
import type { LevelContext } from "../core/LevelContext.js";
import type { CanvasLayer } from "../render/CanvasLayer.js";

export class Dot extends WorldObject {
  private dotSize: number;

  constructor(canvasLayer: CanvasLayer, levelContext: LevelContext) {
    super(canvasLayer, levelContext);
    this.dotSize = this.tileSize * 0.22;
    this.initEventListeners();
  }

  private seed(i: number, j: number): number {
    return Math.abs(Math.sin(i * 127.1 + j * 311.7) * 43758.5453) % 1;
  }

  private initEventListeners(): void {
    eventBus.on("dot:eaten", (payload) => {
      if (payload?.position) {
        this.eraseDotAt(payload.position.i, payload.position.j);
      } else {
        this.requestRedraw();
      }
    });
  }

  public spawn(): void {
    this.requestRedraw();
  }

  private eraseDotAt(row: number, col: number): void {
    const ctx = this.layer.ctx;
    const ts = this.tileSize;
    ctx.clearRect(col * ts, row * ts, ts, ts);
  }

  public draw(): void {
    if (!this.needsRedraw) return;

    const ctx = this.layer.ctx;
    const ts = this.tileSize;
    const sz = this.dotSize * 0.5;

    ctx.clearRect(0, 0, this.layer.canvas.width, this.layer.canvas.height);
    ctx.save();

    this.gameState.activeDots.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;
      const s = this.seed(i, j);

      const size = sz * (0.8 + s * 0.4);
      const rot = s * Math.PI * 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      // Soft violet glow
      ctx.shadowColor = "rgba(150, 120, 220, 0.55)";
      ctx.shadowBlur = 4;

      // Diamond body
      ctx.fillStyle = "rgba(190, 165, 240, 0.8)";
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.5, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.5, 0);
      ctx.closePath();
      ctx.fill();

      // Bright white core
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();
    this.needsRedraw = false;
  }
}
