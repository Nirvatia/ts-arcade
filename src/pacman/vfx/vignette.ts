// src/effects/Vignette.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { GameRegistry } from "../game/gameRegistry.js";
import type { Drawable } from "../interfaces.js";

export class Vignette implements Drawable {
  private canvasLayer: CanvasLayer;
  private registry: GameRegistry;

  public needsRedraw: boolean = true;

  constructor() {
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.vignette);
    this.registry = GameRegistry.getInstance();
  }

  get ctx(): CanvasRenderingContext2D {
    return this.canvasLayer.ctx;
  }

  requestRedraw(): void {
    this.needsRedraw = true;
  }

  clearCanvas(): void {
    this.canvasLayer.clear();
  }

  draw(): void {
    const pacman = this.registry.getPacman();
    const ctx = this.ctx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    const gradient = ctx.createRadialGradient(
      pacman.x, pacman.y, 60,
      pacman.x, pacman.y, 320
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.35, 'transparent');
    gradient.addColorStop(0.7, 'rgba(1, 8, 18, 0.5)');
    gradient.addColorStop(1, 'rgba(1, 8, 18, 0.9)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}