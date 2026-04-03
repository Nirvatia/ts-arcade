import { CANVAS_CONFIG } from "../config/canvas.js";
import type { TileType } from "../types.js";
import { GameState } from "./state.js";

class Collision {
  private static instance: Collision;
  private gameState: GameState;
  private teleportPairs: Record<string, { x: number; y: number }> = {};
  private tileSize: number;

  constructor() {
    this.gameState = GameState.getInstance();
    this.tileSize = CANVAS_CONFIG.tile.size;
  }

  static getInstance(): Collision {
    if (!Collision.instance) {
      Collision.instance = new Collision();
    }
    return Collision.instance;
  }

  public getTile(x: number, y: number) {
    return {
      tileX: Math.floor(x / this.tileSize),
      tileY: Math.floor(y / this.tileSize),
    };
  }

  public getTileCenter(x: number, y: number) {
    return {
      centerX:
        Math.floor(x / this.tileSize) * this.tileSize + this.tileSize / 2,
      centerY:
        Math.floor(y / this.tileSize) * this.tileSize + this.tileSize / 2,
    };
  }

  // UPDATED: Added isExiting optional parameter
  public isWall(
    x: number,
    y: number,
    isExiting: boolean = false,
    isEntering: boolean = false,
  ): boolean {
    if (!this.gameState.levelData.map[y]) return true;

    const tile = this.gameState.levelData.map[y][x];

    // If the tile is GL and the ghost is currently in "exiting" mode,
    // we do not treat it as a wall.
    if (tile === "GL" && (isExiting || isEntering)) {
      return false;
    }

    const wallTiles = new Set(["WH", "WV", "TL", "TR", "BL", "BR", "GL"]);

    if (wallTiles.has(tile)) {
      return true;
    }

    return false;
  }

  public initTeleports(map: TileType[][]): void {
    const groups: Record<string, { x: number; y: number }[]> = {};

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x];
        if (tile.startsWith("0")) {
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
      }
    }
  }

  public getTeleportExit(x: number, y: number) {
    return this.teleportPairs[`${x},${y}`] || null;
  }

  public isTeleport(x: number, y: number) {
    return !!this.teleportPairs[`${x},${y}`];
  }
}

export { Collision };
