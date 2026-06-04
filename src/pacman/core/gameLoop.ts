// src/core/gameLoop.ts
import { GameState } from "../game/gameState.svelte.js";
import { GameLoopTracker } from "../debug/gameLoopTracker.js";
import { Renderer } from "./renderer.js";
import type { IGameScene, Updatable } from "../interfaces.js";

export class GameLoop {
  private static instance: GameLoop;
  private gameState: GameState;
  private renderer: Renderer;
  private activeScene: IGameScene | null = null;
  private tracker: GameLoopTracker;
  private updatables: Updatable[] | null = null;

  private fps: number;
  private then: number;
  private interval: number;
  private timer: number | null = null;

  constructor(fps: number = 60) {
    this.gameState = GameState.getInstance();
    this.renderer = Renderer.getInstance();
    this.fps = fps;
    this.then = performance.now();
    this.interval = 1000 / this.fps;
    this.tracker = new GameLoopTracker(this.fps);
  }

  static getInstance(): GameLoop {
    if (!GameLoop.instance) {
      GameLoop.instance = new GameLoop();
    }
    return GameLoop.instance;
  }

  public setUpdatables(updatables: Updatable[] | null): void {
    this.updatables = updatables;
  }

  public setActiveScene(scene: IGameScene | null): void {
    this.activeScene = scene;
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
      const workStart = this.tracker.startFrame();

      const mode = this.gameState.mode;
      const fixedDt = 1 / this.fps;

      // --- LOGIC UPDATE ---
      if (mode === "PLAYING" || mode === "PACMAN_DEAD") {
        this.updatables?.forEach((e) => e.update(fixedDt));
      } else if (mode === "INTERMISSION" && this.activeScene) {
        this.activeScene.update(fixedDt);
      }

      // --- RENDER PIPELINE ---
      if (mode !== "GAME_OVER") {
        this.renderer.render();
      }

      //this.tracker.endFrame(workStart);
    }
  }
}
