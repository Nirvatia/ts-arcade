// world/Dot.ts
import { eventBus } from "../core/EventBus.js";
import { WorldObject } from "./WorldObject.js";
import type { CanvasLayer } from "../render/CanvasLayer.js";
import type { LevelContext } from "../core/LevelContext.js";

export class Dot extends WorldObject {
  private dotSize: number;

  constructor(canvasLayer: CanvasLayer, levelContext: LevelContext) {
    super(canvasLayer, levelContext);
    // Hard downscale factor so the points occupy minimal spatial footprint
    this.dotSize = this.tileSize * 0.15; 
    this.initEventListeners();
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
    const radius = this.dotSize * 0.5;

    ctx.clearRect(0, 0, this.layer.canvas.width, this.layer.canvas.height);
    ctx.save();

    this.gameState.activeDots.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4); // Points tips directly into empty corridor corners

      // ── NO SHADOW BLURS ── NO GRADIENTS ── NO BACKGROUND FOG ──

      // 1. Crisp, opaque lavender starburst silhouette
      ctx.fillStyle = "#b59eef"; 
      ctx.beginPath();
      ctx.moveTo(0, -radius * 1.3);
      ctx.quadraticCurveTo(0, 0, radius * 1.3, 0);
      ctx.quadraticCurveTo(0, 0, 0, radius * 1.3);
      ctx.quadraticCurveTo(0, 0, -radius * 1.3, 0);
      ctx.quadraticCurveTo(0, 0, 0, -radius * 1.3);
      ctx.closePath();
      ctx.fill();

      // 2. Clear, high-contrast flat white center point
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();
    this.needsRedraw = false;
  }
}