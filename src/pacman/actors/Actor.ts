// actors/Actor.ts
import { CFG_CANVAS } from "../config/canvas.config.js";
import { CanvasLayer } from "../render/CanvasLayer.js";
import type { LevelContext } from "../core/LevelContext.js";
import type { IUpdatable } from "../shared/types.js";

export abstract class Actor implements IUpdatable {
  protected canvasLayer: CanvasLayer;
  protected levelContext: LevelContext;
  protected tileSize: number;
  protected shouldUpdate: boolean = true;
  protected shouldRender: boolean = true;

  private _needsRedraw: boolean = true;
  public x: number = -9999;
  public y: number = -9999;
  public r: number;
  public direction: { dx: number; dy: number } = { dx: 0, dy: 0 };
  public speed: number;
  protected lastTeleportExit: { x: number; y: number } | null = null;

  constructor(canvasLayer: CanvasLayer, levelContext: LevelContext) {
    this.canvasLayer = canvasLayer;
    this.levelContext = levelContext;
    this.tileSize = CFG_CANVAS.tile.size;
    this.r = this.tileSize / 2;
    this.speed = this.tileSize / 8;
  }

  protected get gridContext() {
    return this.levelContext.gridContext;
  }
  protected get gameState() {
    return this.levelContext.gameState;
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
  clearCanvas(): void {
    this.canvasLayer?.clear();
  }

  public get layer(): CanvasLayer {
    return this.canvasLayer;
  }

  protected teleport(): void {
    const { tileX, tileY } = this.gridContext.getTile(this.x, this.y);

    if (this.lastTeleportExit) {
      if (
        tileX === this.lastTeleportExit.x &&
        tileY === this.lastTeleportExit.y
      ) {
        return;
      } else {
        this.lastTeleportExit = null;
      }
    }

    if (this.gridContext.isTeleport(tileX, tileY)) {
      const exit = this.gridContext.getTeleportExit(tileX, tileY);
      if (exit) {
        this.x = exit.x * this.tileSize + this.tileSize / 2;
        this.y = exit.y * this.tileSize + this.tileSize / 2;

        this.x += this.direction.dx * this.tileSize * 0.6;
        this.y += this.direction.dy * this.tileSize * 0.6;

        this.lastTeleportExit = exit;
      }
    }
  }
  protected getNextPosition(dt: number): { newX: number; newY: number } {
    return {
      newX: this.x + this.direction.dx * this.speed * dt,
      newY: this.y + this.direction.dy * this.speed * dt,
    };
  }

  protected snapToMovementAxis(): void {
    const { centerX, centerY } = this.gridContext.getTileCenter(this.x, this.y);
    if (this.direction.dx !== 0) this.x = centerX;
    if (this.direction.dy !== 0) this.y = centerY;
  }

  protected snapToTileCenter(): void {
    const { centerX, centerY } = this.gridContext.getTileCenter(this.x, this.y);
    this.x = centerX;
    this.y = centerY;
  }

  protected willHitWall(
    dt: number,
    dir = this.direction,
    isExitingGhostHouse = false,
  ): boolean {
    if (dir.dx === 0 && dir.dy === 0) return false;

    const moveDistance = this.speed * dt;
    const lookAheadDistance = moveDistance + this.r;

    const boundX = this.x + dir.dx * lookAheadDistance;
    const boundY = this.y + dir.dy * lookAheadDistance;

    const { tileX, tileY } = this.gridContext.getTile(boundX, boundY);
    return this.gridContext.isWall(tileX, tileY, isExitingGhostHouse);
  }

  abstract spawn(): void;
  abstract update(dt: number): void;
  abstract draw(): void;
}
