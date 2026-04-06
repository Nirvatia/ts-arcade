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

    // 🌟 ОСТАВЛЯЕМ ЗАМОРОЗКУ ЭКРАНА: 
    // Если Пакман съел привидение, мы просто не очищаем холст и не рисуем новые кадры.
    if (gameState.mode === "GHOST_EATEN") {
      return;
    }

    const clearedCanvases = new Set<HTMLCanvasElement>();

    // Решаем, нужно ли крутить анимации (ножки привидений, рот Пакмана)
    const canAnimate = ["PLAYING", "INIT", "LEVEL_TRANSITION"].includes(gameState.mode);
    const shouldDrawDynamic = gameState.mode !== "INIT";

    // 1. Отрисовка динамических объектов
    if (shouldDrawDynamic) {
      this.entityManager.getAllDynamic().forEach((entity) => {
        if (!clearedCanvases.has(entity.canvas)) {
          entity.clearCanvas();
          clearedCanvases.add(entity.canvas);
        }
        entity.draw(canAnimate, dt); // 🌟 ТОЛЬКО DRAW
      });
    }

    // 2. Отрисовка статических объектов (Стены, еда)
    this.entityManager
      .getAllStatic()
      .filter((entity) => entity.needsRedraw)
      .forEach((entity) => {
        if (!clearedCanvases.has(entity.canvas)) {
          entity.clearCanvas();
          clearedCanvases.add(entity.canvas);
        }

        entity.draw(canAnimate, dt); // 🌟 ТОЛЬКО DRAW
        entity.needsRedraw = false;
      });
  }
}

export { Renderer };