// src/utils.ts
import type { GraphType, LevelConfigType, TileType } from "./types.js";
import { sfx } from "./sfx/sfx.js";
import { CFG_SFX } from "./config/sfx.js";
import {
  CFG_MAZE_0,
  CFG_MAZE_1,
  CFG_MAZE_2,
  CFG_MAZE_3,
  CFG_MAZE_4,
} from "./config/maze.js";

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
 * Генерирует конфигурацию уровня на основе его номера.
 * Сложность растёт: уменьшается длительность баффа и порог мигания.
 *
 * @param level - номер уровня (начиная с 1)
 * @returns объект конфигурации уровня
 */
function generateLevelConfig(level: number): LevelConfigType {
  // Зацикливаем 5 доступных карт
  const maps = [CFG_MAZE_0, CFG_MAZE_1, CFG_MAZE_2, CFG_MAZE_3, CFG_MAZE_4];
  const mapIndex = (level - 1) % maps.length;

  const colors = [195, 330, 45, 160, 275];
  const colorIndex = (level - 1) % colors.length;

  return {
    map: maps[mapIndex],
    mapHue: colors[colorIndex],
    // С каждым уровнем время баффа уменьшается, но не падает ниже 2 секунд
    buffDuration: Math.max(2, 10 - (level - 1) * 1.5),
    // Порог мигания пропорционален времени баффа
    buffThreshold: Math.max(1, 3 - (level - 1) * 0.4),
  };
}

export { initAudio, setCanvasSize, easeInOutCubic, generateLevelConfig };
