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
    this.lineWidth = Math.max(1, Math.floor(this.tileSize * 0.04));
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

  private getColors(): {
    grid: string;
    gridBright: string;
    wall: string;
    wallGlow: string;
  } {
    const mapColor = this.gameState.levelData.mapColor;
    const hslMatch = mapColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);

    if (hslMatch) {
      const hue = parseInt(hslMatch[1]);
      const sat = parseInt(hslMatch[2]);
      return {
        grid: `hsla(${hue}, ${Math.min(30, sat * 0.4)}%, 6%, 0.4)`,
        gridBright: `hsla(${hue}, ${Math.min(40, sat * 0.5)}%, 10%, 0.5)`,
        wall: `hsla(${hue}, ${Math.min(70, sat * 0.8)}%, 35%, 0.8)`,
        wallGlow: `hsla(${hue}, ${Math.min(80, sat)}%, 45%, 0.2)`,
      };
    }

    return {
      grid: "hsla(200, 20%, 6%, 0.4)",
      gridBright: "hsla(200, 30%, 10%, 0.5)",
      wall: "hsla(200, 50%, 35%, 0.8)",
      wallGlow: "hsla(200, 60%, 45%, 0.2)",
    };
  }

  draw(): void {
    const map = this.gameState.levelData.map;
    const ctx = this.ctx;
    const ts = this.tileSize;
    const lw = this.lineWidth;
    const half = ts / 2;
    const colors = this.getColors();
    const cw = this.canvasLayer.canvas.width;
    const ch = this.canvasLayer.canvas.height;

    ctx.save();

    if (this._isFlashing) {
      const time = Date.now() / 150;
      ctx.globalAlpha = 0.3 + Math.sin(time) * 0.3;
    }

    // Fill background
    ctx.fillStyle = "#010812";
    ctx.fillRect(0, 0, cw, ch);

    // Fine grid
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.3;
    for (let x = 0; x < cw; x += ts * 0.5) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y < ch; y += ts * 0.5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    // Tile grid
    ctx.strokeStyle = colors.gridBright;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < cw; x += ts) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y < ch; y += ts) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    // Wall glow
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colors.wallGlow;
    ctx.lineWidth = lw + 3;
    ctx.shadowColor = colors.wallGlow;
    ctx.shadowBlur = 8;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const tile = map[i][j];
        if (
          tile === "ES" ||
          tile === "FD" ||
          tile === "PP" ||
          tile === "PM" ||
          tile === "GL" ||
          tile === "BY" ||
          tile === "PY" ||
          tile === "IY" ||
          tile === "CE" ||
          tile === "0A" ||
          tile === "0B"
        )
          continue;

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

    // Wall solid
    ctx.strokeStyle = colors.wall;
    ctx.lineWidth = lw;
    ctx.shadowColor = colors.wall;
    ctx.shadowBlur = 2;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const tile = map[i][j];
        if (
          tile === "ES" ||
          tile === "FD" ||
          tile === "PP" ||
          tile === "PM" ||
          tile === "GL" ||
          tile === "BY" ||
          tile === "PY" ||
          tile === "IY" ||
          tile === "CE" ||
          tile === "0A" ||
          tile === "0B"
        )
          continue;

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
