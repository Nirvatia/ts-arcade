import { Clock } from "../core/clock.svelte.js";
import { eventBus } from "../core/eventBus.js";
import type { GameMode } from "../gameModes.js";
import type { GraphType, LevelConfigType } from "../types.js";
import { generateLevelConfig } from "../utils.js";

export class GameState {
  private static instance: GameState;

  // Svelte 5 Fine-Grained Reactive Proxy Object
  private _state = $state({
    mode: "INIT" as GameMode,
    lives: 3,
    currentLevel: 1,
  });

  public pathGraph: GraphType | null = null;
  public levelData: LevelConfigType;
  public totalDots: number = 0;
  public dotsEaten: number = 0;
  public isBuffed: boolean = false;
  public isProcessingLevelTransition: boolean = false;

  private buffClock: Clock = new Clock();

  private constructor() {
    this.levelData = generateLevelConfig(this.currentLevel);
    this.initEventListeners();
  }

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  // --- Getters & Setters hooked directly to the proxy ---

  public get mode(): GameMode {
    return this._state.mode;
  }

  public set mode(val: GameMode) {
    this._state.mode = val;
  }

  public get lives(): number {
    return this._state.lives;
  }

  public set lives(value: number) {
    const previousLives = this._state.lives;
    this._state.lives = value;

    if (previousLives !== this._state.lives) {
      eventBus.emit("lives:changed", { lives: this._state.lives });
      eventBus.emit("ui:lives_display_update", { lives: this._state.lives });
    }
  }

  public get currentLevel(): number {
    return this._state.currentLevel;
  }

  public set currentLevel(value: number) {
    this._state.currentLevel = value;
  }

  private reset(): void {
    this._state.currentLevel = 1;
    this.dotsEaten = 0;
    this.lives = 3;
  }

  private initEventListeners(): void {
    eventBus.on("game:start", () => {
      this.mode = "LEVEL_TRANSITION";
    });

    eventBus.on("game:started", () => {
      this.mode = "PLAYING";
    });

    eventBus.on("game:restart", () => {
      this.reset();
      this.mode = "LEVEL_TRANSITION";
      this.levelData = generateLevelConfig(this.currentLevel);
      eventBus.emit("ui:level_display_update", { level: this.currentLevel });
    });

    eventBus.on("level:complete", () => {
      this.mode = "LEVEL_COMPLETE";
    });

    eventBus.on("level:intermission_start", (data) => {
      this.mode = "INTERMISSION";
      this.currentLevel = data.nextLevel;
      this.dotsEaten = 0;
      this.isProcessingLevelTransition = false;
      this.levelData = generateLevelConfig(this.currentLevel);
    });

    eventBus.on("pacman:death_triggered", () => {
      this.mode = "PACMAN_DEAD";
    });

    eventBus.on("command:ghost_eaten", () => {
      this.mode = "GHOST_EATEN";
    });

    eventBus.on("game:resumed", () => {
      this.mode = "PLAYING";
    });

    eventBus.on("dot:eaten", () => {
      if (this.isProcessingLevelTransition) return;

      this.dotsEaten++;

      if (this.dotsEaten >= this.totalDots && this.totalDots > 0) {
        this.isProcessingLevelTransition = true;
        eventBus.emit("level:complete", {
          level: this.currentLevel,
          score: 0,
        });
      }
    });

    eventBus.on("power_pill:eaten", () => {
      this.buffClock.stop();
      this.isBuffed = true;
      this.buffClock.start(
        this.levelData.buffDuration,
        1000,
        (rem) => {
          if (rem === this.levelData.buffThreshold) {
            eventBus.emit("power_pill:warning", { remainingSeconds: rem });
          }
        },
        () => {
          this.isBuffed = false;
          eventBus.emit("power_pill:expired");
        },
      );
      eventBus.emit("power_pill:activated", { duration: this.levelData.buffDuration });
    });

    eventBus.on("bonus_life:earned", () => {
      this.lives++;
      eventBus.emit("bonus_life:acquired", { lives: this.lives });
    });

    eventBus.on(
      "command:execute_life_loss",
      (data: { currentScore: number }) => {
        if (this.lives - 1 < 0) {
          this.mode = "GAME_OVER";
          eventBus.emit("game:over", {
            finalScore: data.currentScore,
            level: this.currentLevel,
          });
        } else {
          this.lives--;
          eventBus.emit("command:death_sequence_continue");
        }
      },
    );

    eventBus.on("dot:spawned", (data) => {
      this.totalDots = data.count;
      this.dotsEaten = 0;
      this.isProcessingLevelTransition = false;
    });
  }
}
