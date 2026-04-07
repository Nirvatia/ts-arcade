import { EntityManager } from "../entities/entityManager.js";
import type { GameEvent } from "../types.js";
import { getAudio } from "./audioManager.js";
import { eventBus } from "./eventBus.js";
import { GameState } from "./state.js";

class AudioController {
  private static instance: AudioController;
  private wakaToggle: boolean = false;

  private constructor() {}

  public static getInstance(): AudioController {
    if (!AudioController.instance) {
      AudioController.instance = new AudioController();
    }
    return AudioController.instance;
  }

  public init() {
    console.log("AudioController listening for bus events.");

    const audio = getAudio();
    const entityManager = EntityManager.getInstance();
    const gameState = GameState.getInstance();

    let currentMusic: string | null = null;

    const switchMusic = (newTrack: string, loop: boolean) => {
      if (currentMusic === newTrack) return;

      audio.stopMusic();
      audio.playMusic(newTrack, loop);
      currentMusic = newTrack;
    };

    eventBus.on("GAME_OVER_SEQUENCE" as GameEvent, () => {
      audio.stopMusic();
      currentMusic = null;
      // Optional: If you want a specific "Game Over" stinger sound:
      // audio.playSFX("game_over_stinger");
    });

    // 🏁 1. Game Intro
    eventBus.on("GAME_START_SEQUENCE" as GameEvent, () => {
      // CRITICAL: Stop whatever was playing first to prevent stacking
      audio.stopMusic();
      currentMusic = null;

      // Now play the start sequence
      switchMusic("start", false);
    });

    // 🕹️ 2. Gameplay Starts
    eventBus.on("GAME_START" as GameEvent, () => {
      switchMusic("siren_0", true);
    });

    // 🔄 3. Gameplay Resumed
    eventBus.on("GAME_RESUMED" as GameEvent, () => {
      switchMusic("siren_0", true);
    });

    // ⚡ 4. Power Mode
    eventBus.on("POWER_PILL_EATEN" as GameEvent, () => {
      const runningEyes = entityManager
        .getGhosts()
        .some((g) => g.state === "EATEN");

      if (runningEyes) {
        currentMusic = "fright";
        return;
      }

      switchMusic("fright", true);
    });

    // ⏳ 5. Power Mode Ends
    eventBus.on("POWER_PILL_EXPIRED" as GameEvent, () => {
      const runningEyes = entityManager
        .getGhosts()
        .some((g) => g.state === "EATEN");

      if (runningEyes) return;

      switchMusic("siren_0", true);
    });

    // 👻 6. Ghost Eaten
    eventBus.on("GHOST_EATEN" as GameEvent, () => {
      audio.stopMusic();
      currentMusic = null;

      audio.playSFX("eat_ghost");

      switchMusic("eyes", true);
    });

    // 🏠 7. Ghost Returns Home
    eventBus.on("GHOST_RETURNED_HOME" as GameEvent, () => {
      const runningEyes = entityManager
        .getGhosts()
        .some((g) => g.state === "EATEN");

      if (runningEyes) return;

      if (gameState.isBuffed) {
        switchMusic("fright", true);
      } else {
        switchMusic("siren_0", true);
      }
    });

    // 💀 8. Pac-Man Death
    eventBus.on("PACMAN_DEATH" as GameEvent, () => {
      audio.stopMusic();
      currentMusic = null;
      audio.playSFX("death");
    });

    // 🟡 9. Dot Eating Engine
    eventBus.on("DOT_EATEN" as GameEvent, () => {
      const ghosts = entityManager.getGhosts();
      const abnormalStateActive = ghosts.some(
        (g) => g.state === "FRIGHTENED" || g.state === "EATEN",
      );

      if (abnormalStateActive) return;

      const soundToPlay = this.wakaToggle ? "waka_1" : "waka_0";
      audio.playSFX(soundToPlay);
      this.wakaToggle = !this.wakaToggle;
    });

    // 💊 10. Power Pellet Eaten SFX
    eventBus.on("POWER_PILL_EATEN_BY_PACMAN" as GameEvent, () => {
      audio.playSFX("fruit");
    });

    // 🎭 Интермиссия
    eventBus.on("INTERMISSION_START" as GameEvent, () => {
      switchMusic("intermission", false);
    });
  }
}

export const audioController = AudioController.getInstance();
