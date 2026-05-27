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
    this.lineWidth = Math.max(2, Math.floor(this.tileSize * 0.1));
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

  private getTronWallColor(): { stroke: string; shadow: string } {
    const mapColor = this.gameState.levelData.mapColor;
    const hslMatch = mapColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    
    if (hslMatch) {
      const hue = parseInt(hslMatch[1]);
      const saturation = parseInt(hslMatch[2]);
      
      // Balanced Tron colors: visible but not overwhelming
      const visibleSaturation = Math.max(40, saturation * 0.7);
      const strokeLightness = 30; // Dark enough for style, light enough to see
      const shadowLightness = 15;
      
      return {
        stroke: `hsla(${hue}, ${visibleSaturation}%, ${strokeLightness}%, 0.9)`,
        shadow: `hsla(${hue}, ${visibleSaturation}%, ${shadowLightness}%, 0.4)`
      };
    }
    
    return {
      stroke: "hsla(200, 50%, 30%, 0.9)",
      shadow: "hsla(200, 50%, 15%, 0.4)"
    };
  }

  draw(): void {
    const map = this.gameState.levelData.map;
    const ctx = this.ctx;
    const ts = this.tileSize;
    const lw = this.lineWidth;
    const half = ts / 2;

    const tronColors = this.getTronWallColor();

    ctx.save();
    ctx.strokeStyle = tronColors.stroke;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.shadowColor = tronColors.shadow;
    ctx.shadowBlur = 4;

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
            ctx.beginPath();
            ctx.moveTo(x, y + half);
            ctx.lineTo(x + ts, y + half);
            ctx.stroke();
            break;

          case "WV":
            ctx.beginPath();
            ctx.moveTo(x + half, y);
            ctx.lineTo(x + half, y + ts);
            ctx.stroke();
            break;

          case "TL":
            ctx.beginPath();
            ctx.moveTo(x + half, y + ts);
            ctx.lineTo(x + half, y + half);
            ctx.lineTo(x + ts, y + half);
            ctx.stroke();
            break;

          case "TR":
            ctx.beginPath();
            ctx.moveTo(x, y + half);
            ctx.lineTo(x + half, y + half);
            ctx.lineTo(x + half, y + ts);
            ctx.stroke();
            break;

          case "BL":
            ctx.beginPath();
            ctx.moveTo(x + half, y);
            ctx.lineTo(x + half, y + half);
            ctx.lineTo(x + ts, y + half);
            ctx.stroke();
            break;

          case "BR":
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