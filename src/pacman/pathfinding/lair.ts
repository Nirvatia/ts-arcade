import type { TileType } from "../types.js";

/**
 * Находит выход из логова призраков (тайл над "GL").
 *
 * @param map - двумерный массив тайлов карты
 * @returns координаты выхода в формате "y,x"
 */
export function findLairExit(map: string[][]): string {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === "GL") {
        // Ищем тайл непосредственно над воротами логова
        if (y > 0 && map[y - 1][x] !== "WH" && map[y - 1][x] !== "WV") {
          return `${y - 1},${x}`;
        }
        // Запасной вариант: справа от ворот
        return `${y},${x + 1}`;
      }
    }
  }
  return "11,13"; // Жёсткий fallback для стандартной карты
}

/**
 * Находит все внутренние тайлы логова призраков (для случайного перемещения).
 * Использует Flood Fill от тайла под воротами "GL".
 *
 * @param map - двумерный массив тайлов карты
 * @returns массив координат внутренних тайлов в формате "y,x"
 */
export function findLairInternalTiles(map: TileType[][]): string[] {
  const lairInternalTiles: string[] = [];
  const visited = new Set<string>();
  const queue: { y: number; x: number }[] = [];

  const rows = map.length;
  const cols = map[0].length;

  // 1. Находим ворота ("GL") и стартуем с тайла под ними
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

  // Если ворот нет на карте — выходим
  if (queue.length === 0) return [];

  // 2. Flood Fill для сбора "ES" тайлов внутри стен
  const directions = [
    { dy: 1, dx: 0 }, // Вниз
    { dy: -1, dx: 0 }, // Вверх
    { dy: 0, dx: 1 }, // Вправо
    { dy: 0, dx: -1 }, // Влево
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

    // Записываем пустые тайлы как валидные точки внутри логова
    if (currentTile === "ES") {
      lairInternalTiles.push(`${current.y},${current.x}`);
    }

    // Проверяем всех 4 соседей
    for (const { dy, dx } of directions) {
      const ny = current.y + dy;
      const nx = current.x + dx;
      const key = `${ny},${nx}`;

      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && !visited.has(key)) {
        const neighborTile = map[ny][nx];

        // Если сосед не стена — продолжаем заливку
        if (!wallTiles.has(neighborTile)) {
          visited.add(key);
          queue.push({ y: ny, x: nx });
        }
      }
    }
  }

  return lairInternalTiles;
}
