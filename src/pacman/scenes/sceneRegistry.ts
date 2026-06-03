// sceneRegistry.ts - Now manages the active scene lifecycle
import { eventBus } from "../core/eventBus.js";
import { ClassicChaseScene } from "./classicChaseScene.js";
import type { IGameScene } from "../interfaces.js";

export class SceneRegistry {
  private scenes: IGameScene[] = [];
  private activeScene: IGameScene | null = null;
  private isInitialized = false;

  constructor() {
    this.initEventListeners();
  }

  private initEventListeners(): void {
    eventBus.on("game:load", () => this.init());
  }

  private init(): void {
    if (this.isInitialized) return;
    this.scenes.push(new ClassicChaseScene());
    this.isInitialized = true;
  }

  public getRandomScene(): IGameScene {
    if (!this.isInitialized || this.scenes.length === 0) {
      throw new Error("[SceneRegistry] No scenes available");
    }
    const randomIndex = Math.floor(Math.random() * this.scenes.length);
    return this.scenes[randomIndex];
  }

  public startRandomScene(duration: number, onComplete?: () => void): void {
    this.clearActiveScene();
    this.activeScene = this.getRandomScene();
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
