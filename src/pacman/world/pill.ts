// src/entities/pill.ts
import { CFG_CANVAS } from "../config/canvas.js";
import { eventBus } from "../core/eventBus.js";
import type { Collectible, Updatable } from "../interfaces.js";
import { WorldObject } from "./worldObject.js";

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

    // Stable, grid-tested boundary footprint
    const maxRadius = ts * 0.5; 
    const breathingPulse = 0.5 + 0.5 * Math.sin(this.animationCounter * 6.5);

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    this.positions.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;
      
      ctx.save();
      ctx.translate(cx, cy);

      // --- PASS 1: KINETIC RADAR WAVEFRONTS ---
      // Fixed 2px structural stroke avoids sub-pixel anti-aliasing collapse
      ctx.lineWidth = 2.0;
      ctx.shadowBlur = 4;

      const waveCount = 2; // Reduced count to keep the paths looking clean and distinct
      for (let k = 0; k < waveCount; k++) {
        const waveProgress = ((this.animationCounter * 1.1) + (k / waveCount)) % 1.0;
        const currentRadius = maxRadius * waveProgress;
        const alpha = 1.0 - waveProgress;

        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.95})`;
        ctx.shadowColor = `rgba(0, 240, 255, ${alpha * 0.6})`;
        
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // --- PASS 2: SOLID CORE SHROUD ---
      // A substantial magenta mass that fills the center space cleanly
      ctx.fillStyle = "rgba(255, 0, 187, 0.85)";
      ctx.shadowColor = "rgba(255, 0, 187, 1)";
      ctx.shadowBlur = 6 + breathingPulse * 4;
      
      const shroudRadius = maxRadius * (0.35 + breathingPulse * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, shroudRadius, 0, Math.PI * 2);
      ctx.fill();

      // --- PASS 3: INCANDESCENT SEED ---
      // Pure white hot pinpoint inside the shroud for crisp contrast
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 3;
      
      const coreRadius = maxRadius * 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();
  }
}