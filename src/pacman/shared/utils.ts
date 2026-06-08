import { CFG_GRID_0 } from "../config/grid.config.js";

import type { LevelConfigType } from "./types.js";

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
  const maps = [CFG_GRID_0];
  const mapIndex = (level - 1) % maps.length;

  const colors = [200, 205, 220, 190, 210];
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

export { easeInOutCubic, generateLevelConfig };
