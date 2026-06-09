import { WorldObject } from "../world/WorldObject.js";
import type { IUpdatable } from "../shared/types.js";
import type { LevelContext } from "../core/LevelContext.js";
import * as PIXI from "pixi.js";

export class Vignette extends WorldObject implements IUpdatable {
  private overlayGfx: PIXI.Graphics;

  constructor(levelContext: LevelContext) {
    super(levelContext);

    this.overlayGfx = new PIXI.Graphics();
    this.container.addChild(this.overlayGfx);

    this.container.blendMode = "multiply";
  }

  /**
   * Updates the VFX layer placement on every engine frame loop.
   */
  public update(dt: number): void {
    this.container.visible = false;
    this.container.visible = true;

    const pacman = this.levelContext.pacman;
    if (!pacman) return;

    this.overlayGfx.x = pacman.x;
    this.overlayGfx.y = pacman.y;

    this.needsRedraw = true;
  }

  /**
   * Compiles the radial cutout spotlight look.
   */
  public draw(): void {
    const mapWidth = this.levelContext.gridContext.pixelWidth;
    const mapHeight = this.levelContext.gridContext.pixelHeight;

    this.overlayGfx.clear();

    const spotlightRadius = 140;
    const outerVoidRadius = 400;

    const vignetteGrad = new PIXI.FillGradient({
      type: "radial",
      center: { x: 0, y: 0 },
      innerRadius: spotlightRadius,
      outerCenter: { x: 0, y: 0 },
      outerRadius: outerVoidRadius,
      colorStops: [
        { offset: 0, color: "rgba(255, 255, 255, 1)" },
        { offset: 0.1, color: "rgba(255, 255, 255, 1)" },
        { offset: 0.7, color: "rgba(2, 12, 28, 0.4)" },
        { offset: 1, color: "rgba(2, 12, 28, 1)" },
      ],
    });

    const giantCoverage = Math.max(mapWidth, mapHeight) * 4;

    this.overlayGfx.fill(vignetteGrad);
    this.overlayGfx.rect(
      -giantCoverage / 2,
      -giantCoverage / 2,
      giantCoverage,
      giantCoverage,
    );

    this.needsRedraw = false;
  }
}
