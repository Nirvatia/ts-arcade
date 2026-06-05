import { CanvasLayer } from "../render/CanvasLayer.js";
import { GameState } from "../game/GameState.svelte.js";
import { CFG_CANVAS } from "../config/canvas.config.js";

import type { Drawable } from "../shared/types.js";

export abstract class WorldObject implements Drawable {
  protected gameState: GameState;
  protected canvasLayer: CanvasLayer;
  protected tileSize: number;

  public readonly canvasId: string;
  private _needsRedraw: boolean = true;

  constructor(canvasId: string) {
    this.canvasId = canvasId;
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(canvasId);
    this.tileSize = CFG_CANVAS.tile.size;
  }

  // --- Drawable Interface Implementation ---
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

  requestRedraw(): void {
    this._needsRedraw = true;
  }

  clearCanvas(x?: number, y?: number, w?: number, h?: number): void {
    this.canvasLayer.clear(x, y, w, h);
  }

  // --- Base Lifecycle Methods ---
  public init(): void {
    this._needsRedraw = true;
  }

  public reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this._needsRedraw = true;
  }

  // --- Forces child classes to specify layout painting ---
  abstract draw(): void;

  public destroy(): void {}
}
