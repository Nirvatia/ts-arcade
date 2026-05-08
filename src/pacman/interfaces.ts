// src/core/interfaces/Drawable.ts
export interface Drawable {
  needsRedraw: boolean;
  draw(animate: boolean, dt?: number): void;
  requestRedraw(): void;
}

export interface Updatable extends Drawable {
  update(dt: number): void;
}

// src/core/interfaces/Collectible.ts
export interface Collectible {
  spawn(): void;
  eat(i: number, j: number): void;
}
