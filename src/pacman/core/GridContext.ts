import { CFG_CANVAS } from "../config/canvas.config.js";
import type { TeleportType, TileType } from "../shared/types.js";

interface Coords {
  x: number;
  y: number;
}

export class GridContext {
  private teleportPairs: Record<string, Coords> = {};
  private readonly tileSize: number;
  private readonly grid: TileType[][];

  constructor(grid: TileType[][]) {
    this.grid = grid;
    this.tileSize = CFG_CANVAS.tile.size;
    this.initTeleports(this.grid);
  }

  /** Checks if a tile data point qualifies as a teleport configuration type */
  private isTeleportTile(tile: TileType): tile is TeleportType {
    return typeof tile === "string" && tile.startsWith("0");
  }

  /**
   * Resolves absolute spatial pixel coordinates down to 2D grid matrix coordinates.
   */
  public getTile(x: number, y: number): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor(x / this.tileSize),
      tileY: Math.floor(y / this.tileSize),
    };
  }

  /**
   * Resolves the exact absolute center point coordinates in pixels for a given tile.
   */
  public getTileCenter(
    x: number,
    y: number,
  ): { centerX: number; centerY: number } {
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);

    return {
      centerX: tileX * this.tileSize + this.tileSize / 2,
      centerY: tileY * this.tileSize + this.tileSize / 2,
    };
  }

  /**
   * Checks if target grid coordinates map to a rigid structural wall barrier.
   * @param x - Horizontal coordinate location on the grid map
   * @param y - Vertical coordinate location on the grid map
   * @param isExiting - Bypasses ghost-house wall mechanics if the actor is leaving home
   * @param isEntering - Bypasses ghost-house wall mechanics if the actor is returning home
   */
  public isWall(
    x: number,
    y: number,
    isExiting: boolean = false,
    isEntering: boolean = false,
  ): boolean {
    if (!this.grid[y]) return true;

    const tile = this.grid[y][x];

    // Actors passing through ghost house gates do not register standard collision rules
    if (tile === "LE" && (isExiting || isEntering)) {
      return false;
    }

    // New wall tile types: WL (standard wall), LE (lair entrance wall)
    const wallTiles = new Set<TileType>(["WL", "LE"]);

    return wallTiles.has(tile);
  }

  /**
   * Checks if target grid coordinates are inside the ghost lair.
   */
  public isLair(x: number, y: number): boolean {
    if (!this.grid[y]) return false;
    const tile = this.grid[y][x];
    return tile === "LT";
  }

  /**
   * Checks if target grid coordinates are a lair entrance (ghost house door).
   */
  public isLairEntrance(x: number, y: number): boolean {
    if (!this.grid[y]) return false;
    const tile = this.grid[y][x];
    return tile === "LE";
  }

  /**
   * Checks if target grid coordinates contain a dot.
   */
  public isDot(x: number, y: number): boolean {
    if (!this.grid[y]) return false;
    const tile = this.grid[y][x];
    return tile === "DT";
  }

  /**
   * Checks if target grid coordinates contain a power pellet.
   */
  public isPowerPellet(x: number, y: number): boolean {
    if (!this.grid[y]) return false;
    const tile = this.grid[y][x];
    return tile === "PP";
  }

  /**
   * Maps out coordinate intersections for matching tracking pairs in local instance memory.
   */
  private initTeleports(map: TileType[][]): void {
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
   * Resolves target landing coordinates for matched warp arrays.
   * @returns Coords mapping to the exit location, or null if invalid
   */
  public getTeleportExit(x: number, y: number): Coords | null {
    return this.teleportPairs[`${x},${y}`] || null;
  }

  /** Verifies if targeted coordinates intersect a configured level warp point */
  public isTeleport(x: number, y: number): boolean {
    return !!this.teleportPairs[`${x},${y}`];
  }
}
