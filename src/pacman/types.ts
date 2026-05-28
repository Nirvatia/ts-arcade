export type TeleportType = `0${string}`; // Подходит для "0A", "0B", "0C", "01" и т.д.

export type TileType =
  | "WH" // Wall Horizontal
  | "WV" // Wall Vertical
  | "TL" // Top Left Corner
  | "TR" // Top Right Corner
  | "BL" // Bottom Left Corner
  | "BR" // Bottom Right Corner
  | "FD" // Food
  | "PP" // Power Pill
  | TeleportType // 🌟 Используем динамический тип для телепортов
  | "ES" // Empty Space
  | "GL" // Ghost Lair
  | "PM" // Pac-Man
  | "BY" // Blinky (Red Ghost)
  | "PY" // Pinky (Pink Ghost)
  | "IY" // Inky (Cyan Ghost)
  | "CE"; // Clyde (Orange Ghost)

export type LevelConfigType = {
  map: TileType[][];
  mapHue: number;
  buffDuration: number;
  buffThreshold: number;
};

export type GraphType = Record<string, string[]>;
export type EventHandler = (payload?: any) => void;
