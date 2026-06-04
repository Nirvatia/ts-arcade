export type TeleportType = `0${string}`;

export type TileType =
  | "WH" // Wall Horizontal
  | "WV" // Wall Vertical
  | "TL" // Top Left Corner
  | "TR" // Top Right Corner
  | "BL" // Bottom Left Corner
  | "BR" // Bottom Right Corner
  | "FD" // Dot / Food
  | "PP" // Power Pill
  | TeleportType // Dynamic Teleport Node
  | "ES" // Empty Space / Clear Corridor
  | "GL" // Ghost Lair / Spawn House
  | "PM" // Pac-Man Spawn Location
  | "BY" // Blinky Spawn Location (Red Ghost)
  | "PY" // Pinky Spawn Location (Pink Ghost)
  | "IY" // Inky Spawn Location (Cyan Ghost)
  | "CE"; // Clyde Spawn Location (Orange Ghost)

export type LevelConfigType = {
  /** The 2D structural layout grid matrix for the level */
  map: TileType[][];
  /** The HSL hue value utilized to dynamically color the vector maze walls */
  mapHue: number;
  /** Total lifespan duration (in seconds) of the Frightened Mode status effect */
  buffDuration: number;
  /** Remaining duration milestone (in seconds) that triggers warning flash sequences */
  buffThreshold: number;
};

/** Adjacency list representation mapping coordinate keys to neighboring walkable nodes */
export type GraphType = Record<string, string[]>;

/** Callback signature invoked when a subscribed event is broadcasted */
export type EventHandler = (payload?: any) => void;

/** Common structural type for assets capable of rendering pixels to a canvas context */
export type Drawable = {
  readonly canvasId: string;
  ctx: CanvasRenderingContext2D;
  needsRedraw: boolean;
  draw(): void;
  requestRedraw(): void;
  clearCanvas(): void;
  init(): void;
  reset(): void;
};

/** Lifecycle type for dynamic assets requiring real-time logical frame updates */
export type Updatable = Drawable & {
  /** Updates the internal state machine of the entity based on variable frame steps */
  update(dt: number): void;
};

/** Interface for environmental items interactable by actor entities on the map grid */
export type Collectible = {
  spawn(): void;
  collect(i: number, j: number): void;
};

/** Contract definition for custom scripted cinematics or non-gameplay intermission sequences */
export type IGameScene = {
  id: string;
  start(durationInSeconds: number, onComplete: () => void): void;
  update(dt: number): void;
  draw(): void;
  clear(): void;
};

/** Target rendering layer manager capable of dispatching rendering loops */
export type IRenderer = {
  render(): void;
  clear(): void;
};
