export const CFG_SCORE = {
  DOTS: {
    PELLET: 10,
    POWER_PELLET: 50,
  },
  GHOSTS: {
    BASE: 200,
    MULTIPLIERS: [1, 2, 4, 8] as const, // 200, 400, 800, 1600
  },
  FRUITS: {
    CHERRY: 100,
    STRAWBERRY: 300,
    ORANGE: 500,
    APPLE: 700,
    MELON: 1000,
    GALAXIAN: 2000,
    BELL: 3000,
    KEY: 5000,
  },
  LIVES: {
    FIRST_EXTRA: 10000,
    SECOND_EXTRA: 15000, // Some versions
    THIRD_EXTRA: 20000, // Some versions
  },
  LEVEL_FRUIT_SEQUENCE: [
    100, // Level 1: Cherry
    300, // Level 2: Strawberry
    500, // Level 3: Orange
    500, // Level 4: Orange (repeats in OG)
    700, // Level 5: Apple
    700, // Level 6: Apple
    1000, // Level 7: Melon
    1000, // Level 8: Melon
    2000, // Level 9: Galaxian
    2000, // Level 10: Galaxian
    3000, // Level 11: Bell
    3000, // Level 12: Bell
    5000, // Level 13+: Key
  ] as const,
} as const;
