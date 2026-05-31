// src/effects/Vignette.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { GameRegistry } from "../game/gameRegistry.js";
import type { Updatable } from "../interfaces.js";
import { WorldObject } from "../world/worldObject.js";

export class Vignette extends WorldObject implements Updatable {
  private registry: GameRegistry;

  constructor() {
    // 1. Pass the vignette canvas ID straight to the WorldObject base class
    super(CFG_CANVAS.canvasIds.vignette);
    this.registry = GameRegistry.getInstance();
  }

  /**
   * Updates the VFX logic on every frame tick.
   * Since the vignette follows Pacman dynamically, it forces a redraw request.
   */
  update(dt: number): void {
    // We don't restrict this by game mode here because even during intermission 
    // or game over, you might want the static vignette to remain visible.
    this.needsRedraw = true;
  }

  /**
   * Paints the radial gradient spotlight centered directly on Pacman's current coordinates.
   */
  draw(): void {
    const pacman = this.registry.getPacman();
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear the layer completely before drawing the new frame spotlight
    this.clearCanvas();

    const gradient = ctx.createRadialGradient(
      pacman.x, pacman.y, 60,
      pacman.x, pacman.y, 320
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.35, 'transparent');
    gradient.addColorStop(0.7, 'rgba(1, 8, 18, 0.5)');
    gradient.addColorStop(1, 'rgba(1, 8, 18, 0.9)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}