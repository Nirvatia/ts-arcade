// GameLoop.ts
import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.svelte.js";
import { eventBus } from "./eventBus.js";
import { Renderer } from "./renderer.js";
import { Director } from "../game/director.svelte.js";
import { SceneRegistry } from "../scenes/sceneRegistry.js";
import { GameLoopTracker } from "../debug/gameLoopTracker.js";

/**
 * Main game loop.
 * Manages frame rate, calls update and render.
 * Guarantees stable delta time for physics when FPS drops.
 */
export class GameLoop {
  private static instance: GameLoop;
  private director: Director;
  private gameState: GameState;
  private renderer: Renderer;
  private registry: GameRegistry;
  private sceneRegistry: SceneRegistry;
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
    this.sceneRegistry = new SceneRegistry();
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

  /** Start or resume the loop */
  start(): void {
    if (!this.timer) {
      this.then = performance.now();
      this.loop();
    }
  }

  /** Stop the loop */
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

      // --- LOGIC UPDATE ---
      if (mode === "PLAYING" || mode === "PACMAN_DEAD") {
        this.registry.getAllUpdatable().forEach((e) => e.update(fixedDt));
      } else if (mode === "INTERMISSION") {
        const activeScene = this.sceneRegistry.getActiveScene();
        if (activeScene?.update) {
          activeScene.update(fixedDt);
        }
      }

      // --- RENDER PIPELINE ---
      const shouldRender = mode !== "GAME_OVER";

      if (shouldRender) {
        if (mode === "INTERMISSION") {
          const activeScene = this.sceneRegistry.getActiveScene();
          if (activeScene?.draw) {
            activeScene.draw();
          }
        } else {
          this.renderer.render();
        }
      }

      this.tracker.endFrame(workStart);
    }
  }
}
