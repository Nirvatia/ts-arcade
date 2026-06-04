import {
  CFG_MAZE_0,
  CFG_MAZE_1,
  CFG_MAZE_2,
  CFG_MAZE_3,
  CFG_MAZE_4,
} from "../config/maze.config.js";
import { CFG_SFX } from "../config/sfx.config.js";
import { sfx } from "../sfx/SFX.js";

import type { LevelConfigType, TileType } from "./types.js";

/**
 * Pre-loads all audio assets via the SFX manager.
 * Should be executed at application bootstrap before the game starts.
 */
async function initAudio(): Promise<void> {
  try {
    // Fetches raw sound bytes safely; avoids strict browser autoplay restriction blocks
    await Promise.all(
      CFG_SFX.map((sound) => sfx.loadSound(sound.name, sound.url)),
    );
  } catch (err) {
    console.error("Failed to pre-load audio:", err);
  }
}

/**
 * Adjusts the canvas dimensions to match the structural layout of the map grid.
 * @param canvas - The HTML Canvas target element
 * @param BLOCK_SIZE - The size of a single tile coordinate in pixels
 * @param EXTRA_HEIGHT_FACTOR - Additional height padding measured in tile units (allocated for HUD/UI)
 * @param map - A 2D grid matrix mapping out individual tile attributes
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
 * Calculates cubic ease-in-out mathematical interpolation.
 * Utilized for acceleration and deceleration animation profiles.
 * @param t - Normalized progression factor clamped between 0 and 1
 * @returns The interpolated scalar position between 0 and 1
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Generates a dynamic level configuration profile based on the progressive difficulty curve.
 * Escalates difficulty scales by reducing Power Pill durations and warning flash thresholds.
 *
 * @param level - The current numerical progression step (indexed from 1)
 * @returns A computed configuration object customized for the target level
 */
function generateLevelConfig(level: number): LevelConfigType {
  // Loops sequentially through the 5 distinct blueprint layouts available
  const maps = [CFG_MAZE_0, CFG_MAZE_1, CFG_MAZE_2, CFG_MAZE_3, CFG_MAZE_4];
  const mapIndex = (level - 1) % maps.length;

  const colors = [195, 330, 45, 160, 275];
  const colorIndex = (level - 1) % colors.length;

  return {
    map: maps[mapIndex],
    mapHue: colors[colorIndex],
    // Gradually diminishes Frightened Mode status duration down to a absolute floor of 2 seconds
    buffDuration: Math.max(2, 10 - (level - 1) * 1.5),
    // Adjusts the warning flash trigger timeline proportionally to the total phase lifetime
    buffThreshold: Math.max(1, 3 - (level - 1) * 0.4),
  };
}

export { initAudio, setCanvasSize, easeInOutCubic, generateLevelConfig };
