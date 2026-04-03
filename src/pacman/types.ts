export type GameMode =
  | "INIT"
  | "PLAYING"
  | "PAUSED"
  | "PACMAN_DEAD"
  | "LEVEL_TRANSITION"
  | "GHOST_EATEN"
  | "GAME_OVER";

export type TileType =
  | "WH" // Wall Horizontal
  | "WV" // Wall Vertical
  | "TL" // Top Left Corner
  | "TR" // Top Right Corner
  | "BL" // Bottom Left Corner
  | "BR" // Bottom Right Corner
  | "FD" // Food
  | "PP" // Power Pill
  | "0A" // Teleport Pair A
  | "ES" // Empty Space
  | "GL" // Ghost Lair
  | "PM" // Pac-Man
  | "BY" // Blinky (Red Ghost)
  | "PY" // Pinky (Pink Ghost)
  | "IY" // Inky (Cyan Ghost)
  | "CE"; // Clyde (Orange Ghost)

export type LevelConfigType = {
  map: TileType[][];
  mapColor: string;
  buffDuration: number;
  buffThreshold: number;
};

export type GraphType = Record<string, string[]>;
export type EventHandler = (payload?: any) => void;
export type GameEvent =
  | "POWER_PILL_EATEN"
  | "POWER_PILL_WARNING"
  | "POWER_PILL_EXPIRED"
  | "PACMAN_DEATH";
