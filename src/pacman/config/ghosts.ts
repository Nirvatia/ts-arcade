// src/config/ghosts.ts

export interface GhostConfig {
  name: string; // Actual readable name used for keying logic
  codename: string; // The map token string ("BY", "PY", etc.)
  color: string;
  defaultColor: string;
  speedMultiplier: number;
  frightenedSpeedMultiplier: number;
  eatenSpeedMultiplier: number;
  personality: "shadow" | "ambush" | "wild" | "shy";
  description: string;
}

export const CFG_GHOSTS: Record<string, GhostConfig> = {
  blinky: {
    name: "blinky",
    codename: "BY",
    color: "#ff2222",
    defaultColor: "#ff2222",
    speedMultiplier: 5.0,
    frightenedSpeedMultiplier: 2.2,
    eatenSpeedMultiplier: 8.8,
    personality: "shadow",
    description: "Relentless pursuer. Always targets Pac-Man directly.",
  },
  pinky: {
    name: "pinky",
    codename: "PY",
    color: "#ff66aa",
    defaultColor: "#ff66aa",
    speedMultiplier: 4.7,
    frightenedSpeedMultiplier: 2.2,
    eatenSpeedMultiplier: 8.8,
    personality: "ambush",
    description: "Targets ahead of Pac-Man. Tries to ambush.",
  },
  inky: {
    name: "inky",
    codename: "IY",
    color: "#44dddd",
    defaultColor: "#44dddd",
    speedMultiplier: 4.4,
    frightenedSpeedMultiplier: 2.2,
    eatenSpeedMultiplier: 8.8,
    personality: "wild",
    description: "Unpredictable. Uses Blinky's position to triangulate.",
  },
  clyde: {
    name: "clyde",
    codename: "CE",
    color: "#ffaa33",
    defaultColor: "#ffaa33",
    speedMultiplier: 4.1,
    frightenedSpeedMultiplier: 2.2,
    eatenSpeedMultiplier: 8.8,
    personality: "shy",
    description: "Chases until close, then retreats to scatter corner.",
  },
};
