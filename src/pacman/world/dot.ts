// src/world/Dot.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { eventBus } from "../core/eventBus.js";
import { GameState } from "../game/gameState.svelte.js";
import type { Collectible, Drawable } from "../interfaces.js";

export class Dot implements Drawable, Collectible {
  private gameState: GameState;
  private canvasLayer: CanvasLayer;
  private tileSize: number;
  private dotSize: number;

  private _needsRedraw: boolean = true;

  public positions: Set<string> = new Set<string>();

  constructor() {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.dots);
    this.tileSize = CFG_CANVAS.tile.size;
    this.dotSize = this.tileSize * 0.11; 
    this.initEventListeners();
  }

  get canvas(): HTMLCanvasElement { return this.canvasLayer.canvas; }
  get ctx(): CanvasRenderingContext2D { return this.canvasLayer.ctx; }
  get needsRedraw(): boolean { return this._needsRedraw; }
  set needsRedraw(value: boolean) { this._needsRedraw = value; }

  initEventListeners(): void {
    eventBus.on(
      "dot:collect",
      (data: { position: { i: number; j: number } }) => {
        this.collect(data.position.i, data.position.j);
      },
    );
  }

  requestRedraw(): void { this._needsRedraw = true; }

  clearCanvas(x?: number, y?: number, w?: number, h?: number): void {
    this.canvasLayer.clear(x, y, w, h);
  }

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

  collect(i: number, j: number): void {
    this.positions.delete(`${i},${j}`);
    this.clearCanvas(
      j * this.tileSize - 2,
      i * this.tileSize - 2,
      this.tileSize + 4,
      this.tileSize + 4,
    );
    eventBus.emit("dot:eaten", {
      position: { i, j },
      dotsRemaining: this.positions.size,
    });
  }

  init(): void {}

  reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this.positions.clear();
    this._needsRedraw = true;
  }

  draw(): void {
    this.clearCanvas();
    const ctx = this.ctx;

    ctx.save();
    // Swapped amber out for a clean, sharp white-hot core with subtle cyan bloom
    ctx.shadowColor = "rgba(0, 200, 255, 0.5)";
    ctx.shadowBlur = 3;
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; 

    this.positions.forEach((pos) => {
      const [i, j] = pos.split(",").map(Number);
      const cx = this.tileSize * j + this.tileSize / 2;
      const cy = this.tileSize * i + this.tileSize / 2;
      const half = this.dotSize / 2;

      ctx.fillRect(cx - half, cy - half, this.dotSize, this.dotSize);
    });

    ctx.restore();
  }
}