import { EntityManager } from "../entities/entityManager.js";
import { GameState } from "./state.js";

class Renderer {
  private static instance: Renderer | null = null;
  private entityManager = EntityManager.getInstance();

  private constructor() {}

  public static getInstance(): Renderer {
    if (!Renderer.instance) Renderer.instance = new Renderer();
    return Renderer.instance;
  }

  // Renderer.ts
  // Renderer.ts

  public render(dt?: number): void {
    const gameState = GameState.getInstance();

    // 🌟 CRITICAL: If the game is over or in intermission,
    // we exit immediately. GameState.handleGameOver() handles the final clear.
    if (gameState.mode === "INTERMISSION" || gameState.mode === "GAME_OVER") {
      return;
    }

    const clearedCanvases = new Set<HTMLCanvasElement>();

    const isPlaying = gameState.mode === "PLAYING";
    const isDead = gameState.mode === "PACMAN_DEAD";
    const isTransition = gameState.mode === "LEVEL_TRANSITION";
    const isGhostEaten = gameState.mode === "GHOST_EATEN";

    // 1. DYNAMIC ENTITIES (Pacman, Ghosts, Pills)
    this.entityManager.getAllDynamic().forEach((entity) => {
      if (!clearedCanvases.has(entity.canvas)) {
        entity.clearCanvas();
        clearedCanvases.add(entity.canvas);
      }

      // Draw if playing, dead (for animation), or during the ghost-eat freeze
      if (isPlaying || isDead || isGhostEaten) {
        entity.draw(true, dt);
      }
    });

    // 2. STATIC ENTITIES (Map, Food)
    this.entityManager.getAllStatic().forEach((entity) => {
      // We redraw static elements if needed, or during global state changes
      if (
        entity.needsRedraw ||
        isTransition ||
        isDead ||
        isPlaying ||
        isGhostEaten
      ) {
        if (!clearedCanvases.has(entity.canvas)) {
          entity.clearCanvas();
          clearedCanvases.add(entity.canvas);
        }

        // Draw static; pass 'false' to animation if just a transition
        entity.draw(isPlaying || isDead, dt);
        entity.needsRedraw = false;
      }
    });
  }
}

export { Renderer };
