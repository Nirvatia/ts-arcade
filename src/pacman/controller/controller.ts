import { EntityManager } from "../entities/entityManager.js";
import { GameState } from "../game/state.js";
// 🌟 THE FIX: Import the getter instead of the dead named export
import { getAudio } from "../game/audioManager.js";

class Controller {
  private x1: number | null;
  private y1: number | null;
  private gameState: GameState;

  constructor() {
    this.x1 = null;
    this.y1 = null;
    this.gameState = GameState.getInstance();
  }

  init() {
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
    return EntityManager.getInstance().getPacman();
  }

  touchCancel() {
    this.x1 = this.y1 = null;
  }

  touchStart(event: TouchEvent) {
    event.preventDefault();
    this.x1 = event.touches[0].clientX;
    this.y1 = event.touches[0].clientY;
  }

  touchEnd(event: TouchEvent) {
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

  async keyDown(event: KeyboardEvent) {
    event.preventDefault();

    if (event.key === "m" || event.key === "M") {
      const audio = getAudio();
      audio.toggleMute();
      return;
    }

    if (event.key === "Enter" && this.gameState.mode === "INIT") {
      // 🌟 THE FIX: Grab the instance lazily and unlock it safely!
      const audio = getAudio();
      await audio.unlockAudio();

      this.gameState.startGame();
      return;
    }

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
        break;
    }

    pacman.changeDirection(newDirection);
  }
}

export { Controller };
