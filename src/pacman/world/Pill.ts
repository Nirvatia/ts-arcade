import { eventBus } from "../core/EventBus.js";
import { WorldObject } from "./WorldObject.js";
import type { LevelContext } from "../core/LevelContext.js";
import type { IUpdatable } from "../shared/types.js";
import * as PIXI from "pixi.js";

export class Pill extends WorldObject implements IUpdatable {
  private gfx: PIXI.Graphics;

  constructor(levelContext: LevelContext) {
    super(levelContext);

    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
    this.container.isRenderGroup = true;

    this.initEventListeners();
  }

  private initEventListeners(): void {
    eventBus.on("power_pill:eaten", () => this.requestRedraw());
  }

  public spawn(): void {
    this.requestRedraw();
  }

  public update(dt: number): void {
    // No animation needed for now
  }

  public draw(): void {
    if (!this.needsRedraw) return;
    this.gfx.clear();

    const activePills = this.gameState.activePills;
    if (activePills.size === 0) {
      this.needsRedraw = false;
      return;
    }

    const ts = this.tileSize;
    const radius = ts * 0.28;

    activePills.forEach((posKey) => {
      const [i, j] = posKey.split(",").map(Number);
      const cx = ts * j + ts / 2;
      const cy = ts * i + ts / 2;

      // Simple white dot
      this.gfx.circle(cx, cy, radius);
      this.gfx.fill({ color: 0xffffff, alpha: 1 });
    });

    this.needsRedraw = false;
  }
}