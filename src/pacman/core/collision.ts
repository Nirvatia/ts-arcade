// src/world/Collision.ts
import { CFG_CANVAS } from "../config/canvas.js";
import { GameState } from "../game/gameState.js";
import type { TileType, TeleportType } from "../types.js";

interface Coords {
  x: number;
  y: number;
}

/**
 * Статический класс для проверки коллизий и навигации по карте.
 * Все методы статические, не требует создания экземпляра.
 * Использует GameState для доступа к текущей карте уровня.
 */
export class Collision {
  private static teleportPairs: Record<string, Coords> = {};
  private static tileSize: number = CFG_CANVAS.tile.size;

  private constructor() {
    // Запрещаем создание экземпляра
  }

  /** Проверка: является ли тайл телепортом */
  private static isTeleportTile(tile: TileType): tile is TeleportType {
    return typeof tile === "string" && tile.startsWith("0");
  }

  /**
   * Получить координаты тайла по пиксельным координатам.
   * @returns объект с tileX и tileY
   */
  static getTile(x: number, y: number): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor(x / this.tileSize),
      tileY: Math.floor(y / this.tileSize),
    };
  }

  /**
   * Получить центр тайла, в котором находится точка (x, y).
   * @returns объект с centerX и centerY
   */
  static getTileCenter(x: number, y: number): { centerX: number; centerY: number } {
    return {
      centerX: Math.floor(x / this.tileSize) * this.tileSize + this.tileSize / 2,
      centerY: Math.floor(y / this.tileSize) * this.tileSize + this.tileSize / 2,
    };
  }

  /**
   * Проверка: является ли тайл стеной.
   * @param x - координата тайла X
   * @param y - координата тайла Y
   * @param isExiting - флаг выхода из логова призраков (игнорирует GL)
   * @param isEntering - флаг входа в логово (игнорирует GL)
   */
  static isWall(
    x: number,
    y: number,
    isExiting: boolean = false,
    isEntering: boolean = false,
  ): boolean {
    const map = GameState.getInstance().levelData.map;
    if (!map[y]) return true;

    const tile = map[y][x];

    // Призраки могут проходить через ворота логова при выходе/входе
    if (tile === "GL" && (isExiting || isEntering)) {
      return false;
    }

    const wallTiles = new Set<TileType>(["WH", "WV", "TL", "TR", "BL", "BR", "GL"]);
    return wallTiles.has(tile);
  }

  /**
   * Инициализация пар телепортов на основе карты.
   * Вызывается при загрузке уровня.
   */
  static initTeleports(map: TileType[][]): void {
    this.teleportPairs = {};
    const groups: Record<string, Coords[]> = {};

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x];
        if (this.isTeleportTile(tile)) {
          const id = tile.slice(1);
          if (!groups[id]) groups[id] = [];
          groups[id].push({ x, y });
        }
      }
    }

    for (const id in groups) {
      const [a, b] = groups[id];
      if (a && b) {
        this.teleportPairs[`${a.x},${a.y}`] = b;
        this.teleportPairs[`${b.x},${b.y}`] = a;
      } else {
        console.warn(`Teleport with ID "0${id}" has no pair on the map!`);
      }
    }
  }

  /**
   * Получить координаты выхода из телепорта.
   * @returns точка выхода или null
   */
  static getTeleportExit(x: number, y: number): Coords | null {
    return this.teleportPairs[`${x},${y}`] || null;
  }

  /**
   * Проверка: находится ли тайл на позиции телепорта.
   */
  static isTeleport(x: number, y: number): boolean {
    return !!this.teleportPairs[`${x},${y}`];
  }
}