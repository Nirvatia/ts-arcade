import { WorldObject } from "../world/WorldObject.js";

import type { IUpdatable } from "../shared/types.js";
import type { LevelContext } from "../core/LevelContext.js";
import type { CanvasLayer } from "../render/CanvasLayer.js";

export class Vignette extends WorldObject implements IUpdatable {
  constructor(canvasLayer: CanvasLayer, levelContext: LevelContext) {
    super(canvasLayer, levelContext);
  }

  /**
   * Updates the VFX logic on every frame tick.
   * Since the vignette follows Pacman dynamically, it forces a redraw request.
   */
  public update(dt: number): void {
    this.needsRedraw = true;
  }

  /**
   * Paints the radial gradient spotlight centered directly on Pacman's current coordinates.
   */
  public draw(): void {
    const pacman = this.levelContext.pacman;
    const ctx = this.layer.ctx;
    const w = this.layer.canvas.width;
    const h = this.layer.canvas.height;

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
