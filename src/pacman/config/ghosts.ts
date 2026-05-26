// config/ghosts.ts

export interface GhostConfig {
  name: string;
  color: string;
  defaultColor: string;
  speedMultiplier: number; // relative to base tileSize speed
  frightenedSpeedMultiplier: number;
  eatenSpeedMultiplier: number;
  personality: "shadow" | "ambush" | "wild" | "shy";
  description: string;
}

export const CFG_GHOSTS: Record<string, GhostConfig> = {
  blinky: {
    name: "BY",
    color: "#ff2222",
    defaultColor: "#ff2222",
    speedMultiplier: 5.0, // fastest, relentless (110 px/s)
    frightenedSpeedMultiplier: 2.2, // half normal speed
    eatenSpeedMultiplier: 8.8, // double normal speed
    personality: "shadow",
    description: "Relentless pursuer. Always targets Pac-Man directly.",
  },
  pinky: {
    name: "PY",
    color: "#ff66aa",
    defaultColor: "#ff66aa",
    speedMultiplier: 4.7, // fast ambusher (103.4 px/s)
    frightenedSpeedMultiplier: 2.2,
    eatenSpeedMultiplier: 8.8,
    personality: "ambush",
    description: "Targets ahead of Pac-Man. Tries to ambush.",
  },
  inky: {
    name: "IY",
    color: "#44dddd",
    defaultColor: "#44dddd",
    speedMultiplier: 4.4, // baseline (96.8 px/s)
    frightenedSpeedMultiplier: 2.2,
    eatenSpeedMultiplier: 8.8,
    personality: "wild",
    description: "Unpredictable. Uses Blinky's position to triangulate.",
  },
  clyde: {
    name: "CE",
    color: "#ffaa33",
    defaultColor: "#ffaa33",
    speedMultiplier: 4.1, // slowest (90.2 px/s)
    frightenedSpeedMultiplier: 2.2,
    eatenSpeedMultiplier: 8.8,
    personality: "shy",
    description: "Chases until close, then retreats to scatter corner.",
  },
};
