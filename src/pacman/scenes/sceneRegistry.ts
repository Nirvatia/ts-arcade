import { eventBus } from "../core/eventBus.js";
import type { IGameScene } from "../interfaces.js";
import { ClassicChaseScene } from "./classicChaseScene.js";

export class SceneRegistry {
  private scenes: IGameScene[] = [];
  private isInitialized = false;

  constructor() {
    this.initEventListeners();
  }

  private initEventListeners() {
    eventBus.on("game:load", () => this.init());
  }

  private init(): void {
    if (this.isInitialized) return;

    this.scenes.push(new ClassicChaseScene());
    // Future scenes go here...

    this.isInitialized = true;
  }

  public getRandomScene(): IGameScene {
    if (!this.isInitialized || this.scenes.length === 0) {
      throw new Error(
        "[SceneRegistry] Attempted to get a scene before game:load event fired.",
      );
    }
    const randomIndex = Math.floor(Math.random() * this.scenes.length);
    return this.scenes[randomIndex];
  }
}
