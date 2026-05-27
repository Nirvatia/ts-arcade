// src/world/Maze.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { GameState } from "../game/gameState.js";
import type { Drawable } from "../interfaces.js";

export class Maze implements Drawable {
  private gameState: GameState;
  private canvasLayer: CanvasLayer;
  private tileSize: number;
  private lineWidth: number;

  private _needsRedraw: boolean = true;
  private _isFlashing: boolean = false;

  constructor() {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.maze);
    this.tileSize = CFG_CANVAS.tile.size;
    this.lineWidth = Math.max(2, Math.floor(this.tileSize * 0.08));
  }

  get canvas(): HTMLCanvasElement {
    return this.canvasLayer.canvas;
  }

  get ctx(): CanvasRenderingContext2D {
    return this.canvasLayer.ctx;
  }

  get needsRedraw(): boolean {
    return this._needsRedraw;
  }

  set needsRedraw(value: boolean) {
    this._needsRedraw = value;
  }

  get isFlashing(): boolean {
    return this._isFlashing;
  }

  set isFlashing(value: boolean) {
    this._isFlashing = value;
  }

  requestRedraw(): void {
    this._needsRedraw = true;
  }

  clearCanvas(): void {
    this.canvasLayer.clear();
  }

  init(): void {
    this._needsRedraw = true;
  }

  reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this._needsRedraw = true;
  }

  draw(): void {
    const map = this.gameState.levelData.map;
    const ctx = this.ctx;
    const ts = this.tileSize;
    const lw = this.lineWidth;
    const half = ts / 2;

    ctx.save();
    ctx.strokeStyle = "#1a3a4a";
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.shadowColor = "#0a3a4a";
    ctx.shadowBlur = 3;

    if (this._isFlashing) {
      const time = Date.now() / 150;
      ctx.globalAlpha = 0.3 + Math.sin(time) * 0.3;
    }

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const tile = map[i][j];
        const x = j * ts;
        const y = i * ts;

        switch (tile) {
          case "WH":
            // Horizontal line through center
            ctx.beginPath();
            ctx.moveTo(x, y + half);
            ctx.lineTo(x + ts, y + half);
            ctx.stroke();
            break;

          case "WV":
            // Vertical line through center
            ctx.beginPath();
            ctx.moveTo(x + half, y);
            ctx.lineTo(x + half, y + ts);
            ctx.stroke();
            break;

          case "TL":
            // Top-left corner curve
            ctx.beginPath();
            ctx.moveTo(x + half, y + ts);
            ctx.lineTo(x + half, y + half);
            ctx.lineTo(x + ts, y + half);
            ctx.stroke();
            break;

          case "TR":
            // Top-right corner curve
            ctx.beginPath();
            ctx.moveTo(x, y + half);
            ctx.lineTo(x + half, y + half);
            ctx.lineTo(x + half, y + ts);
            ctx.stroke();
            break;

          case "BL":
            // Bottom-left corner curve
            ctx.beginPath();
            ctx.moveTo(x + half, y);
            ctx.lineTo(x + half, y + half);
            ctx.lineTo(x + ts, y + half);
            ctx.stroke();
            break;

          case "BR":
            // Bottom-right corner curve
            ctx.beginPath();
            ctx.moveTo(x, y + half);
            ctx.lineTo(x + half, y + half);
            ctx.lineTo(x + half, y);
            ctx.stroke();
            break;
        }
      }
    }

    ctx.restore();
  }
}
