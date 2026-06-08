export class CanvasLayer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _id: string;

  constructor(layerId: string) {
    this._id = layerId;

    const canvas = document.getElementById(layerId) as HTMLCanvasElement | null;
    if (!canvas) {
      throw new Error(`Canvas with id "${layerId}" not found in DOM.`);
    }
    this._canvas = canvas;
    // Don't auto-grab the 2D context here anymore!
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  /** Lazy-load the 2D context only when accessed by traditional objects */
  get ctx(): CanvasRenderingContext2D {
    if (!this._ctx) {
      const context = this._canvas.getContext("2d");
      if (!context) {
        throw new Error(`Failed to get 2D context for canvas "${this._id}".`);
      }
      this._ctx = context;
    }
    return this._ctx;
  }

  get id(): string {
    return this._id;
  }

  public clear(
    x: number = 0,
    y: number = 0,
    width: number = this._canvas.width,
    height: number = this._canvas.height,
  ): void {
    // Only use clearRect if the 2D context was actually instantiated
    if (this._ctx) {
      this._ctx.clearRect(x, y, width, height);
    }
  }

  public resize(tileSize: number, grid: string[][]): void {
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    const computedWidth = cols * tileSize;
    const computedHeight = rows * tileSize;

    this._canvas.width = computedWidth;
    this._canvas.height = computedHeight;

    this._canvas.style.width = `${computedWidth}px`;
    this._canvas.style.height = `${computedHeight}px`;
  }
}