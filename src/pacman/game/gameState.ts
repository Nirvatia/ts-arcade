// src/game/gameState.ts
import { Clock } from "../core/clock.js";
import { eventBus } from "../core/eventBus.js";
import type { GameMode } from "../gameModes.js";
import type { GraphType, LevelConfigType } from "../types.js";
import { generateLevelConfig } from "../utils.js";

export class GameState {
  private static instance: GameState;

  public pathGraph: GraphType | null = null;
  public mode: GameMode = "INIT";
  public currentLevel: number = 1;
  public levelData: LevelConfigType;
  public totalDots: number = 0;
  public dotsEaten: number = 0;
  public isBuffed: boolean = false;
  public isProcessingLevelTransition: boolean = false;

  private _lives: number = 3;
  private buffClock: Clock = new Clock();
  private buffDuration: number = 10;
  private buffThreshold: number = 3;

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

  // --- Getters & Setters ---

  public get lives(): number {
    return this._lives;
  }

  public set lives(value: number) {
    const previousLives = this._lives;
    this._lives = value;

    if (previousLives !== this._lives) {
      eventBus.emit("lives:changed", { lives: this._lives });
      eventBus.emit("ui:lives_display_update", { lives: this._lives });
    }
  }

  private reset(): void {
    this.currentLevel = 1;
    this.dotsEaten = 0;
    this.lives = 3;
  }

  private initEventListeners(): void {
    // Game Lifecycle Management via events
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

    // Core Rules Progress
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
        this.buffDuration,
        1000,
        (rem) => {
          if (rem === this.buffThreshold) {
            eventBus.emit("power_pill:warning", { remainingSeconds: rem });
          }
        },
        () => {
          this.isBuffed = false;
          eventBus.emit("power_pill:expired");
        },
      );
      eventBus.emit("power_pill:activated", { duration: this.buffDuration });
    });

    eventBus.on("bonus_life:earned", () => {
      this.lives++;
      eventBus.emit("bonus_life:acquired", { lives: this.lives });
    });

    // Decoupled Lifecycle Execution Hook
    eventBus.on(
      "command:execute_life_loss",
      (data: { currentScore: number }) => {
        if (this._lives - 1 < 0) {
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
