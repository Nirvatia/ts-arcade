import { RenderTracker } from "../debug/renderTracker.js";
import type { Drawable, IRenderer } from "../interfaces.js";

export class GameRenderer implements IRenderer {
  private static instance: GameRenderer | null = null;
  private tracker: RenderTracker;
  private drawables: Drawable[] | null = null;

  private constructor() {
    this.tracker = RenderTracker.getInstance();
  }

  static getInstance(): GameRenderer {
    if (!GameRenderer.instance) {
      GameRenderer.instance = new GameRenderer();
    }
    return GameRenderer.instance;
  }

  public setDrawables(drawables: Drawable[] | null): void {
    this.drawables = drawables;
  }

  render(): void {
    this.drawables?.forEach((entity) => {
      if (entity.needsRedraw) {
        entity.clearCanvas();
        entity.draw();
        entity.needsRedraw = false;

        const key = entity.canvasId || entity.constructor.name;
        this.tracker.recordDraw(key);
      }
    });
  }

  clear(): void {
    this.drawables?.forEach((e) => e.clearCanvas());
  }
}
