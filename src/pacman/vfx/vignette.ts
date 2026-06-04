import { CFG_CANVAS } from "../config/canvas.config.js";
import { GameRegistry } from "../game/GameRegistry.js";
import { WorldObject } from "../world/WorldObject.js";

import type { Updatable } from "../shared/types.js";

export class Vignette extends WorldObject implements Updatable {
  private registry: GameRegistry;

  constructor() {
    super(CFG_CANVAS.canvasIds.vignette);
    this.registry = GameRegistry.getInstance();
  }

  /**
   * Updates the VFX logic on every frame tick.
   * Since the vignette follows Pacman dynamically, it forces a redraw request.
   */
  update(dt: number): void {
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

    this.clearCanvas();

    const gradient = ctx.createRadialGradient(
      pacman.x,
      pacman.y,
      60,
      pacman.x,
      pacman.y,
      320,
    );
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.35, "transparent");
    gradient.addColorStop(0.7, "rgba(1, 8, 18, 0.5)");
    gradient.addColorStop(1, "rgba(1, 8, 18, 0.9)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}
