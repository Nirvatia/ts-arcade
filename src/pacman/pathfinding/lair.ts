import type { TileType } from "../shared/types.js";

/**
 * Finds the tile directly above the ghost lair gate ("GL") to locate the exit point.
 * @param map - 2D grid matrix of the level map
 * @returns Coordinate string formatted as "y,x"
 */
export function findLairExit(map: TileType[][]): string {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === "GL") {
        // Target the tile immediately above the lair gate if it is not a wall
        if (y > 0 && map[y - 1][x] !== "WH" && map[y - 1][x] !== "WV") {
          return `${y - 1},${x}`;
        }
        // Fallback: use the tile to the right of the gate
        return `${y},${x + 1}`;
      }
    }
  }
  return "11,13"; // Hardcoded fallback for the standard map layout
}

/**
 * Finds all empty space tiles inside the ghost lair using a Flood Fill algorithm.
 * Starts from the tile directly below the lair gate ("GL").
 * @param map - 2D grid matrix of the level map
 * @returns Array of internal coordinate strings formatted as "y,x"
 */
export function findLairInternalTiles(map: TileType[][]): string[] {
  const lairInternalTiles: string[] = [];
  const visited = new Set<string>();
  const queue: { y: number; x: number }[] = [];

  const rows = map.length;
  const cols = map[0].length;

  // 1. Locate the gate ("GL") and queue the tile beneath it
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (map[y][x] === "GL") {
        if (y + 1 < rows) {
          queue.push({ y: y + 1, x });
          visited.add(`${y + 1},${x}`);
        }
        break;
      }
    }
    if (queue.length > 0) break;
  }

  // Exit early if no gate is found on the map
  if (queue.length === 0) return [];

  // 2. Flood Fill execution to collect empty space ("ES") tiles within the lair walls
  const directions = [
    { dy: 1, dx: 0 }, // Down
    { dy: -1, dx: 0 }, // Up
    { dy: 0, dx: 1 }, // Right
    { dy: 0, dx: -1 }, // Left
  ];

  const wallTiles = new Set<TileType>([
    "WH",
    "WV",
    "TL",
    "TR",
    "BL",
    "BR",
    "GL",
  ]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentTile = map[current.y][current.x];

    // Collect empty spaces as valid internal tiles
    if (currentTile === "ES") {
      lairInternalTiles.push(`${current.y},${current.x}`);
    }

    // Inspect all 4 orthogonal neighbors
    for (const { dy, dx } of directions) {
      const ny = current.y + dy;
      const nx = current.x + dx;
      const key = `${ny},${nx}`;

      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && !visited.has(key)) {
        const neighborTile = map[ny][nx];

        // Continue the fill if the neighboring tile is not a wall boundary
        if (!wallTiles.has(neighborTile)) {
          visited.add(key);
          queue.push({ y: ny, x: nx });
        }
      }
    }
  }

  return lairInternalTiles;
}
