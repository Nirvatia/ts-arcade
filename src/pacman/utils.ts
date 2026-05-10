// src/utils.ts
import type { GraphType, LevelConfigType, TileType } from "./types.js";
import {
  LEVEL_1_MAP,
  LEVEL_2_MAP,
  LEVEL_3_MAP,
  LEVEL_4_MAP,
  LEVEL_5_MAP,
} from "./config/maps.js";
import { sfx } from "./sfx/sfx.js";
import { CFG_SFX } from "./config/sfx.js";

/**
 * Предзагружает все аудио-ассеты через SFX.
 * Вызывается при старте приложения перед началом игры.
 */
async function initAudio(): Promise<void> {
  try {
    // Теперь это просто скачивание байтов, браузер не ругается
    await Promise.all(
      CFG_SFX.map((sound) => sfx.loadSound(sound.name, sound.url)),
    );
    console.log("Audio assets pre-loaded (buffers cached).");
  } catch (err) {
    console.error("Failed to pre-load audio:", err);
  }
}

/**
 * Устанавливает размер canvas на основе карты уровня.
 * @param canvas - HTML Canvas элемент
 * @param BLOCK_SIZE - размер одного тайла в пикселях
 * @param EXTRA_HEIGHT_FACTOR - дополнительная высота в тайлах (для HUD)
 * @param map - двумерный массив тайлов карты
 */
function setCanvasSize(
  canvas: HTMLCanvasElement,
  BLOCK_SIZE: number,
  EXTRA_HEIGHT_FACTOR: number,
  map: TileType[][],
): void {
  const rows = map.length;
  const cols = map[0]?.length || 0;

  canvas.width = cols * BLOCK_SIZE;
  canvas.height = rows * BLOCK_SIZE + BLOCK_SIZE * EXTRA_HEIGHT_FACTOR;
}

/**
 * Функция плавности cubic ease-in-out.
 * Используется для анимаций с ускорением и замедлением.
 * @param t - прогресс от 0 до 1
 * @returns интерполированное значение от 0 до 1
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Создаёт граф путей для навигации призраков.
 * Каждый проходимый тайл становится узлом, соседи — рёбрами.
 * Телепорты "0A" связываются друг с другом.
 *
 * @param map - двумерный массив тайлов карты
 * @returns граф в формате { "y,x": ["y1,x1", "y2,x2", ...] }
 */
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

/**
 * Находит кратчайший путь между двумя узлами графа (BFS).
 *
 * @param graph - граф путей (результат createPathGraph)
 * @param start - начальный узел в формате "y,x"
 * @param target - целевой узел в формате "y,x"
 * @returns массив узлов пути или null, если путь не найден
 */
function findShortestPath(
  graph: GraphType,
  start: string,
  target: string,
): string[] | null {
  if (!graph || Object.keys(graph).length === 0) {
    console.error("findShortestPath failed: The graph provided is empty!");
    return null;
  }

  // Проверка существования начального узла
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
      // Восстановление пути с конца к началу
      const path: string[] = [];
      let step: string | null = current;
      while (step !== null) {
        path.unshift(step);
        step = parent[step];
      }
      return path;
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

  return null; // Путь не найден
}

/**
 * Находит выход из логова призраков (тайл над "GL").
 *
 * @param map - двумерный массив тайлов карты
 * @returns координаты выхода в формате "y,x"
 */
function findLairExit(map: string[][]): string {
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
function findLairInternalTiles(map: TileType[][]): string[] {
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

/**
 * Генерирует конфигурацию уровня на основе его номера.
 * Зацикливает 5 карт и 4 цвета.
 * Сложность растёт: уменьшается длительность баффа и порог мигания.
 *
 * @param level - номер уровня (начиная с 1)
 * @returns объект конфигурации уровня
 */
function generateLevelConfig(level: number): LevelConfigType {
  // Зацикливаем 5 доступных карт
  const maps = [
    LEVEL_1_MAP,
    LEVEL_2_MAP,
    LEVEL_3_MAP,
    LEVEL_4_MAP,
    LEVEL_5_MAP,
  ];
  const mapIndex = (level - 1) % maps.length;

  // Deep dark palette — цвета стен лабиринта
  const colors = [
    "hsl(220, 70%, 35%)", // Deep Cobalt Blue
    "hsl(340, 70%, 35%)", // Deep Crimson Red
    "hsl(160, 70%, 30%)", // Deep Forest Green
    "hsl(280, 70%, 35%)", // Dark Amethyst Purple
  ];
  const colorIndex = (level - 1) % colors.length;

  return {
    map: maps[mapIndex],
    mapColor: colors[colorIndex],
    // С каждым уровнем время баффа уменьшается, но не падает ниже 2 секунд
    buffDuration: Math.max(2, 10 - (level - 1) * 1.5),
    // Порог мигания пропорционален времени баффа
    buffThreshold: Math.max(1, 3 - (level - 1) * 0.4),
  };
}

export {
  initAudio,
  setCanvasSize,
  easeInOutCubic,
  findLairExit,
  findLairInternalTiles,
  createPathGraph,
  findShortestPath,
  generateLevelConfig,
};
