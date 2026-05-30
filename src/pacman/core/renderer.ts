// src/game/Renderer.ts
import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.svelte.js";

/**
 * Отрисовщик всех игровых объектов.
 * Полностью избавлен от выделения памяти (Garbage Collection Free) во время игрового цикла.
 */
export class Renderer {
  private static instance: Renderer | null = null;
  private gameState: GameState;
  private registry: GameRegistry;

  // Кэшированный экземпляр Set, выделяемый в памяти ОДИН раз при запуске игры
  private clearedContexts: Set<CanvasRenderingContext2D> = new Set();

  private constructor() {
    this.gameState = GameState.getInstance();
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
   */
  render(): void {
    const mode = this.gameState.mode;
    
    if (mode === "INTERMISSION" || mode === "GAME_OVER") {
      return;
    }

    const isPlaying = mode === "PLAYING";
    const isFrozen = mode === "PACMAN_DEAD" || mode === "GHOST_EATEN";
    const isTransition = mode === "LEVEL_TRANSITION";

    // Очищаем существующий Set вместо создания нового. Мусор не генерируется!
    this.clearedContexts.clear();

    // 1. DYNAMIC ENTITIES (Pacman, Ghosts, Pills)
    if (isPlaying || isFrozen) {
      this.registry.getAllUpdatable().forEach((entity) => {
        const ctx = entity.ctx;

        if (!this.clearedContexts.has(ctx)) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          this.clearedContexts.add(ctx);
        }
        
        entity.draw();
      });
    }

    // 2. STATIC ENTITIES (Maze, Dots)
    this.registry.getAllDrawable().forEach((entity) => {
      if (entity.needsRedraw || isTransition || isFrozen || isPlaying) {
        const ctx = entity.ctx;

        if (!this.clearedContexts.has(ctx)) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          this.clearedContexts.add(ctx);
        }

        entity.draw();
        entity.needsRedraw = false;
      }
    });
  }
}