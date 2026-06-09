import { CFG_PACMAN } from "../config/pacman.config.js";
import { CFG_GHOSTS } from "../config/ghost.config.js";

import { LevelContext } from "../core/LevelContext.js";
import { GridContext } from "../core/GridContext.js";
import { Ghost } from "../actors/ghost/Ghost.js";
import { Pacman } from "../actors/pacman/Pacman.js";
import { Pill } from "../world/Pill.js";
import { Dot } from "../world/Dot.js";
import { Vignette } from "../vfx/Vignette.js";
import { PixiGrid } from "../world/PixiGrid.js";
import { createPathGraph } from "../pathfinding/graph.js";

import type { GameState } from "../game/GameState.svelte.js";
import * as PIXI from "pixi.js";

export class GameRegistry {
  private readonly gameState: GameState;
  private activeLevelContext: LevelContext | null = null;
  private readonly stageContext: PIXI.Container;
  private readonly pixiApp: PIXI.Application;
  private levelGroupLayer: PIXI.Container | null = null;

  constructor(gameState: GameState, pixiApp: PIXI.Application) {
    this.gameState = gameState;
    this.pixiApp = pixiApp;
    this.stageContext = pixiApp.stage;
  }

  public async createLevelAsync(): Promise<LevelContext> {
    const activeGrid = this.gameState.levelData.map;
    this.gameState.pathGraph = createPathGraph(activeGrid);

    const gridContext = new GridContext(activeGrid);
    const levelContext = new LevelContext(
      this.gameState,
      gridContext,
      this.pixiApp,
    );

    if (this.levelGroupLayer) {
      this.stageContext.removeChild(this.levelGroupLayer);
      this.levelGroupLayer.destroy({ children: true });
    }

    // 1. Wipe out any existing visual layers from previous setups
    if (this.levelGroupLayer) {
      this.stageContext.removeChild(this.levelGroupLayer);
      this.levelGroupLayer.destroy({ children: true });
    }

    // 2. Initialize a base level container to host all layers
    this.levelGroupLayer = new PIXI.Container();
    this.stageContext.addChild(this.levelGroupLayer);

    // 3. Setup entities passing down level context mapping
    const pacman = new Pacman(levelContext, CFG_PACMAN);
    levelContext.registerPacman(pacman);

    const dot = new Dot(levelContext);
    const pill = new Pill(levelContext);
    const vignette = new Vignette(levelContext);

    const pixiGrid = new PixiGrid(levelContext);
    await pixiGrid.init();

    const ghosts = Object.values(CFG_GHOSTS).map(
      (config) => new Ghost(levelContext, config),
    );

    // 4. Inject layers sequentially to establish structural rendering order (Z-index stacking)
    this.levelGroupLayer.addChild(pixiGrid.container);
    this.levelGroupLayer.addChild(dot.container);
    this.levelGroupLayer.addChild(pill.container);
    this.levelGroupLayer.addChild(pacman.container);
    ghosts.forEach((g) => this.levelGroupLayer!.addChild(g.container));
    this.levelGroupLayer.addChild(vignette.container);

    levelContext.setEnvironment(ghosts, pixiGrid, dot, pill, vignette);

    this.activeLevelContext = levelContext;
    return levelContext;
  }

  public async recreateEntitiesAsync(): Promise<LevelContext> {
    return this.createLevelAsync();
  }

  public getActiveLevel(): LevelContext | null {
    return this.activeLevelContext;
  }
}
