// config/ghost.config.ts
export interface GhostConfig {
  name: string;
  codename: string;
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
    color: "#dd3355",
    defaultColor: "#dd3355",
    speedMultiplier: 5.5,
    frightenedSpeedMultiplier: 2.8,
    eatenSpeedMultiplier: 12.0,
    personality: "shadow",
    description: "Relentless pursuer.",
  },
  pinky: {
    name: "pinky",
    codename: "PY",
    color: "#dd44aa",
    defaultColor: "#dd44aa",
    speedMultiplier: 5.2,
    frightenedSpeedMultiplier: 2.8,
    eatenSpeedMultiplier: 12.0,
    personality: "ambush",
    description: "Targets ahead of Pac-Man.",
  },
  inky: {
    name: "inky",
    codename: "IY",
    color: "#4488dd",
    defaultColor: "#4488dd",
    speedMultiplier: 4.9,
    frightenedSpeedMultiplier: 2.8,
    eatenSpeedMultiplier: 12.0,
    personality: "wild",
    description: "Uses Blinky's position to triangulate.",
  },
  clyde: {
    name: "clyde",
    codename: "CE",
    color: "#dd9933",
    defaultColor: "#dd9933",
    speedMultiplier: 4.6,
    frightenedSpeedMultiplier: 2.8,
    eatenSpeedMultiplier: 12.0,
    personality: "shy",
    description: "Chases until close, then retreats.",
  },
};