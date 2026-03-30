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
    "GL", // <--- CRITICAL: The graph needs to know this is a valid node!
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

export {
  setCanvasSize,
  easeInOutCubic,
  findLairExit,
  createPathGraph,
  findShortestPath,
};
