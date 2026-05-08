// src/game/GameLoop.ts

import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.js";
import { Renderer } from "./renderer.js";

/**
 * Главный игровой цикл.
 * Управляет частотой кадров, вызывает update и render.
 */
export class GameLoop {
  private static instance: GameLoop;

  private renderer: Renderer;
  private registry: GameRegistry;

  private fps: number;
  private then: number;
  private interval: number;
  private timer: number | null = null;

  constructor(fps: number = 60) {
    this.renderer = Renderer.getInstance();
    this.registry = GameRegistry.getInstance();
    this.fps = fps;
    this.then = Date.now();
    this.interval = 1000 / this.fps;
  }

  static getInstance(): GameLoop {
    if (!GameLoop.instance) {
      GameLoop.instance = new GameLoop();
    }
    return GameLoop.instance;
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

  const now = Date.now();
  const delta = now - this.then;

  if (delta > this.interval) {
    this.then = now - (delta % this.interval);
    const gameState = GameState.getInstance();

    // THE FIX: Update entities only when playing
    if (gameState.mode === "PLAYING") {
      this.registry.getAllUpdatable().forEach((e) => e.update(delta));
    }

    // THE FIX: Still render during freeze modes so animations play
    // Render everything except INTERMISSION and GAME_OVER
    const shouldRender =
      gameState.mode !== "INTERMISSION" && gameState.mode !== "GAME_OVER";

    if (shouldRender) {
      // Pass delta even during freezes so death animations progress
      this.renderer.render(delta);
    }
  }
}
}
