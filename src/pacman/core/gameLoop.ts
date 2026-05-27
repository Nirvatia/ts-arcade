// src/game/GameLoop.ts

import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.js";
import { eventBus } from "./eventBus.js";
import { Renderer } from "./renderer.js";

/**
 * Главный игровой цикл.
 * Управляет частотой кадров, вызывает update и render.
 * Включает встроенный мониторинг производительности (FPS, утечки памяти, дропы кадров).
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

  // --- Метрики производительности ---
  private lastLogTime: number = performance.now();
  private frameCount: number = 0;
  private maxFrameTime: number = 0;
  private totalFrameTime: number = 0;

  constructor(fps: number = 60) {
    this.gameState = GameState.getInstance();
    this.renderer = Renderer.getInstance();
    this.registry = GameRegistry.getInstance();
    this.fps = fps;
    this.then = performance.now();
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
    eventBus.on("game:load", () => this.start());
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
      this.frameCount++;

      // Запуск замера времени выполнения логики и рендеринга
      const workStart = performance.now();

      if (this.gameState.mode === "PLAYING") {
        const dt = delta / 1000;
        this.registry.getAllUpdatable().forEach((e) => e.update(dt));
      }

      const shouldRender =
        this.gameState.mode !== "INTERMISSION" &&
        this.gameState.mode !== "GAME_OVER";

      if (shouldRender) {
        this.renderer.render(delta);
      }

      // Фиксация времени выполнения кадра
      const workDuration = performance.now() - workStart;
      this.totalFrameTime += workDuration;
      if (workDuration > this.maxFrameTime) {
        this.maxFrameTime = workDuration;
      }

      // Мгновенное предупреждение, если вычисления вышли за лимит интервала кадров
      if (workDuration > this.interval) {
        console.warn(
          `[Perf Drop] Frame work took ${workDuration.toFixed(2)}ms (Budget: ${this.interval.toFixed(2)}ms)`,
        );
      }

      // Вывод агрегированных логов раз в секунду
      if (now - this.lastLogTime >= 1000) {
        const elapsedSeconds = (now - this.lastLogTime) / 1000;
        const actualFps = Math.round(this.frameCount / elapsedSeconds);
        const avgFrameTime = this.totalFrameTime / this.frameCount;

        let memoryLog = "N/A (Non-Chromium)";
        const perfMem = (performance as any).memory;
        if (perfMem) {
          memoryLog = `${(perfMem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`;
        }

        console.log(
          `[Engine Performance] FPS: ${actualFps} | Avg Work: ${avgFrameTime.toFixed(2)}ms | Max Spike: ${this.maxFrameTime.toFixed(2)}ms | Heap: ${memoryLog}`,
        );

        // Сброс счетчиков для следующей секунды
        this.lastLogTime = now;
        this.frameCount = 0;
        this.maxFrameTime = 0;
        this.totalFrameTime = 0;
      }
    }
  }
}
