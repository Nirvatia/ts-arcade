import { CanvasLayer } from "../render/CanvasLayer.js";
import { GameState } from "../game/GameState.svelte.js";
import { CFG_CANVAS } from "../config/canvas.config.js";
import { Collision } from "../core/Collision.js";

import type { Updatable } from "../shared/types.js";

/**
 * Abstract base class for all moving game entities.
 * Inherited by Pac-Man and ghosts to provide shared movement, positioning, and rendering contexts.
 */
export abstract class Actor implements Updatable {
  protected gameState: GameState;
  protected canvasLayer: CanvasLayer;
  private sharedCtx: CanvasRenderingContext2D | null = null;
  public readonly canvasId: string;

  /** Dimensions of a single tile coordinate in pixels */
  protected tileSize: number;

  /** Forces a redraw pass when set to true */
  private _needsRedraw: boolean = true;

  /** Horizontal coordinate position in pixels centered on the entity */
  public x: number = -9999;

  /** Vertical coordinate position in pixels centered on the entity */
  public y: number = -9999;

  /** Collision and rendering radius scale in pixels */
  public r: number;

  /** Current directional vector offset multipliers */
  public direction: { dx: number; dy: number } = { dx: 0, dy: 0 };

  /** Movement velocity step scale in pixels per frame */
  protected speed: number;

  /** Prevents multiple teleport updates by storing the last processed exit destination coordinates */
  protected lastTeleportExit: { x: number; y: number } | null = null;

  /**
   * @param canvasId - DOM string identifier matching the target canvas element
   * @param sharedCtx - Optional rendering context for entities sharing a layer (e.g. Ghosts)
   */
  constructor(canvasId: string, sharedCtx?: CanvasRenderingContext2D) {
    this.canvasId = canvasId;
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(canvasId);
    this.tileSize = CFG_CANVAS.tile.size;
    this.r = this.tileSize / 2;
    this.speed = this.tileSize / 8;

    if (sharedCtx) {
      // Configures rendering hooks when sharing canvas layers with other actors
      this.sharedCtx = sharedCtx;
    } else {
      // Allocates a dedicated canvas layer instance for standalone actors
      this.canvasLayer = new CanvasLayer(canvasId);
    }
  }

  /** Returns the active HTMLCanvasElement node dependency */
  get canvas(): HTMLCanvasElement {
    return this.canvasLayer ? this.canvasLayer.canvas : this.sharedCtx!.canvas;
  }

  /** Returns the active 2D rendering interface dependency used for draw cycles */
  get ctx(): CanvasRenderingContext2D {
    return this.canvasLayer ? this.canvasLayer.ctx : this.sharedCtx!;
  }

  get needsRedraw(): boolean {
    return this._needsRedraw;
  }

  set needsRedraw(value: boolean) {
    this._needsRedraw = value;
  }

  /** Flags the entity state to invoke rendering transformations on the next loop tick */
  requestRedraw(): void {
    this._needsRedraw = true;
  }

  /** Clears all raster pixels out of the assigned canvas layer dimensions */
  clearCanvas(): void {
    this.canvasLayer?.clear();
  }

  /** Erases active layer contents and forces a layout resize during level transitions */
  resetForLevel(): void {
    this.clearCanvas();
    this.canvasLayer?.resize();
    this._needsRedraw = true;
  }

  /** Evaluates coordinate overlap with teleport zones and updates positions to the exit node destination */
  protected teleport(): void {
    const { tileX, tileY } = Collision.getTile(this.x, this.y);

    // Skip evaluation if the actor is still standing on the last triggered exit node coordinates
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

    if (Collision.isTeleport(tileX, tileY)) {
      const exit = Collision.getTeleportExit(tileX, tileY);
      if (exit) {
        this.x = exit.x * this.tileSize + this.tileSize / 2;
        this.y = exit.y * this.tileSize + this.tileSize / 2;
        this.lastTeleportExit = exit;
      }
    }
  }

  /** Calculates the next horizontal and vertical pixel position coordinates based on delta time scales */
  protected getNextPosition(dt: number): { newX: number; newY: number } {
    return {
      newX: this.x + this.direction.dx * this.speed * dt,
      newY: this.y + this.direction.dy * this.speed * dt,
    };
  }

  /** Locks the entity coordinate axis match position relative to its active travel heading direction */
  protected snapToMovementAxis(): void {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    if (this.direction.dx !== 0) this.x = centerX;
    if (this.direction.dy !== 0) this.y = centerY;
  }

  /** Forces positioning coordinates to snap directly to the center point pixels of the current grid tile */
  protected snapToTileCenter(): void {
    const { centerX, centerY } = Collision.getTileCenter(this.x, this.y);
    this.x = centerX;
    this.y = centerY;
  }

  /** Evaluates if future coordinate step increments collide with structural wall boundaries */
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

    const { tileX, tileY } = Collision.getTile(boundX, boundY);

    return Collision.isWall(tileX, tileY, isExitingGhostHouse);
  }

  /** Abstract initializer hook for setup tasks */
  abstract init(): void;

  /** Abstract state clear modifier hook */
  abstract reset(): void;

  /** Abstract level map placement spawn coordinator hook */
  abstract spawn(): void;

  /** Abstract logic routine update frame ticking step hook */
  abstract update(dt: number): void;

  /** Abstract frame draw loop rendering canvas execution hook */
  abstract draw(): void;
}
