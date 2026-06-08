import { EngineMetrics } from "../debug/EngineMetrics.js";

import type { IDrawable } from "../shared/types.js";

export class Renderer {
  private drawables: IDrawable[] = [];

  public setDrawables(drawables: IDrawable[]): void {
    this.drawables = drawables;
  }

  public render(): void {
    if (this.drawables.length === 0) return;

    this.drawables.forEach((entity) => {
      if (entity.needsRedraw) {
        entity.clearCanvas();
        entity.draw();
        entity.needsRedraw = false;

        const key = entity.layer?.id || entity.constructor.name;
        EngineMetrics.recordLayerDraw(key);
      }
    });
  }

  public clear(): void {
    this.drawables.forEach((entity) => entity.clearCanvas());
  }
}
