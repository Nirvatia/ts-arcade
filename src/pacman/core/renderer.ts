// src/game/Renderer.ts

import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.js";

/**
 * Отрисовщик всех игровых объектов.
 * Разделяет логику: динамические обновляются и рисуются каждый кадр,
 * статические — только при необходимости (по флагу needsRedraw).
 */
export class Renderer {
  private static instance: Renderer | null = null;
  private registry: GameRegistry;

  private constructor() {
    this.registry = GameRegistry.getInstance();
  }

  static getInstance(): Renderer {
    if (!Renderer.instance) {
      Renderer.instance = new Renderer();
    }
    return Renderer.instance;
  }

  /**
   * Главный метод рендеринга. Вызывается из GameLoop на каждом кадре.
   * @param dt - дельта времени между кадрами
   */
  render(dt?: number): void {
    const gameState = GameState.getInstance();

    if (gameState.mode === "INTERMISSION" || gameState.mode === "GAME_OVER") {
      return;
    }

    const clearedCanvases = new Set<HTMLCanvasElement>();

    const mode = gameState.mode;
    const isPlaying = mode === "PLAYING";
    const isFrozen = mode === "PACMAN_DEAD" || mode === "GHOST_EATEN";
    const isTransition = mode === "LEVEL_TRANSITION";

    // THE FIX: Only animate during PLAYING.
    // During freeze modes (DEAD, GHOST_EATEN) draw but don't animate.
    const shouldAnimate = isPlaying;

    // 1. DYNAMIC ENTITIES (Pacman, Ghosts, Pills)
    this.registry.getAllUpdatable().forEach((entity) => {
      const canvas = (entity as any).canvas as HTMLCanvasElement | undefined;

      if (canvas && !clearedCanvases.has(canvas)) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        clearedCanvases.add(canvas);
      }

      if (isPlaying || isFrozen) {
        // THE FIX: Pass shouldAnimate (false during freeze) but still pass dt
        // so death animation can progress frame count if needed
        entity.draw(shouldAnimate, dt);
      }
    });

    // 2. STATIC ENTITIES (Maze, Dots)
    this.registry.getAllDrawable().forEach((entity) => {
      if (entity.needsRedraw || isTransition || isFrozen || isPlaying) {
        const canvas = (entity as any).canvas as HTMLCanvasElement | undefined;

        if (canvas && !clearedCanvases.has(canvas)) {
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          clearedCanvases.add(canvas);
        }

        // Static entities don't animate during freeze either
        entity.draw(shouldAnimate, dt);
        entity.needsRedraw = false;
      }
    });
  }
}
