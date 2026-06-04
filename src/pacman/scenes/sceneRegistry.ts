import { eventBus } from "../core/EventBus.js";
import { ChaseScene } from "./ChaseScene.js";

import type { IGameScene } from "../shared/types.js";

export class SceneRegistry {
  private static instance: SceneRegistry | null = null;
  private scenes: IGameScene[] = [];
  private activeScene: IGameScene | null = null;
  private isInitialized = false;

  private constructor() {
    this.initEventListeners();
  }

  static getInstance(): SceneRegistry {
    if (!SceneRegistry.instance) {
      SceneRegistry.instance = new SceneRegistry();
    }
    return SceneRegistry.instance;
  }

  private initEventListeners(): void {
    eventBus.on("game:load", () => this.init());
  }

  private init(): void {
    if (this.isInitialized) return;
    this.scenes.push(new ChaseScene());
    this.isInitialized = true;
  }

  public loadRandomScene(): void {
    if (!this.isInitialized || this.scenes.length === 0) {
      throw new Error("[SceneRegistry] No scenes available or initialized.");
    }

    this.clearActiveScene();
    const randomIndex = Math.floor(Math.random() * this.scenes.length);
    this.activeScene = this.scenes[randomIndex];
  }

  public startActiveScene(duration: number, onComplete?: () => void): void {
    if (!this.activeScene) {
      throw new Error(
        "[SceneRegistry] Cannot start scene: No active scene loaded.",
      );
    }

    this.activeScene.start(duration, () => {
      this.clearActiveScene();
      onComplete?.();
    });
  }

  public clearActiveScene(): void {
    if (this.activeScene) {
      this.activeScene.clear();
      this.activeScene = null;
    }
  }

  public getActiveScene(): IGameScene | null {
    return this.activeScene;
  }
}
