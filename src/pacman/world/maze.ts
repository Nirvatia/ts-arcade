// src/world/Maze.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { GameState } from "../game/gameState.js";
import type { Drawable } from "../interfaces.js";

/**
 * Отрисовывает лабиринт (стены, повороты) на canvas.
 * Статический объект — перерисовывается только при смене уровня
 * или по флагу needsRedraw.
 */
export class Maze implements Drawable {
  private gameState: GameState;
  private canvasLayer: CanvasLayer;
  private tileSize: number;
  private lineWidth: number;
  private lineColor: string;

  private _needsRedraw: boolean = true;
  private _isFlashing: boolean = false;

  constructor() {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.maze);
    this.tileSize = CFG_CANVAS.tile.size;
    this.lineWidth = Math.floor((this.tileSize * 20) / 100);
    this.lineColor = this.gameState.levelData.mapColor;
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

  /** Очистить холст лабиринта */
  clearCanvas(): void {
    this.canvasLayer.clear();
  }

  /**
   * Подготовка к новому уровню:
   * очистка холста, обновление цвета, ресайз под новую карту.
   */
  resetForLevel(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this.lineColor = this.gameState.levelData.mapColor;
    this._needsRedraw = true;
  }

  init(): void {
    this._needsRedraw = true;
  }

  reset(): void {
    this.clearCanvas();
    this._needsRedraw = true;
  }

  /**
   * Отрисовка лабиринта.
   * При isFlashing = true применяет эффект пульсации прозрачности.
   */
  draw(animate: boolean, _dt?: number): void {
    const map = this.gameState.levelData.map;

    this.lineColor = this.gameState.levelData.mapColor;
    this.ctx.strokeStyle = this.lineColor;
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.save();

    // Эффект мигания лабиринта через прозрачность
    if (this._isFlashing) {
      const time = Date.now() / 150;
      this.ctx.globalAlpha = 0.3 + Math.sin(time) * 0.3;
    } else {
      this.ctx.globalAlpha = 1.0;
    }

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const tile = map[i][j];

        switch (tile) {
          case "WH":
            this.drawHorizontalLine(i, j);
            break;
          case "WV":
            this.drawVerticalLine(i, j);
            break;
          case "TL":
            this.drawTopLeftCurve(i, j);
            break;
          case "TR":
            this.drawTopRightCurve(i, j);
            break;
          case "BR":
            this.drawBottomRightCurve(i, j);
            break;
          case "BL":
            this.drawBottomLeftCurve(i, j);
            break;
        }
      }
    }

    this.ctx.restore();
  }

  // --- Приватные методы отрисовки ---

  private drawLine(x1: number, y1: number, x2: number, y2: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  private drawCurve(
    x1: number, y1: number,
    cx: number, cy: number,
    x2: number, y2: number,
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.quadraticCurveTo(cx, cy, x2, y2);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  private drawHorizontalLine(i: number, j: number): void {
    const x = this.tileSize * j;
    const y = this.tileSize * i + this.tileSize / 2;
    this.drawLine(x, y, x + this.tileSize, y);
  }

  private drawVerticalLine(i: number, j: number): void {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i;
    this.drawLine(x, y, x, y + this.tileSize);
  }

  private drawTopRightCurve(i: number, j: number): void {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i + this.tileSize;
    this.drawCurve(x, y, x, y - this.tileSize / 2, x - this.tileSize / 2, y - this.tileSize / 2);
  }

  private drawTopLeftCurve(i: number, j: number): void {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i + this.tileSize;
    this.drawCurve(x, y, x, y - this.tileSize / 2, x + this.tileSize / 2, y - this.tileSize / 2);
  }

  private drawBottomLeftCurve(i: number, j: number): void {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i;
    this.drawCurve(x, y, x, y + this.tileSize / 2, x + this.tileSize / 2, y + this.tileSize / 2);
  }

  private drawBottomRightCurve(i: number, j: number): void {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i;
    this.drawCurve(x, y, x, y + this.tileSize / 2, x - this.tileSize / 2, y + this.tileSize / 2);
  }
}