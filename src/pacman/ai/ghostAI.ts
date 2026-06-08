// ai/ghostAI.ts
import type { Pacman } from "../actors/pacman/Pacman.js";
import type { Ghost } from "../actors/ghost/Ghost.js";
import type { GridContext } from "../core/GridContext.js";
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
export function getBlinkyTarget(
  pacman: Pacman,
  gridContext: GridContext,
): TargetCoords {
  return gridContext.getTile(pacman.x, pacman.y);
}

/**
 * Pinky: Targets 4 tiles ahead of Pac-Man's current orientation.
 */
export function getPinkyTarget(
  pacman: Pacman,
  gridContext: GridContext,
): TargetCoords {
  const pacTile = gridContext.getTile(pacman.x, pacman.y);

  let moveDx = pacman.direction.dx;
  let moveDy = pacman.direction.dy;

  // Handle game-start idle state
  if (moveDx === 0 && moveDy === 0) {
    moveDx = -1;
  }

  // Classic Arcade emulation: If looking UP, offset goes 4 up AND 4 left due to overflow code
  if (moveDy === -1) {
    return {
      tileX: pacTile.tileX - 4,
      tileY: pacTile.tileY - 4,
    };
  }

  return {
    tileX: pacTile.tileX + moveDx * 4,
    tileY: pacTile.tileY + moveDy * 4,
  };
}

/**
 * Inky: Triangulates target using Pac-Man's forward vector offset mirrored against Blinky.
 */
export function getInkyTarget(
  blinky: Ghost | undefined,
  pacman: Pacman,
  gridContext: GridContext,
): TargetCoords {
  // Fallback to Blinky chase strategy if Blinky hasn't spawned or was destroyed
  if (!blinky) return getBlinkyTarget(pacman, gridContext);

  const pacTile = gridContext.getTile(pacman.x, pacman.y);
  const blinkyTile = gridContext.getTile(blinky.x, blinky.y);

  // Pivot tile is 2 tiles ahead of Pacman
  let moveDx = pacman.direction.dx;
  let moveDy = pacman.direction.dy;

  // Replicate classic Up overflow for consistency inside Inky's vector calculations
  let pivotX = pacTile.tileX + moveDx * 2;
  let pivotY = pacTile.tileY + moveDy * 2;
  if (moveDy === -1) {
    pivotX -= 2;
  }

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
  grid: TileType[][],
  pacman: Pacman,
  gridContext: GridContext,
): TargetCoords {
  const clydeTile = gridContext.getTile(clydeX, clydeY);
  const pacTile = gridContext.getTile(pacman.x, pacman.y);

  const dx = clydeTile.tileX - pacTile.tileX;
  const dy = clydeTile.tileY - pacTile.tileY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 8) {
    return { tileX: pacTile.tileX, tileY: pacTile.tileY };
  } else {
    return getScatterTarget("clyde", grid);
  }
}
