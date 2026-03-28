import { type LevelConfigType } from "../types.js";
import { MAP_LVL_1 } from "./maps.js";

const LEVEL_CONFIGS: Record<number, LevelConfigType> = {
  1: {
    map: MAP_LVL_1,
    mapColor: "#120a8f",
    buffDuration: 10,
    buffThreshold: 3,
  },
};

export { LEVEL_CONFIGS };
