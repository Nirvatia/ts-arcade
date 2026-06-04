import { Collision } from "../core/Collision.js";
import { GameRegistry } from "../game/GameRegistry.js";

import type { TileType } from "../shared/types.js";

export interface TargetCoords {
  tileX: number;
  tileY: number;
}

/**
 * Calculates fixed scatter corner positions in the map grid boundaries.
 */
export function getScatterTarget(
  ghostName: string,
  map: TileType[][],
): TargetCoords {
  const rows = map.length;
  const cols = map[0]?.length || 0;

  switch (ghostName) {
    case "blinky":
      return { tileX: cols - 3, tileY: 1 }; // Top Right
    case "pinky":
      return { tileX: 2, tileY: 1 }; // Top Left
    case "inky":
      return { tileX: cols - 1, tileY: rows - 1 }; // Bottom Right
    case "clyde":
      return { tileX: 0, tileY: rows - 1 }; // Bottom Left
    default:
      return { tileX: 0, tileY: 0 };
  }
}

/**
 * Blinky: Targets Pac-Man's exact tile directly.
 */
export function getBlinkyTarget(): TargetCoords {
  const pacman = GameRegistry.getInstance().getPacman();
  const { tileX, tileY } = Collision.getTile(pacman.x, pacman.y);
  return { tileX, tileY };
}

/**
 * Pinky: Targets 4 tiles ahead of Pac-Man's current orientation.
 */
export function getPinkyTarget(): TargetCoords {
  const pacman = GameRegistry.getInstance().getPacman();
  const { tileX, tileY } = Collision.getTile(pacman.x, pacman.y);

  let moveDx = pacman.direction.dx;
  let moveDy = pacman.direction.dy;

  if (moveDx === 0 && moveDy === 0) {
    moveDx = -1;
    moveDy = 0;
  }

  return {
    tileX: tileX + moveDx * 4,
    tileY: tileY + moveDy * 4,
  };
}

/**
 * Inky: Triangulates target using Pac-Man's forward vector offset mirrored against Blinky.
 */
export function getInkyTarget(): TargetCoords {
  const registry = GameRegistry.getInstance();
  const pacman = registry.getPacman();
  const ghosts = registry.getGhosts();

  const blinky = ghosts.find((g) => g.name === "blinky");
  if (!blinky) return getBlinkyTarget(); // Fallback if missing

  const pacTile = Collision.getTile(pacman.x, pacman.y);
  const blinkyTile = Collision.getTile(blinky.x, blinky.y);

  const pivotX = pacTile.tileX + pacman.direction.dx * 2;
  const pivotY = pacTile.tileY + pacman.direction.dy * 2;

  const vecX = pivotX - blinkyTile.tileX;
  const vecY = pivotY - blinkyTile.tileY;

  return {
    tileX: blinkyTile.tileX + vecX * 2,
    tileY: blinkyTile.tileY + vecY * 2,
  };
}

/**
 * Clyde: Chases Pac-Man directly if far away (> 8 tiles),
 * flees to his static scatter corner layout if inside close proximity.
 */
export function getClydeTarget(
  clydeX: number,
  clydeY: number,
  map: TileType[][],
): TargetCoords {
  const pacman = GameRegistry.getInstance().getPacman();
  const clydeTile = Collision.getTile(clydeX, clydeY);
  const pacTile = Collision.getTile(pacman.x, pacman.y);

  const dx = clydeTile.tileX - pacTile.tileX;
  const dy = clydeTile.tileY - pacTile.tileY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 8) {
    return { tileX: pacTile.tileX, tileY: pacTile.tileY };
  } else {
    return getScatterTarget("clyde", map);
  }
}
