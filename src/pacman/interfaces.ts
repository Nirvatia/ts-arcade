export interface Drawable {
  needsRedraw: boolean;
  draw(): void;
  requestRedraw(): void;
}

export interface Updatable extends Drawable {
  update(dt: number): void;
}

export interface Collectible {
  spawn(): void;
  collect(i: number, j: number): void;
}
