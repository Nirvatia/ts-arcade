import type { IRenderer } from "../shared/types.js";
import { GameRenderer } from "./GameRenderer.js";
import { SceneRenderer } from "./SceneRenderer.js";

export class Renderer {
  private static instance: Renderer | null = null;
  private gameRenderer: GameRenderer;
  private sceneRenderer: SceneRenderer;
  private currentRenderer: IRenderer | null = null;

  private constructor() {
    this.gameRenderer = GameRenderer.getInstance();
    this.sceneRenderer = SceneRenderer.getInstance();
    this.currentRenderer = this.gameRenderer;
  }

  static getInstance(): Renderer {
    if (!Renderer.instance) {
      Renderer.instance = new Renderer();
    }
    return Renderer.instance;
  }

  public switchRenderer(mode: string): void {
    switch (mode) {
      case "INTERMISSION":
        this.currentRenderer = this.sceneRenderer;
        break;
      case "LEVEL_TRANSITION":
        this.currentRenderer = this.gameRenderer;
        break;
      case "GAME_OVER":
      default:
        this.currentRenderer = null;
        break;
    }
  }

  public render(): void {
    this.currentRenderer?.render();
  }
}
