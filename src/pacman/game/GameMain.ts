import { GameState } from "./GameState.svelte.js";
import { Tally } from "./Tally.svelte.js";
import { GameRegistry } from "./GameRegistry.js";
import { Renderer } from "../render/Renderer.js";
import { GameLoop } from "../core/GameLoop.js";
import { Director } from "./Director.svelte.js";
import { Controller } from "../controller/Controller.js";
import { SFX } from "../sfx/SFX.js";
import { CFG_SFX } from "../config/sfx.config.js";
import * as PIXI from "pixi.js";

export class GameMain {
  public readonly gameState = new GameState();
  public readonly tally = new Tally();

  private gameRegistry!: GameRegistry;
  private readonly renderer = new Renderer();
  private readonly gameLoop = new GameLoop(60, this.gameState, this.renderer);

  public director!: Director;
  public controller!: Controller;
  public sfx!: SFX;

  public pixiApp: PIXI.Application | null = null;

  constructor() {
    // Postponed instantiation until canvas target mounting reference exists
  }

  public async initAsync(canvasElement: HTMLCanvasElement): Promise<void> {
    // 1. Initialize Pixi application context attached onto DOM element pointer
    this.pixiApp = new PIXI.Application();
    await this.pixiApp.init({
      canvas: canvasElement,
      width: 448,
      height: 496,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
    });

    this.renderer.init(this.pixiApp);
    this.gameRegistry = new GameRegistry(this.gameState, this.pixiApp);

    // 2. Look, Ma! No 'as any'! TypeScript is perfectly happy now.
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

    this.controller.init();

    const activeLevel = this.gameRegistry.getActiveLevel();
    if (activeLevel) {
      this.gameLoop.setUpdatables(activeLevel.getAllUpdatable());
      this.renderer.setDrawables(activeLevel.getAllDrawable());
    }
  }

  public async loadAsync(): Promise<void> {
    if (!this.director) return;
    await this.director.loadGame();

    // Refresh dynamic lists following structural modifications inside Director loader
    const activeLevel = this.gameRegistry.getActiveLevel();
    if (activeLevel) {
      this.gameLoop.setUpdatables(activeLevel.getAllUpdatable());
      this.renderer.setDrawables(activeLevel.getAllDrawable());
    }
  }

  public destroy(): void {
    this.gameLoop.stop();
    this.controller?.destroy();

    if (this.pixiApp) {
      // Automatic cascading unmounts elements down the container tree nodes gracefully
      this.pixiApp.destroy(true, { children: true, texture: true });
      this.pixiApp = null;
    }
  }
}
