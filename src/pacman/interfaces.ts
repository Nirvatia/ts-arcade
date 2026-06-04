export interface Drawable {
  readonly canvasId: string;
  ctx: CanvasRenderingContext2D;
  needsRedraw: boolean;
  draw(): void;
  requestRedraw(): void;
  clearCanvas(): void;
  init(): void;
  reset(): void;
}

export interface Updatable extends Drawable {
  update(dt: number): void;
}

export interface Collectible {
  spawn(): void;
  collect(i: number, j: number): void;
}

export interface IGameScene {
  id: string;
  start(durationInSeconds: number, onComplete: () => void): void;
  update(dt: number): void;
  draw(): void;
  clear(): void;
}

export interface IRenderer {
  render(): void;
  clear(): void;
}
