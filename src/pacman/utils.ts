import type { GraphType, TileType } from "./types.js";

function setCanvasSize(
  canvas: HTMLCanvasElement,
  BLOCK_SIZE: number,
  EXTRA_HEIGHT_FACTOR: number,
  map: TileType[][],
) {
  const rows = map.length;
  const cols = map[0]?.length || 0;

  canvas.width = cols * BLOCK_SIZE;
  canvas.height = rows * BLOCK_SIZE + BLOCK_SIZE * EXTRA_HEIGHT_FACTOR;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createPathGraph(map: TileType[][]): GraphType {
  if (!map || map.length === 0 || !map[0] || map[0].length === 0) {
    console.warn(
      "createPathGraph was called with an empty or uninitialized map!",
    );
    return {};
  }

  const walkableTiles: Set<TileType> = new Set([
    "FD",
    "PP",
    "ES",
    "PM",
    "BY",
    "PY",
    "IY",
    "CE",
    "0A",
    "GL",
  ]);

  const graph: Record<string, string[]> = {};
  const rows = map.length;
  const cols = map[0].length;

  // Вспомогательная функция для безопасной проверки координат
  const isWalkable = (y: number, x: number): boolean => {
    if (y < 0 || y >= rows || x < 0 || x >= cols) return false;
    return walkableTiles.has(map[y][x]);
  };

  // Ищем координаты телепортов "0A" для связки краев
  const teleports: { y: number; x: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (map[y][x] === "0A") teleports.push({ y, x });
    }
  }

  // Пробегаемся по всей матрице
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Если клетка непроходима (стена), пропускаем её
      if (!isWalkable(y, x)) continue;

      const nodeId = `${y},${x}`;
      graph[nodeId] = [];

      // Проверяем 4 стандартных направления (Вверх, Вниз, Влево, Вправо)
      const directions = [
        { dy: -1, dx: 0 }, // Вверх
        { dy: 1, dx: 0 }, // Вниз
        { dy: 0, dx: -1 }, // Влево
        { dy: 0, dx: 1 }, // Вправо
      ];

      for (const { dy, dx } of directions) {
        const ny = y + dy;
        const nx = x + dx;

        if (isWalkable(ny, nx)) {
          graph[nodeId].push(`${ny},${nx}`);
        }
      }

      // ОСОБЫЙ СЛУЧАЙ: Если это телепорт, связываем его со вторым телепортом
      if (map[y][x] === "0A" && teleports.length === 2) {
        const otherTeleport = teleports.find((t) => t.y !== y || t.x !== x);
        if (otherTeleport) {
          graph[nodeId].push(`${otherTeleport.y},${otherTeleport.x}`);
        }
      }
    }
  }

  return graph;
}

function findShortestPath(
  graph: GraphType,
  start: string,
  target: string,
): string[] | null {
  if (!graph || Object.keys(graph).length === 0) {
    console.error("findShortestPath failed: The graph provided is empty!");
    return null;
  }

  // Guard check to see if the start node even exists in the graph
  if (!graph[start]) {
    console.error(
      `findShortestPath failed: Start node '${start}' does not exist in the graph.`,
    );
    return null;
  }

  if (start === target) return [start];

  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parent: Record<string, string | null> = { [start]: null };

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === target) {
      // Reconstruct path from end to start
      const path: string[] = [];
      let step: string | null = current;
      while (step !== null) {
        path.unshift(step);
        step = parent[step];
      }
      return path; // Returns full path e.g. ["12,13", "12,14", "11,14"]
    }

    const neighbors = graph[current] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent[neighbor] = current;
        queue.push(neighbor);
      }
    }
  }

  return null; // No path found
}

function findLairExit(map: string[][]): string {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === "GL") {
        // Find the tile directly above the Ghost Lair tile
        // Check if y - 1 is a valid, walkable tile like 'ES' or 'FD'
        if (y > 0 && map[y - 1][x] !== "WH" && map[y - 1][x] !== "WV") {
          return `${y - 1},${x}`;
        }
        // Fallback: If above is blocked for some reason, check next to it
        return `${y},${x + 1}`;
      }
    }
  }
  return "11,13"; // Hard fallback to your current map's layout
}

function findLairInternalTiles(map: TileType[][]): string[] {
  const lairInternalTiles: string[] = [];
  const visited = new Set<string>();
  const queue: { y: number; x: number }[] = [];

  const rows = map.length;
  const cols = map[0].length;

  // 1. Dynamically find the Gate ("GL")
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (map[y][x] === "GL") {
        // Step 1 tile down to guarantee we are inside the cage
        if (y + 1 < rows) {
          queue.push({ y: y + 1, x });
          visited.add(`${y + 1},${x}`);
        }
        break;
      }
    }
    if (queue.length > 0) break;
  }

  // If there is no gate on the map, we can't find the lair
  if (queue.length === 0) return [];

  // 2. Flood Fill to collect only the "ES" tiles trapped inside the walls
  const directions = [
    { dy: 1, dx: 0 }, // Down
    { dy: -1, dx: 0 }, // Up
    { dy: 0, dx: 1 }, // Right
    { dy: 0, dx: -1 }, // Left
  ];

  // We stop expanding the moment we hit any of these wall types
  const wallTiles = new Set(["WH", "WV", "TL", "TR", "BL", "BR", "GL"]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentTile = map[current.y][current.x];

    // If it's an "ES" tile, record it as a valid landing spot
    if (currentTile === "ES") {
      lairInternalTiles.push(`${current.y},${current.x}`);
    }

    // Check all 4 adjacent neighbors
    for (const { dy, dx } of directions) {
      const ny = current.y + dy;
      const nx = current.x + dx;
      const key = `${ny},${nx}`;

      // Stay within map bounds and don't re-visit tiles
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && !visited.has(key)) {
        const neighborTile = map[ny][nx];

        // If the neighbor is NOT a wall, keep exploring!
        if (!wallTiles.has(neighborTile)) {
          visited.add(key);
          queue.push({ y: ny, x: nx });
        }
      }
    }
  }

  return lairInternalTiles;
}

export {
  setCanvasSize,
  easeInOutCubic,
  findLairExit,
  findLairInternalTiles,
  createPathGraph,
  findShortestPath,
};
