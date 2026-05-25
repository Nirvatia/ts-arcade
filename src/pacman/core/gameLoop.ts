// src/game/GameLoop.ts

import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.js";
import { eventBus } from "./eventBus.js";
import { Renderer } from "./renderer.js";

/**
 * Главный игровой цикл.
 * Управляет частотой кадров, вызывает update и render.
 */
export class GameLoop {
  private static instance: GameLoop;
  private gameState: GameState;
  private renderer: Renderer;
  private registry: GameRegistry;

  private fps: number;
  private then: number;
  private interval: number;
  private timer: number | null = null;

  constructor(fps: number = 60) {
    this.gameState = GameState.getInstance();
    this.renderer = Renderer.getInstance();
    this.registry = GameRegistry.getInstance();
    this.fps = fps;
    this.then = Date.now();
    this.interval = 1000 / this.fps;
    this.initEventListeners();
  }

  static getInstance(): GameLoop {
    if (!GameLoop.instance) {
      GameLoop.instance = new GameLoop();
    }
    return GameLoop.instance;
  }

  private initEventListeners() {
    eventBus.on("game:start", () => this.start());
    eventBus.on("game:over", () => this.stop());
  }

  /** Запустить или продолжить цикл */
  start(): void {
    if (!this.timer) {
      this.loop();
    }
  }

  /** Остановить цикл */
  stop(): void {
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

      if (this.gameState.mode === "PLAYING") {
        this.registry.getAllUpdatable().forEach((e) => e.update(delta));
      }

      const shouldRender =
        this.gameState.mode !== "INTERMISSION" && this.gameState.mode !== "GAME_OVER";

      if (shouldRender) {
        this.renderer.render(delta);
      }
    }
  }
}
