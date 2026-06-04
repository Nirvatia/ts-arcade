import type { Drawable } from "../shared/types.js";
import { CanvasLayer } from "./CanvasLayer.js";

export class CanvasComposite implements Drawable {
  public readonly canvasId: string;
  private canvasLayer: CanvasLayer;
  private children: Drawable[] = [];

  constructor(canvasId: string) {
    this.canvasId = canvasId;
    this.canvasLayer = new CanvasLayer(canvasId);
  }

  public add(child: Drawable): void {
    this.children.push(child);
  }

  get ctx(): CanvasRenderingContext2D {
    return this.canvasLayer.ctx;
  }

  get needsRedraw(): boolean {
    return this.children.some((child) => child.needsRedraw);
  }

  set needsRedraw(value: boolean) {
    this.children.forEach((child) => (child.needsRedraw = value));
  }

  public requestRedraw(): void {
    this.needsRedraw = true;
  }

  public clearCanvas(): void {
    this.canvasLayer.clear();
  }

  public init(): void {
    this.children.forEach((child) => child.init?.());
  }

  public reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this.children.forEach((child) => child.reset?.());
  }

  public draw(): void {
    this.children.forEach((child) => {
      child.draw();
      child.needsRedraw = false;
    });
  }
}
