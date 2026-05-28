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

  private static readonly WALL_TILES: Set<string> = new Set([
    "WH", "WV", "TL", "TR", "BL", "BR"
  ]);

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

private getColors(): { fill: string; stroke: string; glow: string; accent: string } {
  const hue = this.gameState.levelData.mapHue ?? 200;
  return {
    fill: `hsla(${hue}, 25%, 5%, 0.85)`,
    stroke: `hsla(${hue}, 45%, 22%, 0.45)`,
    glow: `hsla(${hue}, 35%, 12%, 0.25)`,
    accent: `hsla(${hue}, 55%, 30%, 0.35)`,
  };
}

  draw(): void {
    const map = this.gameState.levelData.map;
    const ctx = this.ctx;
    const ts = this.tileSize;
    const pad = ts * 0.14;
    const blockSize = ts - pad * 2;
    const colors = this.getColors();
    const cw = this.canvasLayer.canvas.width;
    const ch = this.canvasLayer.canvas.height;
    const r = blockSize * 0.12;

    ctx.save();

    if (this._isFlashing) {
      const time = Date.now() / 150;
      ctx.globalAlpha = 0.3 + Math.sin(time) * 0.3;
    }

    ctx.fillStyle = "#010812";
    ctx.fillRect(0, 0, cw, ch);

    // Block glow
    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (!Maze.WALL_TILES.has(map[i][j])) continue;
        const x = j * ts + pad;
        const y = i * ts + pad;
        ctx.fillStyle = colors.glow;
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 5;
        this.roundRect(ctx, x - 1, y - 1, blockSize + 2, blockSize + 2, r + 1);
        ctx.fill();
      }
    }

    // Block fill
    ctx.shadowBlur = 0;
    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (!Maze.WALL_TILES.has(map[i][j])) continue;
        const x = j * ts + pad;
        const y = i * ts + pad;
        ctx.fillStyle = colors.fill;
        this.roundRect(ctx, x, y, blockSize, blockSize, r);
        ctx.fill();
      }
    }

    // Block border
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1;
    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (!Maze.WALL_TILES.has(map[i][j])) continue;
        const x = j * ts + pad;
        const y = i * ts + pad;
        this.roundRect(ctx, x, y, blockSize, blockSize, r);
        ctx.stroke();
      }
    }

    // Corner accent dots
    ctx.fillStyle = colors.accent;
    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (!Maze.WALL_TILES.has(map[i][j])) continue;
        const x = j * ts + pad;
        const y = i * ts + pad;
        const d = 2;
        ctx.fillRect(x + 2, y + 2, d, d);
        ctx.fillRect(x + blockSize - 2 - d, y + 2, d, d);
        ctx.fillRect(x + 2, y + blockSize - 2 - d, d, d);
        ctx.fillRect(x + blockSize - 2 - d, y + blockSize - 2 - d, d, d);
      }
    }

    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}