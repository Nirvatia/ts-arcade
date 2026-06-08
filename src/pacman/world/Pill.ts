// world/Pill.ts
import { eventBus } from "../core/EventBus.js";
import { WorldObject } from "./WorldObject.js";
import type { LevelContext } from "../core/LevelContext.js";
import type { IUpdatable } from "../shared/types.js";
import type { CanvasLayer } from "../render/CanvasLayer.js";

export class Pill extends WorldObject implements IUpdatable {
  private time = 0;

  constructor(canvasLayer: CanvasLayer, levelContext: LevelContext) {
    super(canvasLayer, levelContext);
    this.initEventListeners();
  }

  private initEventListeners(): void {
    eventBus.on("power_pill:eaten", () => this.requestRedraw());
  }

  public spawn(): void {
    this.requestRedraw();
  }

  public update(dt: number): void {
    if (this.gameState.mode !== "PLAYING") return;
    this.time += dt;
    this.needsRedraw = true;
  }

  public draw(): void {
    const ctx = this.layer.ctx;
    const ts = this.tileSize;
    const maxR = ts * 0.52;

    ctx.save();
    this.gameState.activePills.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;

      ctx.save();
      ctx.translate(cx, cy);

      const breathe = 0.5 + 0.5 * Math.sin(this.time * 2.8);
      const pulseAlpha = 0.7 + breathe * 0.3;

      // ── Outer glow — wider, brighter ────────────────────
      const glowGrad = ctx.createRadialGradient(
        0,
        0,
        maxR * 0.2,
        0,
        0,
        maxR * 1.5,
      );
      glowGrad.addColorStop(0, `rgba(180, 140, 230, ${0.5 + breathe * 0.25})`);
      glowGrad.addColorStop(
        0.5,
        `rgba(120, 80, 180, ${0.25 + breathe * 0.12})`,
      );
      glowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, maxR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // ── Containment fragments — larger ──────────────────
      const orbitR = maxR * 0.62;
      const fragCount = 6;
      const rotation = this.time * 0.55;

      for (let k = 0; k < fragCount; k++) {
        const angle = (k / fragCount) * Math.PI * 2 + rotation;
        const fx = Math.cos(angle) * orbitR;
        const fy = Math.sin(angle) * orbitR;

        const isWhite = k % 2 === 0;
        const sz = isWhite ? 2.8 : 2.2;
        const fragAlpha = isWhite ? pulseAlpha : pulseAlpha * 0.8;

        ctx.fillStyle = isWhite ? "#ffffff" : "rgba(230, 210, 255, 0.9)";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = isWhite ? 8 : 5;
        ctx.globalAlpha = fragAlpha;

        ctx.beginPath();
        ctx.moveTo(fx, fy - sz);
        ctx.lineTo(fx + sz * 0.5, fy);
        ctx.lineTo(fx, fy + sz);
        ctx.lineTo(fx - sz * 0.5, fy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Event horizon core — brighter edge ──────────────
      const coreR = maxR * 0.38;
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      coreGrad.addColorStop(0, "#000000");
      coreGrad.addColorStop(0.3, "rgba(10, 5, 25, 0.9)");
      coreGrad.addColorStop(
        0.65,
        `rgba(190, 150, 240, ${0.6 + breathe * 0.25})`,
      );
      coreGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = coreGrad;
      ctx.shadowColor = `rgba(200, 160, 250, ${0.7 + breathe * 0.2})`;
      ctx.shadowBlur = 12 + breathe * 5;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Core rim — brighter
      ctx.strokeStyle = `rgba(240, 215, 255, ${0.75 + breathe * 0.2})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "rgba(220, 190, 255, 0.6)";
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.stroke();

      // Singularity point — brighter
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 10 + breathe * 5;
      ctx.beginPath();
      ctx.arc(0, 0, coreR * 0.32, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();
  }
}
