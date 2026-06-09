import { EngineMetrics } from "../debug/EngineMetrics.js";
import type { IDrawable } from "../shared/types.js";
import * as PIXI from "pixi.js";

export class Renderer {
  private drawables: IDrawable[] = [];
  private pixiApp: PIXI.Application | null = null;

  public init(pixiApp: PIXI.Application): void {
    this.pixiApp = pixiApp;
  }

  public setDrawables(drawables: IDrawable[]): void {
    this.drawables = drawables;
  }

  public render(): void {
    if (this.drawables.length === 0 || !this.pixiApp) return;

    this.drawables.forEach((entity) => {
      if (entity.needsRedraw) {
        // Enforce geometry regeneration or transform calculation modifications
        entity.draw();
        entity.needsRedraw = false;

        const key = entity.constructor.name;
        EngineMetrics.recordLayerDraw(key);
      }
    });

    // Explicitly force Pixi application canvas element re-draw iteration
    this.pixiApp.render();
  }

  public clear(): void {
    // With Pixi, clearing layers is handled automatically by the canvas step or by clearing Graphics contexts
    this.drawables.forEach((entity) => {
      entity.needsRedraw = true;
    });
  }
}