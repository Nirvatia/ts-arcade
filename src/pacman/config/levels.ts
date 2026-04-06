import { type LevelConfigType } from "../types.js";
import { LEVEL_2_MAP, LEVEL_1_MAP } from "./maps.js"; // 🌟 Импортируем новую карту

const LEVEL_CONFIGS: Record<number, LevelConfigType> = {
  1: {
    map: LEVEL_1_MAP,
    mapColor: "#120a8f", // Синий
    buffDuration: 10,
    buffThreshold: 3,
  },
  2: {
    map: LEVEL_2_MAP, // 🌟 Твоя новая карта
    mapColor: "#004d40", // Тёмно-зелёный
    buffDuration: 7, // 🌟 Чуть меньше времени на поедание привидений
    buffThreshold: 2, // 🌟 Предупреждение о мигании сработает за 2 секунды
  },
};

export { LEVEL_CONFIGS };
