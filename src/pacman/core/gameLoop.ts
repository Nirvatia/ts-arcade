import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.svelte.js";
import { eventBus } from "./eventBus.js";
import { Renderer } from "./renderer.js";

export class GameLoopTracker {
  private interval: number;
  private lastLogTime: number = performance.now();
  private frameCount: number = 0;
  private maxFrameTime: number = 0;
  private totalFrameTime: number = 0;

  constructor(fps: number) {
    this.interval = 1000 / fps;
  }

  /** Фиксация начала выполнения кадра */
  public startFrame(): number {
    this.frameCount++;
    return performance.now();
  }

  /** Фиксация окончания выполнения кадра и вывод логов */
  public endFrame(workStart: number, now: number): void {
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

/**
 * Главный игровой цикл.
 * Управляет частотой кадров, вызывает update и render.
 * Гарантирует стабильный шаг дельты времени (dt) для физики при падении FPS.
 */

export class GameLoop {
  private static instance: GameLoop;
  private gameState: GameState;
  private renderer: Renderer;
  private registry: GameRegistry;
  private tracker: GameLoopTracker; // Трекер метрик

  private fps: number;
  private then: number;
  private interval: number;
  private timer: number | null = null;

  constructor(fps: number = 60) {
    this.gameState = GameState.getInstance();
    this.renderer = Renderer.getInstance();
    this.registry = GameRegistry.getInstance();
    this.fps = fps;
    this.then = performance.now();
    this.interval = 1000 / this.fps;
    this.tracker = new GameLoopTracker(this.fps); // Инициализация
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
      this.then = performance.now(); // Фиксируем актуальное время при старте сцены
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
      // Исходное выравнивание интервала
      this.then = now - (delta % this.interval);

      // Запуск замера времени выполнения логики и рендеринга через модуль
      const workStart = this.tracker.startFrame();

      const shouldUpdate =
        this.gameState.mode === "PLAYING" ||
        this.gameState.mode === "PACMAN_DEAD";

      if (shouldUpdate) {
        const fixedDt = 1 / this.fps; // Ровно 0.01666... сек (16.67мс)
        this.registry.getAllUpdatable().forEach((e) => e.update(fixedDt));
      }

      const shouldRender =
        this.gameState.mode !== "INTERMISSION" &&
        this.gameState.mode !== "GAME_OVER";

      if (shouldRender) {
        this.renderer.render();
      }

      // Фиксация времени выполнения и логирование перенесены в модуль
      this.tracker.endFrame(workStart, now);
    }
  }
}