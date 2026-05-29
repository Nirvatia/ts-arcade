// src/world/Pill.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { eventBus } from "../core/eventBus.js";
import { GameState } from "../game/gameState.js";
import type { Collectible, Updatable } from "../interfaces.js";

export class Pill implements Updatable, Collectible {
  private gameState: GameState;
  private canvasLayer: CanvasLayer;
  private tileSize: number;

  private _needsRedraw: boolean = true;
  private animationCounter: number = 0;

  public positions: { i: number; j: number }[] = [];

  constructor() {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.pills);
    this.tileSize = CFG_CANVAS.tile.size;
    this.initEventListeners();
  }

  get canvas(): HTMLCanvasElement { return this.canvasLayer.canvas; }
  get ctx(): CanvasRenderingContext2D { return this.canvasLayer.ctx; }
  get needsRedraw(): boolean { return this._needsRedraw; }
  set needsRedraw(value: boolean) { this._needsRedraw = value; }

  requestRedraw(): void { this._needsRedraw = true; }
  clearCanvas(): void { this.canvasLayer.clear(); }

  initEventListeners(): void {
    eventBus.on(
      "power_pill:collect",
      (data: { position: { i: number; j: number } }) => {
        this.collect(data.position.i, data.position.j);
      },
    );
  }

  spawn(): void {
    this.positions = [];
    const map = this.gameState.levelData.map;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (map[i][j] === "PP") {
          this.positions.push({ i, j });
        }
      }
    }
  }

  collect(i: number, j: number): void {
    const index = this.positions.findIndex(
      (pos: { i: number; j: number }) => pos.i === i && pos.j === j,
    );

    if (index !== -1) {
      this.positions.splice(index, 1);
      this.requestRedraw();
      eventBus.emit("power_pill:eaten", { position: { i, j } });
    }
  }

  init(): void {}

  reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this.positions = [];
    this.animationCounter = 0;
    this._needsRedraw = true;
  }

  update(dt: number): void {
    if (this.gameState.mode !== "PLAYING") return;
    
    this.animationCounter += 4 * dt;
    this._needsRedraw = true; 
  }

  draw(): void {
    this.clearCanvas();
    const ctx = this.ctx;
    const ts = this.tileSize;

    const baseRadius = ts * 0.24; 
    const pulse = 0.5 + 0.5 * Math.sin(this.animationCounter * 3.5);

    this.positions.forEach(({ i, j }) => {
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