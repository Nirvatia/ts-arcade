// src/world/Dot.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { eventBus } from "../core/eventBus.js";
import { GameState } from "../game/gameState.js";
import type { Collectible, Drawable } from "../interfaces.js";

/**
 * Управляет точками еды (dots) на карте.
 * Статический объект с интерфейсами Drawable и Collectible.
 */
export class Dot implements Drawable, Collectible {
  private gameState: GameState;
  private canvasLayer: CanvasLayer;
  private tileSize: number;
  private color: string;
  private radius: number;

  private _needsRedraw: boolean = true;

  /** Позиции точек: ключ "row,col" -> true */
  public positions: Set<string> = new Set<string>();

  constructor() {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.dots);
    this.tileSize = CFG_CANVAS.tile.size;
    this.color = "rgb(230, 230, 230)";
    this.radius = this.tileSize / 8;
    this.initEventListeners();
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

  initEventListeners(): void {
    eventBus.on(
      "dot:collect",
      (data: { position: { i: number; j: number } }) => {
        this.collect(data.position.i, data.position.j);
      },
    );
  }

  requestRedraw(): void {
    this._needsRedraw = true;
  }

  clearCanvas(x?: number, y?: number, w?: number, h?: number): void {
    this.canvasLayer.clear(x, y, w, h);
  }

  // --- Collectible ---

  /**
   * Сканирует карту уровня и создаёт точки на всех позициях "FD".
   * Вызывается при загрузке уровня.
   */
  spawn(): void {
    this.positions.clear();
    this.clearCanvas();

    const map = this.gameState.levelData.map;
    let cnt = 0;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (map[i][j] === "FD") {
          this.positions.add(`${i},${j}`);
          cnt++;
        }
      }
    }

    this._needsRedraw = true;
    eventBus.emit("dot:spawned", { count: cnt });
  }

  /**
   * Съесть точку по координатам тайла.
   * Удаляет точку из набора и зачищает её пиксели на холсте.
   */
  collect(i: number, j: number): void {
    this.positions.delete(`${i},${j}`);
    this.clearCanvas(
      j * this.tileSize,
      i * this.tileSize,
      this.tileSize,
      this.tileSize,
    );
    eventBus.emit("dot:eaten", {
      position: { i, j },
      dotsRemaining: this.positions.size,
    });
  }

  // --- Lifecycle ---

  init(): void {
    // Пусто — точки создаются в spawn()
  }

  reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this.positions.clear();
    this._needsRedraw = true;
  }

  // --- Drawable ---

  draw(): void {
    this.positions.forEach((pos) => {
      const [i, j] = pos.split(",").map(Number);
      this.drawDot(i, j);
    });
  }

  private drawDot(i: number, j: number): void {
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.arc(
      this.tileSize * j + this.tileSize / 2,
      this.tileSize * i + this.tileSize / 2,
      this.radius,
      0,
      Math.PI * 2,
    );
    this.ctx.fill();
    this.ctx.closePath();
  }
}
