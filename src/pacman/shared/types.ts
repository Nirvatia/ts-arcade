import * as PIXI from "pixi.js";

import type { CanvasLayer } from "../render/CanvasLayer.js";

export type TeleportType = `0${string}`;

export type TileType =
  | "WL" // Wall
  | "DT" // Dot
  | "PP" // Power Pill
  | "ES" // Empty Space / Clear Corridor
  | "LE" // Lair entrance
  | "LT" // Tile inside ghost lair
  | "PM" // Pac-Man Spawn Location
  | "BY" // Blinky Spawn Location (Red Ghost)
  | "PY" // Pinky Spawn Location (Pink Ghost)
  | "IY" // Inky Spawn Location (Cyan Ghost)
  | "CE" // Clyde Spawn Location (Orange Ghost)
  | TeleportType; // Dynamic Teleport Node

export type NewTileType = 1 | 0 | 9 | 8 | 6;

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
export type IDrawable = {
  readonly layer: CanvasLayer;
  needsRedraw: boolean;
  draw(): void;
  requestRedraw(): void;
  clearCanvas(): void;
};

/** Lifecycle type for dynamic assets requiring real-time logical frame updates */
export type IUpdatable = IDrawable & {
  /** Updates the internal state machine of the entity based on variable frame steps */
  update(dt: number): void;
};

export type PixiScene = (
  stage: PIXI.Container,
  width: number,
  height: number,
  duration: number,
  onComplete: () => void,
) => void;

// Old types for old grids
export type TileTypeOLD =
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
