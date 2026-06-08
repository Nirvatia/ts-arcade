import type { IDrawable, TileType } from "../shared/types.js";
import { CanvasLayer } from "./CanvasLayer.js";

export class CanvasComposite implements IDrawable {
  private canvasLayer: CanvasLayer;
  private children: IDrawable[] = [];

  constructor(canvasLayer: CanvasLayer) {
    this.canvasLayer = canvasLayer;
  }

  public get layer(): CanvasLayer {
    return this.canvasLayer;
  }

  public get canvasId(): string {
    return this.canvasLayer.id;
  }

  public add(child: IDrawable): void {
    this.children.push(child);
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

  public resize(tileSize: number, grid: TileType[][]): void {
    this.canvasLayer.resize(tileSize, grid);
  }

  public clearCanvas(): void {
    this.canvasLayer.clear();
  }

  public draw(): void {
    this.children.forEach((child) => {
      if (child.needsRedraw) {
        child.draw();
        child.needsRedraw = false;
      }
    });
  }
}
