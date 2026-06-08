// controller/Controller.ts
import type { Pacman } from "../actors/pacman/Pacman.js";
import type { GameState } from "../game/GameState.svelte.js";
import type { SFX } from "../sfx/SFX.js";

type Direction = { dx: number; dy: number };

export class Controller {
  private x1: number | null = null;
  private y1: number | null = null;

  private readonly gameState: GameState;
  private readonly sfx: SFX;
  private readonly getActivePacman: () => Pacman | null;

  private readonly KEY_MAP: Record<string, Direction> = {
    ArrowLeft:  { dx: -1, dy: 0 },
    ArrowUp:    { dx: 0, dy: -1 },
    ArrowRight: { dx: 1, dy: 0 },
    ArrowDown:  { dx: 0, dy: 1 },
  };

  constructor(
    gameState: GameState,
    sfx: SFX,
    getActivePacman: () => Pacman | null,
  ) {
    this.gameState = gameState;
    this.sfx = sfx;
    this.getActivePacman = getActivePacman;
  }

  public init(): void {
    window.addEventListener("touchstart", this.onTouchStart, { passive: false });
    window.addEventListener("touchend", this.onTouchEnd, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
  }

  public destroy(): void {
    window.removeEventListener("touchstart", this.onTouchStart);
    window.removeEventListener("touchend", this.onTouchEnd);
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    // Mute toggle — works in any mode
    if (event.key.toLowerCase() === "m") {
      this.sfx.toggleMute();
      return;
    }

    // Gameplay input — only during active play
    if (this.gameState.mode !== "PLAYING") return;

    const dir = this.KEY_MAP[event.key];
    if (dir) {
      event.preventDefault();
      this.getActivePacman()?.changeDirection(dir);
    }
  };

  private onTouchStart = (event: TouchEvent): void => {
    this.x1 = event.touches[0].clientX;
    this.y1 = event.touches[0].clientY;
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (this.x1 === null || this.y1 === null) return;

    // Touch input — only during active play
    if (this.gameState.mode !== "PLAYING") {
      this.x1 = this.y1 = null;
      return;
    }

    const x2 = event.changedTouches[0].clientX;
    const y2 = event.changedTouches[0].clientY;

    const threshold = 10;
    const dx = x2 - this.x1;
    const dy = y2 - this.y1;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      const direction: Direction =
        Math.abs(dx) > Math.abs(dy)
          ? { dx: dx > 0 ? 1 : -1, dy: 0 }
          : { dx: 0, dy: dy > 0 ? 1 : -1 };

      this.getActivePacman()?.changeDirection(direction);
    }

    this.x1 = this.y1 = null;
  };
}