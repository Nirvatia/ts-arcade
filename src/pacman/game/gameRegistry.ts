// game/GameRegistry.ts
import { CFG_PACMAN } from "../config/pacman.config.js";
import { CFG_CANVAS } from "../config/canvas.config.js";
import { CFG_GHOSTS } from "../config/ghost.config.js";

import { LevelContext } from "../core/LevelContext.js";
import { GridContext } from "../core/GridContext.js";
import { CanvasLayer } from "../render/CanvasLayer.js";
import { CanvasComposite } from "../render/CanvasComposite.js";
import { Ghost } from "../actors/ghost/Ghost.js";
import { Pacman } from "../actors/pacman/Pacman.js";
import { Pill } from "../world/Pill.js";
import { Dot } from "../world/Dot.js";
import { Vignette } from "../vfx/Vignette.js";
import { PixiGrid } from "../world/PixiGrid.js";
import { createPathGraph } from "../pathfinding/graph.js";

import type { GameState } from "../game/GameState.svelte.js";

export class GameRegistry {
  private readonly gameState: GameState;
  private activeLevelContext: LevelContext | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public async createLevelAsync(): Promise<LevelContext> {
    const activeGrid = this.gameState.levelData.map;
    this.gameState.pathGraph = createPathGraph(activeGrid);

    const gridContext = new GridContext(activeGrid);
    const levelContext = new LevelContext(this.gameState, gridContext);

    const tileSize = CFG_CANVAS.tile.size;

    const gridCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.grid);
    const dotsCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.dots);
    const pillsCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.pills);
    const pacmanCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.pacman);
    const vignetteCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.vignette);
    const ghostsSharedCanvasLayer = new CanvasLayer(
      CFG_CANVAS.canvasIds.ghosts,
    );

    [
      gridCanvasLayer,
      dotsCanvasLayer,
      pillsCanvasLayer,
      pacmanCanvasLayer,
      vignetteCanvasLayer,
      ghostsSharedCanvasLayer,
    ].forEach((layer) => layer.resize(tileSize, activeGrid));

    const pacman = new Pacman(pacmanCanvasLayer, levelContext, CFG_PACMAN);
    levelContext.registerPacman(pacman);

    const dot = new Dot(dotsCanvasLayer, levelContext);
    const pill = new Pill(pillsCanvasLayer, levelContext);
    const vignette = new Vignette(vignetteCanvasLayer, levelContext);

    const pixiGrid = new PixiGrid(gridCanvasLayer, levelContext);
    await pixiGrid.init();

    const ghostLayer = new CanvasComposite(ghostsSharedCanvasLayer);
    const ghosts = Object.values(CFG_GHOSTS).map(
      (config) => new Ghost(ghostsSharedCanvasLayer, levelContext, config),
    );
    ghosts.forEach((ghost) => ghostLayer.add(ghost));

    levelContext.setEnvironment(
      ghosts,
      ghostLayer,
      pixiGrid,
      dot,
      pill,
      vignette,
    );

    this.activeLevelContext = levelContext;
    return levelContext;
  }

  public async recreateEntitiesAsync(): Promise<LevelContext> {
    const activeGrid = this.gameState.levelData.map;
    this.gameState.pathGraph = createPathGraph(activeGrid);

    const gridContext = new GridContext(activeGrid);
    const levelContext = new LevelContext(this.gameState, gridContext);

    const tileSize = CFG_CANVAS.tile.size;

    const dotsCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.dots);
    const pillsCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.pills);
    const pacmanCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.pacman);
    const vignetteCanvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.vignette);
    const ghostsSharedCanvasLayer = new CanvasLayer(
      CFG_CANVAS.canvasIds.ghosts,
    );

    [
      dotsCanvasLayer,
      pillsCanvasLayer,
      pacmanCanvasLayer,
      vignetteCanvasLayer,
      ghostsSharedCanvasLayer,
    ].forEach((layer) => layer.resize(tileSize, activeGrid));

    const pacman = new Pacman(pacmanCanvasLayer, levelContext, CFG_PACMAN);
    levelContext.registerPacman(pacman);

    const dot = new Dot(dotsCanvasLayer, levelContext);
    const pill = new Pill(pillsCanvasLayer, levelContext);
    const vignette = new Vignette(vignetteCanvasLayer, levelContext);

    const oldLevel = this.activeLevelContext;
    if (!oldLevel) {
      throw new Error("No active level to reuse PixiGrid from");
    }

    const pixiGrid = oldLevel.pixiGrid;
    pixiGrid.reset();
    pixiGrid.levelContext = levelContext;

    const ghostLayer = new CanvasComposite(ghostsSharedCanvasLayer);
    const ghosts = Object.values(CFG_GHOSTS).map(
      (config) => new Ghost(ghostsSharedCanvasLayer, levelContext, config),
    );
    ghosts.forEach((ghost) => ghostLayer.add(ghost));

    levelContext.setEnvironment(
      ghosts,
      ghostLayer,
      pixiGrid,
      dot,
      pill,
      vignette,
    );

    this.activeLevelContext = levelContext;
    return levelContext;
  }

  public getActiveLevel(): LevelContext | null {
    return this.activeLevelContext;
  }
}
