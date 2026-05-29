// src/world/Maze.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { GameState } from "../game/gameState.js";
import type { Drawable } from "../interfaces.js";

export class Maze implements Drawable {
  private gameState: GameState;
  private canvasLayer: CanvasLayer;
  private tileSize: number;

  private _needsRedraw: boolean = true;
  private _isFlashing: boolean = false;

  constructor() {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.maze);
    this.tileSize = CFG_CANVAS.tile.size;
  }

  get canvas(): HTMLCanvasElement { return this.canvasLayer.canvas; }
  get ctx(): CanvasRenderingContext2D { return this.canvasLayer.ctx; }
  get needsRedraw(): boolean { return this._needsRedraw; }
  set needsRedraw(value: boolean) { this._needsRedraw = value; }
  get isFlashing(): boolean { return this._isFlashing; }
  set isFlashing(value: boolean) { this._isFlashing = value; }

  requestRedraw(): void { this._needsRedraw = true; }
  clearCanvas(): void { this.canvasLayer.clear(); }
  init(): void { this._needsRedraw = true; }

  reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this._needsRedraw = true;
  }

  private getColors(): {
    bg: string;
    neonWire: string;
    glow: string;
  } {
    const hue = this.gameState.levelData.mapHue ?? 190; 
    return {
      bg: "#01050d", 
      neonWire: `hsla(${hue}, 100%, 55%, 0.95)`, 
      glow: `hsla(${hue}, 100%, 50%, 0.4)`,
    };
  }

  draw(): void {
    const map = this.gameState.levelData.map;
    const ctx = this.ctx;
    const ts = this.tileSize;
    const colors = this.getColors();
    const cw = this.canvasLayer.canvas.width;
    const ch = this.canvasLayer.canvas.height;

    ctx.save();

    if (this._isFlashing) {
      const time = Date.now() / 150;
      ctx.globalAlpha = 0.2 + Math.sin(time) * 0.4;
    }

    // Deep grid space base
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, cw, ch);

    // --- GRID GEOMETRY STYLE ---
    ctx.lineCap = "square";
    ctx.lineJoin = "miter"; 
    ctx.lineWidth = 1.5; 

    // Apply bloom processing
    ctx.strokeStyle = colors.neonWire;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = this._isFlashing ? 12 : 5;

    const offset = ts * 0.28;

    // --- BATCH RENDERING PASSES ---
    // Accumulating all geometry points to execute single stroke operations 
    // cleanly fires the drawing pipeline and removes tile intersection dots.
    ctx.beginPath();
    this.buildTronPath(map, ctx, ts, offset);
    ctx.stroke();

    ctx.beginPath();
    this.buildTronPath(map, ctx, ts, -offset);
    ctx.stroke();

    ctx.restore();
    this._needsRedraw = false;
  }

  // Generates structural map geometry without firing independent intermediate stroke steps
  private buildTronPath(map: string[][], ctx: CanvasRenderingContext2D, ts: number, offset: number): void {
    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const type = map[i][j];
        const x = j * ts;
        const y = i * ts;
        const hSize = ts / 2;

        if (type === "WH") {
          ctx.moveTo(x, y + hSize + offset);
          ctx.lineTo(x + ts, y + hSize + offset);
        } 
        else if (type === "WV") {
          ctx.moveTo(x + hSize + offset, y + ts);
          ctx.lineTo(x + hSize + offset, y);
        } 
        else if (type === "TL") {
          ctx.moveTo(x + hSize + offset, y + ts);
          ctx.lineTo(x + hSize + offset, y + hSize + offset);
          ctx.lineTo(x + ts, y + hSize + offset);
        } 
        else if (type === "BL") {
          ctx.moveTo(x + hSize + offset, y);
          ctx.lineTo(x + hSize + offset, y + hSize - offset);
          ctx.lineTo(x + ts, y + hSize - offset);
        } 
        else if (type === "BR") {
          ctx.moveTo(x + hSize - offset, y);
          ctx.lineTo(x + hSize - offset, y + hSize - offset);
          ctx.lineTo(x, y + hSize - offset);
        } 
        else if (type === "TR") {
          ctx.moveTo(x + hSize - offset, y + ts);
          ctx.lineTo(x + hSize - offset, y + hSize + offset);
          ctx.lineTo(x, y + hSize + offset);
        }
      }
    }
  }
}