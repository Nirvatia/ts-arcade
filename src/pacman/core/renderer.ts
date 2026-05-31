// src/game/Renderer.ts
import { RenderTracker } from "../debug/renderTracker.js";
import { GameRegistry } from "../game/gameRegistry.js";

export class Renderer {
  private static instance: Renderer | null = null;
  private registry: GameRegistry;
  private tracker: RenderTracker;

  private constructor() {
    this.registry = GameRegistry.getInstance();
    this.tracker = RenderTracker.getInstance();
  }

  static getInstance(): Renderer {
    if (!Renderer.instance) {
      Renderer.instance = new Renderer();
    }
    return Renderer.instance;
  }

  render(): void {
    this.registry.getAllDrawable().forEach((entity) => {
      if (entity.needsRedraw) {
        entity.clearCanvas();
        entity.draw();
        entity.needsRedraw = false;

        const key = entity.canvasId || entity.constructor.name;
        this.tracker.recordDraw(key);
      }
    });

    this.tracker.processMetrics();
  }
}
