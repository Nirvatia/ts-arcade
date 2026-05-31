// src/core/CanvasComposite.ts
import type { Drawable } from "../interfaces.js";
import { CanvasLayer } from "./canvasLayer.js";

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

  // Pass-through context so children can draw on this canvas
  get ctx(): CanvasRenderingContext2D {
    return this.canvasLayer.ctx;
  }

  // The group needs a redraw if ANY child inside it needs a redraw
  get needsRedraw(): boolean {
    return this.children.some((child) => child.needsRedraw);
  }

  set needsRedraw(value: boolean) {
    this.children.forEach((child) => (child.needsRedraw = value));
  }

  requestRedraw(): void {
    this.needsRedraw = true;
  }

  // Wipes the shared sheet EXACTLY ONCE per frame step
  clearCanvas(): void {
    this.canvasLayer.clear();
  }

  init(): void {
    this.children.forEach((child) => child.init?.());
  }

  reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this.children.forEach((child) => child.reset?.());
  }

  // Draws all elements sequentially onto the cleared buffer sheet
  draw(): void {
    this.children.forEach((child) => {
      child.draw();
      child.needsRedraw = false; // Reset individual child flags safely
    });
  }
}
