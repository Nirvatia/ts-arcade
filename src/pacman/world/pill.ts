import { CFG_CANVAS } from "../config/canvas.config.js";
import { eventBus } from "../core/EventBus.js";
import { WorldObject } from "./WorldObject.js";

import type { Collectible, Updatable } from "../shared/types.js";

export class Pill extends WorldObject implements Updatable, Collectible {
  private animationCounter: number = 0;
  public positions: Set<string> = new Set<string>();

  constructor() {
    super(CFG_CANVAS.canvasIds.pills);
    this.initEventListeners();
  }

  private initEventListeners(): void {
    eventBus.on(
      "power_pill:collect",
      (data: { position: { i: number; j: number } }) => {
        this.collect(data.position.i, data.position.j);
      },
    );
  }

  spawn(): void {
    this.positions.clear();
    const map = this.gameState.levelData.map;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (map[i][j] === "PP") {
          this.positions.add(`${i},${j}`);
        }
      }
    }
  }

  collect(i: number, j: number): void {
    const key = `${i},${j}`;
    if (this.positions.delete(key)) {
      this.requestRedraw();
      eventBus.emit("power_pill:eaten", { position: { i, j } });
    }
  }

  override reset(): void {
    super.reset();
    this.positions.clear();
    this.animationCounter = 0;
  }

  update(dt: number): void {
    if (this.gameState.mode !== "PLAYING") return;

    // Smooth time tracking for the wave cycle
    this.animationCounter += dt;
    this.needsRedraw = true;
  }

  draw(): void {
    this.clearCanvas();
    const ctx = this.ctx;
    const ts = this.tileSize;

    const maxRadius = ts * 0.54;
    const pulseFactor = 0.5 + 0.5 * Math.sin(this.animationCounter * 8.5);
    const rotationAngle = this.animationCounter * 1.2;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    this.positions.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;

      ctx.save();
      ctx.translate(cx, cy);

      // --- PASS 1: SHARP TRON PHOTONIC RINGS ---
      // Hard, crisp data rings pulsing outward without anti-aliasing wash
      ctx.lineWidth = 1.5;
      const waveCount = 2;
      for (let k = 0; k < waveCount; k++) {
        const progress = (this.animationCounter * 1.4 + k / waveCount) % 1.0;
        const currentRadius = maxRadius * (0.35 + progress * 0.65);
        const alpha = 1.0 - progress;

        // Frozen Ice Cyan: High frequency energy signature
        ctx.strokeStyle = `rgba(0, 255, 213, ${alpha * 0.85})`;
        ctx.shadowColor = "rgb(0, 255, 213)";
        ctx.shadowBlur = 4 * alpha;

        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // --- PASS 2: ROTATING VECTOR CONFINEMENT MATRIX ---
      // A hard, cold-white geometric square that traps the inner plasma core
      ctx.save();
      ctx.rotate(rotationAngle);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; // Cold stark containment line
      ctx.shadowColor = "rgb(0, 255, 213)";
      ctx.shadowBlur = 3;

      const boxSize = maxRadius * 0.42;
      ctx.beginPath();
      ctx.rect(-boxSize, -boxSize, boxSize * 2, boxSize * 2);
      ctx.stroke();
      ctx.restore();

      // --- PASS 3: THE ANTI-MATTER SINK (THE VOID) ---
      // Creates a hard visual drop-off before the bright core hits
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(0, 0, maxRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // --- PASS 4: HIGH-EMISSION INDIUM PLASMA CORE ---
      // Electric mint/cyan center with deep-blue underlying shadows for mass
      const coreRadius = maxRadius * (0.28 + pulseFactor * 0.05);

      ctx.fillStyle = "rgb(0, 255, 242)"; // Pure Tron Cyan
      ctx.shadowColor = "rgb(0, 102, 255)"; // Deep stellar blue falloff bloom
      ctx.shadowBlur = 12 + pulseFactor * 8;

      ctx.beginPath();
      ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      // Blinding white hyper-dense focal point
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();
  }
}
