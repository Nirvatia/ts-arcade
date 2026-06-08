// game/GameMain.ts
import { GameState } from "./GameState.svelte.js";
import { Tally } from "./Tally.svelte.js";
import { GameRegistry } from "./GameRegistry.js";
import { Renderer } from "../render/Renderer.js";
import { GameLoop } from "../core/GameLoop.js";
import { Director } from "./Director.svelte.js";
import { Controller } from "../controller/Controller.js";
import { SFX } from "../sfx/SFX.js";
import { CFG_SFX } from "../config/sfx.config.js";

export class GameMain {
  public readonly gameState = new GameState();
  public readonly tally = new Tally();

  private readonly gameRegistry = new GameRegistry(this.gameState);

  private readonly renderer = new Renderer();
  private readonly gameLoop = new GameLoop(60, this.gameState, this.renderer);

  public readonly director: Director;
  public readonly controller: Controller;
  public readonly sfx: SFX;

  constructor() {
    this.director = new Director(
      this.gameState,
      this.gameRegistry,
      this.tally,
      this.gameLoop,
      this.renderer,
    );

    this.sfx = new SFX(this.gameRegistry, CFG_SFX);

    this.controller = new Controller(
      this.gameState,
      this.sfx,
      () => this.gameRegistry.getActiveLevel()?.pacman ?? null,
    );
  }

  public init(): void {
    this.controller.init();
  }

  public async loadAsync(): Promise<void> {
    await this.director.loadGame();
  }

  public destroy(): void {
    this.gameLoop.stop();
    this.controller.destroy();
    this.gameRegistry.getActiveLevel()?.pixiGrid.destroy();
  }
}
