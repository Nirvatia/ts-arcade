// world/WorldObject.ts
import { CanvasLayer } from "../render/CanvasLayer.js";
import { CFG_CANVAS } from "../config/canvas.config.js";
import { LevelContext } from "../core/LevelContext.js";
import type { IDrawable } from "../shared/types.js";

export abstract class WorldObject implements IDrawable {
  public levelContext: LevelContext;
  protected canvasLayer: CanvasLayer;
  protected tileSize: number;
  protected shouldUpdate: boolean = true;
  protected shouldRender: boolean = true;

  private _needsRedraw: boolean = true;

  constructor(canvasLayer: CanvasLayer, levelContext: LevelContext) {
    this.canvasLayer = canvasLayer;
    this.levelContext = levelContext;
    this.tileSize = CFG_CANVAS.tile.size;
  }

  protected get gameState() {
    return this.levelContext.gameState;
  }

  protected get gridContext() {
    return this.levelContext.gridContext;
  }

  get needsRedraw(): boolean {
    return this._needsRedraw;
  }

  set needsRedraw(value: boolean) {
    this._needsRedraw = value;
  }

  public get layer(): CanvasLayer {
    return this.canvasLayer;
  }

  public requestRedraw(): void {
    this._needsRedraw = true;
  }

  public clearCanvas(x?: number, y?: number, w?: number, h?: number): void {
    this.canvasLayer.clear(x, y, w, h);
  }

  abstract draw(): void;

  public destroy(): void {}
}
