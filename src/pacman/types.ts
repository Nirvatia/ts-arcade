export type GameMode =
  | "INIT"
  | "PLAYING"
  | "PAUSED"
  | "PACMAN_DEAD"
  | "LEVEL_TRANSITION"
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

type LevelConfigType = {
  map: TileType[][];
  mapColor: string;
  buffDuration: number;
};

export type { LevelConfigType };
