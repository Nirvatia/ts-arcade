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
    // Optimization: Keep ticking during transitions if needed, or exit early
    if (this.gameState.mode !== "PLAYING") return;

    // Normalize dt to protect animation speed variations across monitors
    const fs = Math.min(
      dt === undefined || isNaN(dt) || dt === 0 ? 0.016 : dt,
      0.1,
    );
    this.time += fs;
    this.needsRedraw = true;
  }

  public draw(): void {
    const ctx = this.layer.ctx;
    const ts = this.tileSize;
    const maxR = ts * 0.52;

    const activePills = this.gameState.activePills;
    if (activePills.size === 0) return;

    ctx.save();

    // Cache math scalar calculations outside the loop
    const breathe = 0.5 + 0.5 * Math.sin(this.time * 2.8);
    const pulseAlpha = 0.7 + breathe * 0.3;
    const coreR = maxR * 0.38;
    const orbitR = maxR * 0.62;
    const fragCount = 6;
    const rotation = this.time * 0.55;

    activePills.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;

      ctx.save();
      ctx.translate(cx, cy);

      // ── 1. Outer Glow (Pure Gradient - No Shadow Blurs) ──
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

      // ── 2. Containment Fragments (Optimized vector rendering) ──
      // Replaced expensive shadowBlurs with a layered, slightly translucent under-pass for glowing effect
      ctx.globalAlpha = pulseAlpha;
      for (let pass = 0; pass < 2; pass++) {
        const isBlurPass = pass === 0;

        for (let k = 0; k < fragCount; k++) {
          const angle = (k / fragCount) * Math.PI * 2 + rotation;
          const fx = Math.cos(angle) * orbitR;
          const fy = Math.sin(angle) * orbitR;

          const isWhite = k % 2 === 0;
          // Scale size up on the base pass to simulate an glow bloom aura
          const sz = (isWhite ? 2.8 : 2.2) * (isBlurPass ? 2.0 : 1.0);

          ctx.fillStyle = isBlurPass
            ? "rgba(180, 140, 255, 0.4)"
            : isWhite
              ? "#ffffff"
              : "rgba(230, 210, 255, 0.95)";

          ctx.beginPath();
          ctx.moveTo(fx, fy - sz);
          ctx.lineTo(fx + sz * 0.5, fy);
          ctx.lineTo(fx, fy + sz);
          ctx.lineTo(fx - sz * 0.5, fy);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;

      // ── 3. Event Horizon Core ──
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      coreGrad.addColorStop(0, "#000000");
      coreGrad.addColorStop(0.3, "rgba(10, 5, 25, 0.9)");
      coreGrad.addColorStop(
        0.65,
        `rgba(190, 150, 240, ${0.6 + breathe * 0.25})`,
      );
      coreGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Core Rim
      ctx.strokeStyle = `rgba(240, 215, 255, ${0.75 + breathe * 0.2})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.stroke();

      // ── 4. Singularity Point Core Flare (Simulating intense light bloom) ──
      const flareR = coreR * 0.32;
      const singularityGrad = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        flareR * 2.5,
      );
      singularityGrad.addColorStop(0, "#ffffff");
      singularityGrad.addColorStop(
        0.4,
        `rgba(230, 210, 255, ${0.8 + breathe * 0.2})`,
      );
      singularityGrad.addColorStop(1, "rgba(120, 80, 180, 0)");

      ctx.fillStyle = singularityGrad;
      ctx.beginPath();
      ctx.arc(0, 0, flareR * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();
  }
}
