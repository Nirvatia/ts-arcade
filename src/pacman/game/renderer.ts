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

  public render(dt?: number): void {
    const gameState = GameState.getInstance();

    // 🔥 FULL PAUSE: If a ghost was just eaten, do not clear, do not draw, do not update.
    // This leaves the last successfully rendered frame frozen in time on the canvas!
    if (gameState.mode === "GHOST_EATEN") {
      return;
    }

    const clearedCanvases = new Set<HTMLCanvasElement>();

    const canAnimate = ["PLAYING", "INIT", "LEVEL_TRANSITION"].includes(
      gameState.mode,
    );
    const canUpdate = gameState.mode === "PLAYING";

    // --- FIX: PREVENT RENDERING UNSPAWNED ENTITIES ---
    // Moving characters (Pacman and Ghosts) have not called spawn() yet
    // when mode === "INIT". This stops them from appearing at (0, 0).
    const shouldDrawDynamic = gameState.mode !== "INIT";

    // 1. Draw all dynamic entities (Only if game has started or is transitioning)
    if (shouldDrawDynamic) {
      this.entityManager.getAllDynamic().forEach((entity) => {
        if (!clearedCanvases.has(entity.canvas)) {
          entity.clearCanvas();
          clearedCanvases.add(entity.canvas);
        }

        // Draw and optionally animate
        entity.draw(canAnimate, dt);

        // Update only if the mode allows it
        if (canUpdate) entity.update(dt);
      });
    }

    // 2. Draw all static entities if they need redraw (Walls, Food, UI)
    this.entityManager
      .getAllStatic()
      .filter((entity) => entity.needsRedraw)
      .forEach((entity) => {
        if (!clearedCanvases.has(entity.canvas)) {
          entity.clearCanvas();
          clearedCanvases.add(entity.canvas);
        }

        entity.draw(canAnimate, dt);
        entity.needsRedraw = false;

        if (canUpdate) entity.update(dt);
      });
  }
}

export { Renderer };
