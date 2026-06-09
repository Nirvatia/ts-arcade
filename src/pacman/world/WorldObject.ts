import { CFG_CANVAS } from "../config/canvas.config.js";
import { LevelContext } from "../core/LevelContext.js";
import type { IDrawable } from "../shared/types.js";
import * as PIXI from "pixi.js";

export abstract class WorldObject implements IDrawable {
  public levelContext: LevelContext;
  protected tileSize: number;
  protected shouldUpdate: boolean = true;
  protected shouldRender: boolean = true;

  private _needsRedraw: boolean = true;

  // ── Pixi Container Initialization ─────────────────────────────
  /** Every world asset manages its own sub-container layer */
  public readonly container: PIXI.Container;

  constructor(levelContext: LevelContext) {
    this.levelContext = levelContext;
    this.tileSize = CFG_CANVAS.tile.size;

    // Instantiate an isolated coordinate space layer for this object
    this.container = new PIXI.Container();
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

  public requestRedraw(): void {
    this._needsRedraw = true;
  }

  /**
   * Generates or mutates visual geometry.
   */
  abstract draw(): void;

  public destroy(): void {
    // Safely remove structural nodes and children textures from memory
    this.container.destroy({ children: true });
  }
}
