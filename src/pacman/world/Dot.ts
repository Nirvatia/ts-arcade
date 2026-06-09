import { eventBus } from "../core/EventBus.js";
import { WorldObject } from "./WorldObject.js";
import type { LevelContext } from "../core/LevelContext.js";
import * as PIXI from "pixi.js";

// ──────────────────────────────────────────────
// STARVED STARS
// Faint points of residual light.
// Single Graphics object — one draw call total.
// ──────────────────────────────────────────────

const DOT_BODY  = 0x8899cc;
const DOT_GLINT = 0xffffff;

export class Dot extends WorldObject {
  private dotRadius: number;
  private glintRadius: number;
  private gfx: PIXI.Graphics;

  constructor(levelContext: LevelContext) {
    super(levelContext);

    const dotSize = this.tileSize * 0.16;
    this.dotRadius = dotSize * 0.4;
    this.glintRadius = this.dotRadius * 0.4;

    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
    this.container.isRenderGroup = true;

    this.initEventListeners();
  }

  private initEventListeners(): void {
    eventBus.on("dot:eaten", () => {
      this.requestRedraw();
    });
  }

  public spawn(): void {
    this.requestRedraw();
  }

  public draw(): void {
    if (!this.needsRedraw) return;

    this.gfx.clear();

    const ts = this.tileSize;

    this.gameState.activeDots.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;

      // Body
      this.gfx.circle(cx, cy, this.dotRadius);
      this.gfx.fill({ color: DOT_BODY });

      // Glint
      this.gfx.circle(cx, cy, this.glintRadius);
      this.gfx.fill({ color: DOT_GLINT });
    });

    this.needsRedraw = false;
  }
}