// core/GameLoop.ts
import { EngineMetrics } from "../debug/EngineMetrics.js";
import type { GameState } from "../game/GameState.svelte.js";
import type { Renderer } from "../render/Renderer.js";
import type { IUpdatable } from "../shared/types.js";

export class GameLoop {
  private gameState: GameState;
  private renderer: Renderer;
  private updatables: IUpdatable[] | null = null;

  private fps: number;
  private then: number;
  private interval: number;
  private timer: number | null = null;

  constructor(fps: number = 60, gameState: GameState, renderer: Renderer) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.fps = fps;
    this.then = performance.now();
    this.interval = 1000 / this.fps;
  }

  public setUpdatables(updatables: IUpdatable[] | null): void {
    this.updatables = updatables;
  }

  public start(): void {
    if (!this.timer) {
      this.then = performance.now();
      this.loop();
    }
  }

  public stop(): void {
    if (this.timer) {
      cancelAnimationFrame(this.timer);
      this.timer = null;
    }
  }

  private loop(): void {
    this.timer = requestAnimationFrame(() => this.loop());

    const now = performance.now();
    const delta = now - this.then;

    if (delta > this.interval) {
      this.then = now - (delta % this.interval);

      const workStartToken = EngineMetrics.startFrame();

      const mode = this.gameState.mode;
      const fixedDt = 1 / this.fps;

      const shouldUpdate =
        mode === "PLAYING" ||
        mode === "PACMAN_DEAD" ||
        mode === "LEVEL_COMPLETE";

      if (shouldUpdate) {
        this.updatables?.forEach((e) => e.update(fixedDt));
      }

      const shouldRender = mode !== "GAME_OVER";

      if (shouldRender) {
        this.renderer.render();
      }

      EngineMetrics.endFrame(workStartToken);
    }
  }
}
