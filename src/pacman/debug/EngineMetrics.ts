import { GameLoopTracker } from "./GameLoopTracker.js";
import { RenderTracker } from "./RenderTracker.js";

export class EngineMetrics {
  public static readonly ENABLED = false;

  private static loopTracker = new GameLoopTracker(60);
  private static renderTracker = new RenderTracker();

  public static startFrame(): number {
    return this.ENABLED ? this.loopTracker.startFrame() : 0;
  }

  public static endFrame(token: number): void {
    if (!this.ENABLED) return;
    this.loopTracker.endFrame(token);
    this.renderTracker.processMetrics();
  }

  public static recordLayerDraw(layerId: string): void {
    if (!this.ENABLED) return;
    this.renderTracker.recordDraw(layerId);
  }
}
