// src/world/Environment.ts

import { createPathGraph } from "../utils.js";
import type { TileType } from "../types.js";
import { GameState } from "../game/gameState.js";
import { GameRegistry } from "../game/gameRegistry.js";
import { Collision } from "../core/collision.js";

/**
 * Управляет созданием графа лабиринта для навигации призраков,
 * а также инициализацией декораций (точек, пилюль, телепортов, лабиринта).
 */
export class Environment {
  private static instance: Environment;

  private constructor() {}

  static getInstance(): Environment {
    if (!Environment.instance) {
      Environment.instance = new Environment();
    }
    return Environment.instance;
  }

  /**
   * Полная настройка окружения для текущего уровня:
   * - Создание графа путей
   * - Инициализация телепортов
   * - Спавн точек, пилюль, лабиринта
   */
  setup(): void {
    const gameState = GameState.getInstance();
    const registry = GameRegistry.getInstance();

    // 1. Граф путей для призраков
    gameState.pathGraph = createPathGraph(gameState.levelData.map);

    // 2. Телепорты
    Collision.initTeleports(gameState.levelData.map);

    // 3. Декорации
    registry.spawnObjects();
  }

  /**
   * Обновить граф путей (при смене уровня).
   */
  updatePathGraph(): void {
    const gameState = GameState.getInstance();
    gameState.pathGraph = createPathGraph(gameState.levelData.map);
  }
}