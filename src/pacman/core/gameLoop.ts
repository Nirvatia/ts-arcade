import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.svelte.js";
import { eventBus } from "./eventBus.js";
import { Renderer } from "./renderer.js";
import { Director } from "../game/director.svelte.js";
import { GameLoopTracker } from "../debug/gameLoopTracker.js";

/**
 * Главный игровой цикл.
 * Управляет частотой кадров, вызывает update и render.
 * Гарантирует стабильный шаг дельты времени (dt) для физики при падении FPS.
 */
export class GameLoop {
  private static instance: GameLoop;
  private director: Director;
  private gameState: GameState;
  private renderer: Renderer;
  private registry: GameRegistry;
  private tracker: GameLoopTracker;

  private fps: number;
  private then: number;
  private interval: number;
  private timer: number | null = null;

  constructor(fps: number = 60) {
    this.director = Director.getInstance();
    this.gameState = GameState.getInstance();
    this.renderer = Renderer.getInstance();
    this.registry = GameRegistry.getInstance();
    this.fps = fps;
    this.then = performance.now();
    this.interval = 1000 / this.fps;
    this.tracker = new GameLoopTracker(this.fps);
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
      this.then = performance.now();
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
      const workStart = this.tracker.startFrame();

      const mode = this.gameState.mode;
      const fixedDt = 1 / this.fps;

      // --- LOGIC PROCESSOR ---
      if (mode === "PLAYING" || mode === "PACMAN_DEAD") {
        this.registry.getAllUpdatable().forEach((e) => e.update(fixedDt));
      } else if (mode === "INTERMISSION") {
        const activeScene = this.director.currentIntermissionScene;
        if (activeScene) {
          activeScene.update(fixedDt);
        }
      }

      // --- RENDER PIPELINE ---
      const shouldRender = mode !== "GAME_OVER";

      if (shouldRender) {
        if (mode === "INTERMISSION") {
          const activeScene = this.director.currentIntermissionScene;
          if (activeScene) {
            activeScene.draw();
          }
        } else {
          this.renderer.render();
        }
      }

      //this.tracker.endFrame(workStart);
    }
  }
}
