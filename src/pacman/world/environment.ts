// src/world/Environment.ts

import { createPathGraph } from "../utils.js";
import { GameState } from "../game/gameState.svelte.js";
import { GameRegistry } from "../game/gameRegistry.js";
import { Collision } from "../core/collision.js";
import { eventBus } from "../core/eventBus.js";

/**
 * Manages the generation of the maze graph configuration,
 * teleport coordinate calculations, and level structural spawns.
 */
export class Environment {
  private static instance: Environment;
  private gameState: GameState;
  private registry: GameRegistry;

  private constructor() {
    this.gameState = GameState.getInstance();
    this.registry = GameRegistry.getInstance();
    this.initEventListeners();
  }

  static getInstance(): Environment {
    if (!Environment.instance) {
      Environment.instance = new Environment();
    }
    return Environment.instance;
  }

  private initEventListeners(): void {
    eventBus.on("command:setup_environment", () => this.setup());
  }


  setup(): void {
    const map = this.gameState.levelData.map;

    // 1. Build navigation path node definitions for AI routing paths
    this.gameState.pathGraph = createPathGraph(map);

    // 2. Refresh physical teleport wrap boundaries
    Collision.initTeleports(map);

    // 3. Command specific world components to read map grids and build instances
    const mazeLayer = this.registry.getMaze();
    const dotLayer = this.registry.getDots();
    const pillLayer = this.registry.getPills();

    // Prepare structural canvas sheets for sizing transformations
    mazeLayer.reset();
    dotLayer.reset();
    pillLayer.reset();

    // Spawn elements from map configuration matrix coordinates
    dotLayer.spawn();
    pillLayer.spawn();
    
    // Flag elements to trigger initial rendering cycles
    mazeLayer.requestRedraw();
    dotLayer.requestRedraw();
    pillLayer.requestRedraw();
  }

  /**
   * Safe operational utility hook for ad-hoc runtime modifications
   */
  updatePathGraph(): void {
    this.gameState.pathGraph = createPathGraph(this.gameState.levelData.map);
  }
}