import type { GraphType, TileType } from "../shared/types.js";

/**
 * Создаёт граф путей для навигации призраков.
 * Автоматически связывает любые парные телепорты (начинающиеся с "0").
 */
export function createPathGraph(map: TileType[][]): GraphType {
  if (!map || map.length === 0 || !map[0] || map[0].length === 0) {
    console.warn(
      "createPathGraph was called with an empty or uninitialized map!",
    );
    return {};
  }

  // Статические проходимые тайлы (без телепортов)
  const staticWalkable: Set<string> = new Set([
    "FD",
    "PP",
    "ES",
    "PM",
    "BY",
    "PY",
    "IY",
    "CE",
    "GL",
  ]);

  const rows = map.length;
  const cols = map[0].length;

  // Динамическая проверка: тайл проходим, если он в сете ИЛИ начинается с '0'
  const isWalkable = (y: number, x: number): boolean => {
    if (y < 0 || y >= rows || x < 0 || x >= cols) return false;
    const tile = map[y][x];
    return staticWalkable.has(tile) || tile.startsWith("0");
  };

  // Группируем телепорты по их именам, чтобы связать пары (например, обе стороны "0A")
  const teleportGroups: Record<string, { y: number; x: number }[]> = {};

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = map[y][x];
      if (tile.startsWith("0")) {
        if (!teleportGroups[tile]) {
          teleportGroups[tile] = [];
        }
        teleportGroups[tile].push({ y, x });
      }
    }
  }

  const graph: Record<string, string[]> = {};

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isWalkable(y, x)) continue;

      const nodeId = `${y},${x}`;
      graph[nodeId] = [];

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

      // ОСОБЫЙ СЛУЧАЙ: Связываем текущий телепорт с парным ему на другой стороне
      const tile = map[y][x];
      if (tile.startsWith("0")) {
        const structuralPairs = teleportGroups[tile] || [];
        if (structuralPairs.length === 2) {
          const otherSide = structuralPairs.find((t) => t.y !== y || t.x !== x);
          if (otherSide) {
            graph[nodeId].push(`${otherSide.y},${otherSide.x}`);
          }
        }
      }
    }
  }

  return graph;
}
