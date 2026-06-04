import { eventBus } from "../core/EventBus.js";
import { GameRegistry } from "../game/GameRegistry.js";
import { GameState } from "../game/GameState.svelte.js";
import { sfx } from "../sfx/SFX.js";

type Direction = { dx: number; dy: number };

export class Controller {
  private x1: number | null = null;
  private y1: number | null = null;
  
  // Use readonly for instances that shouldn't be reassigned
  private readonly gameState = GameState.getInstance();
  private readonly registry = GameRegistry.getInstance();

  private readonly KEY_MAP: Record<string, Direction> = {
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowUp: { dx: 0, dy: -1 },
    ArrowRight: { dx: 1, dy: 0 },
    ArrowDown: { dx: 0, dy: 1 },
  };

  init(): void {
    const options = { passive: false };
    window.addEventListener("touchstart", this.touchStart.bind(this), options);
    window.addEventListener("touchend", this.touchEnd.bind(this), options);
    window.addEventListener("keydown", this.keyDown.bind(this));
  }

  private keyDown(event: KeyboardEvent): void {
    const key = event.key;

    // 1. System Controls
    if (key.toLowerCase() === "m") {
      sfx.toggleMute();
      return;
    }

    if (key === "Enter" && this.gameState.mode === "INIT") {
      event.preventDefault();
      sfx.unlockAudio().then(() => eventBus.emit("game:start"));
      return;
    }

    // 2. Gameplay Controls
    if (this.gameState.mode !== "PLAYING") return;
    
    if (this.KEY_MAP[key]) {
      event.preventDefault();
      this.registry.getPacman()?.changeDirection(this.KEY_MAP[key]);
    }
  }

  private touchStart(event: TouchEvent): void {
    this.x1 = event.touches[0].clientX;
    this.y1 = event.touches[0].clientY;
  }

  private touchEnd(event: TouchEvent): void {
    if (this.x1 === null || this.y1 === null) return;
    
    const x2 = event.changedTouches[0].clientX;
    const y2 = event.changedTouches[0].clientY;
    
    // Threshold to prevent accidental tiny swipes
    const threshold = 10; 
    const dx = x2 - this.x1;
    const dy = y2 - this.y1;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      const direction: Direction = Math.abs(dx) > Math.abs(dy)
        ? { dx: dx > 0 ? 1 : -1, dy: 0 }
        : { dx: 0, dy: dy > 0 ? 1 : -1 };
        
      this.registry.getPacman()?.changeDirection(direction);
    }
    
    this.x1 = this.y1 = null;
  }
}