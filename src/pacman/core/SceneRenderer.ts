// src/renderers/SceneRenderer.ts
import type { IRenderer, IGameScene } from "../interfaces.js";

export class SceneRenderer implements IRenderer {
  private static instance: SceneRenderer | null = null;
  private activeSceneCache: IGameScene | null = null;
  private needsRender = false;

  private constructor() {}

  static getInstance(): SceneRenderer {
    if (!SceneRenderer.instance) {
      SceneRenderer.instance = new SceneRenderer();
    }
    return SceneRenderer.instance;
  }

  public setActiveScene(scene: IGameScene | null): void {
    this.activeSceneCache = scene;
    if (scene) {
      this.needsRender = true;
    }
  }

  render(): void {
    if (this.activeSceneCache && this.needsRender) {
      this.activeSceneCache.draw();
    }
  }

  clear(): void {
    if (this.activeSceneCache) {
      this.activeSceneCache.clear();
      this.activeSceneCache = null;
    }
  }

  requestRender(): void {
    this.needsRender = true;
  }
}
