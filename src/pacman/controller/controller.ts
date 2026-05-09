// src/input/Controller.ts

import { eventBus } from "../core/eventBus.js";
import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.js";
import { sfx } from "../sfx/sfx.js";

/**
 * Обработчик пользовательского ввода:
 * клавиатура (стрелки, Enter, M) и тач-жесты.
 */
export class Controller {
  private x1: number | null;
  private y1: number | null;
  private gameState: GameState;
  private registry: GameRegistry;

  constructor() {
    this.x1 = null;
    this.y1 = null;
    this.gameState = GameState.getInstance();
    this.registry = GameRegistry.getInstance();
  }

  /** Привязать слушатели событий */
  init(): void {
    window.addEventListener("touchstart", this.touchStart.bind(this), {
      passive: false,
    });
    window.addEventListener("touchend", this.touchEnd.bind(this), {
      passive: false,
    });
    window.addEventListener("touchcancel", this.touchCancel.bind(this), {
      passive: false,
    });
    window.addEventListener("keydown", this.keyDown.bind(this));
  }

  private getPacman() {
    return this.registry.getPacman();
  }

  private touchCancel(): void {
    this.x1 = this.y1 = null;
  }

  private touchStart(event: TouchEvent): void {
    event.preventDefault();
    this.x1 = event.touches[0].clientX;
    this.y1 = event.touches[0].clientY;
  }

  private touchEnd(event: TouchEvent): void {
    if (this.x1 === null || this.y1 === null) return;

    event.preventDefault();
    const x2 = event.changedTouches[0].clientX;
    const y2 = event.changedTouches[0].clientY;

    const dx = Math.abs(x2 - this.x1);
    const dy = Math.abs(y2 - this.y1);

    const pacman = this.getPacman();
    if (!pacman) return;

    if (dx > dy) {
      pacman.changeDirection({ dx: x2 > this.x1 ? 1 : -1, dy: 0 });
    } else {
      pacman.changeDirection({ dx: 0, dy: y2 > this.y1 ? 1 : -1 });
    }

    this.x1 = this.y1 = null;
  }

  private async keyDown(event: KeyboardEvent): Promise<void> {
    // 1. Определяем список клавиш, которые нужны ДЛЯ ИГРЫ
    const gameKeys = [
      "ArrowLeft",
      "ArrowUp",
      "ArrowRight",
      "ArrowDown",
      "Enter",
      " ",
      "m",
      "M",
    ];

    // 2. Блокируем стандартное поведение ТОЛЬКО для игровых клавиш
    // Теперь F5 (которого нет в списке) проскочит мимо этого блока
    if (gameKeys.includes(event.key)) {
      event.preventDefault();
    } else {
      // Если это не игровая клавиша (например, F5), выходим из функции
      return;
    }

    // --- Логика обработки ---

    // Mute toggle
    if (event.key.toLowerCase() === "m") {
      sfx.toggleMute();
      return;
    }

    // Start game
    if (event.key === "Enter" && this.gameState.mode === "INIT") {
      await sfx.unlockAudio();
      eventBus.emit("game:start");
      return;
    }

    // Движение Pacman
    if (this.gameState.mode !== "PLAYING") return;

    const pacman = this.getPacman();
    if (!pacman) return;

    let newDirection = { dx: 0, dy: 0 };

    switch (event.key) {
      case "ArrowLeft":
        newDirection = { dx: -1, dy: 0 };
        break;
      case "ArrowUp":
        newDirection = { dx: 0, dy: -1 };
        break;
      case "ArrowRight":
        newDirection = { dx: 1, dy: 0 };
        break;
      case "ArrowDown":
        newDirection = { dx: 0, dy: 1 };
        break;
      default:
        return;
    }

    pacman.changeDirection(newDirection);
  }
}
