// src/game/scenes/classicChaseScene.ts
import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import type { IGameScene } from "../interfaces.js";

export class ClassicChaseScene implements IGameScene {
  public readonly id = "classic_chase";
  private layer: CanvasLayer;
  private fontStyle: string;

  private duration: number = 0;
  private elapsedTime: number = 0;
  private onCompleteCallback: (() => void) | null = null;

  constructor() {
    this.layer = new CanvasLayer(CFG_CANVAS.canvasIds.scene);
    this.fontStyle = "Jersey-Regular";
  }

  public start(durationInSeconds: number, onComplete: () => void): void {
    this.onCompleteCallback = onComplete;
    this.duration = durationInSeconds;
    this.elapsedTime = 0;
  }

  public update(dt: number): void {
    if (this.duration <= 0) return;

    this.elapsedTime += dt;

    if (this.elapsedTime >= this.duration) {
      // Clear the viewport buffer immediately when the timeline ends
      this.clear();

      if (this.onCompleteCallback) {
        this.onCompleteCallback();
        this.onCompleteCallback = null;
      }
    }
  }

  public draw(): void {
    this.layer.clear();

    const ctx = this.layer.ctx;
    const canvas = this.layer.canvas;

    // Standard high-contrast block background placeholder
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Centered placeholder diagnostic message
    ctx.fillStyle = "rgb(255, 255, 0)";
    ctx.font = `32px ${this.fontStyle}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `INTERMISSION PLACEHOLDER (${Math.max(0, Math.ceil(this.duration - this.elapsedTime))}s)`,
      canvas.width / 2,
      canvas.height / 2,
    );
  }

  /** Force clear the active canvas layer */
  public clear(): void {
    this.layer.clear();
  }
}
