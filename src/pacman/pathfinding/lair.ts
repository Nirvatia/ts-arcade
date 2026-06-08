import type { TileType } from "../shared/types.js";

/**
 * Finds the tile directly above the ghost lair entrance ("LE") to locate the exit point.
 * @param map - 2D grid matrix of the level map
 * @returns Coordinate string formatted as "y,x"
 */
export function findLairExit(map: TileType[][]): string {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === "LE") {
        // Target the tile immediately above the lair entrance if it is not a wall
        if (y > 0 && map[y - 1][x] !== "WL" && map[y - 1][x] !== "LE") {
          return `${y - 1},${x}`;
        }
        // Fallback: use the tile to the right of the entrance
        return `${y},${x + 1}`;
      }
    }
  }
  return "9,7"; // Fallback for the standard map layout (above the lair entrance)
}

/**
 * Finds all lair tile ("LT") spaces inside the ghost lair using a Flood Fill algorithm.
 * Starts from any "LT" tile found on the map.
 * @param map - 2D grid matrix of the level map
 * @returns Array of internal coordinate strings formatted as "y,x"
 */
export function findLairInternalTiles(map: TileType[][]): string[] {
  const lairInternalTiles: string[] = [];
  const visited = new Set<string>();
  const queue: { y: number; x: number }[] = [];

  const rows = map.length;
  const cols = map[0].length;

  // 1. Locate any "LT" tile to start the flood fill
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (map[y][x] === "LT") {
        queue.push({ y, x });
        visited.add(`${y},${x}`);
        break;
      }
    }
    if (queue.length > 0) break;
  }

  // Exit early if no lair tiles found on the map
  if (queue.length === 0) return [];

  // 2. Flood Fill execution to collect all "LT" tiles within the lair walls
  const directions = [
    { dy: 1, dx: 0 }, // Down
    { dy: -1, dx: 0 }, // Up
    { dy: 0, dx: 1 }, // Right
    { dy: 0, dx: -1 }, // Left
  ];

  // Lair boundaries: walls and lair entrance block the flood fill
  const boundaryTiles = new Set<TileType>(["WL", "LE"]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentTile = map[current.y][current.x];

    // Collect all lair tiles (LT) and ghost spawn positions inside the lair
    if (currentTile === "LT" || 
        currentTile === "BY" || 
        currentTile === "PY" || 
        currentTile === "IY" || 
        currentTile === "CE") {
      lairInternalTiles.push(`${current.y},${current.x}`);
    }

    // Inspect all 4 orthogonal neighbors
    for (const { dy, dx } of directions) {
      const ny = current.y + dy;
      const nx = current.x + dx;
      const key = `${ny},${nx}`;

      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && !visited.has(key)) {
        const neighborTile = map[ny][nx];

        // Continue the fill if the neighboring tile is not a boundary
        if (!boundaryTiles.has(neighborTile)) {
          visited.add(key);
          queue.push({ y: ny, x: nx });
        }
      }
    }
  }

  return lairInternalTiles;
}

/**
 * Finds ghost spawn positions inside the lair.
 * @param map - 2D grid matrix of the level map
 * @returns Record mapping ghost names to their coordinate strings
 */
export function findGhostSpawns(map: TileType[][]): Record<string, string> {
  const spawns: Record<string, string> = {};
  
  const ghostTiles: Record<string, TileType> = {
    "blinky": "BY",
    "pinky": "PY",
    "inky": "IY",
    "clyde": "CE",
  };

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      for (const [name, tile] of Object.entries(ghostTiles)) {
        if (map[y][x] === tile) {
          spawns[name] = `${y},${x}`;
        }
      }
    }
  }

  return spawns;
}

/**
 * Finds Pac-Man's spawn position on the map.
 * @param map - 2D grid matrix of the level map
 * @returns Coordinate string formatted as "y,x" or null if not found
 */
export function findPacManSpawn(map: TileType[][]): string | null {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === "PM") {
        return `${y},${x}`;
      }
    }
  }
  return null;
}