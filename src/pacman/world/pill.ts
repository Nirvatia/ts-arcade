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
  // 1. Sets use .clear() natively
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

  // 2. Instant O(1) matching and execution
  if (this.positions.delete(key)) {
    this.requestRedraw();
    eventBus.emit("power_pill:eaten", { position: { i, j } });
  }
}

override reset(): void {
  super.reset();
  this.positions.clear(); // Fixed
  this.animationCounter = 0;
}

  update(dt: number): void {
    if (this.gameState.mode !== "PLAYING") return;
    
    this.animationCounter += 4 * dt;
    this.needsRedraw = true; 
  }

  draw(): void {
    this.clearCanvas();
    const ctx = this.ctx;
    const ts = this.tileSize;

    const baseRadius = ts * 0.24; 
    const pulse = 0.5 + 0.5 * Math.sin(this.animationCounter * 3.5);

    this.positions.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;
      const currentRadius = baseRadius + pulse * 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.animationCounter);

      // --- PASS 1: OUTSIDE DIAMOND (Neon Electric Cyan/Blue Glow) ---
      ctx.shadowColor = "rgba(0, 220, 255, 0.85)";
      ctx.shadowBlur = 10 * pulse;
      ctx.strokeStyle = "rgba(180, 245, 255, 0.95)";
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(0, -currentRadius);
      ctx.lineTo(currentRadius, 0);
      ctx.lineTo(0, currentRadius);
      ctx.lineTo(-currentRadius, 0);
      ctx.closePath();
      ctx.stroke();

      // --- PASS 2: INNER CROSS BEAMS (Crisp White/Cyan Vector Lines) ---
      ctx.strokeStyle = "rgba(200, 250, 255, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-currentRadius * 0.4, 0);
      ctx.lineTo(currentRadius * 0.4, 0);
      ctx.moveTo(0, -currentRadius * 0.4);
      ctx.lineTo(0, currentRadius * 0.4);
      ctx.stroke();
      
      // --- PASS 3: ENGINE CORE (Hot Blinding White Block) ---
      ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 + pulse * 0.15})`;
      const coreSize = currentRadius * 0.35;
      ctx.fillRect(-coreSize / 2, -coreSize / 2, coreSize, coreSize);
      
      ctx.restore();
    });
  }
}