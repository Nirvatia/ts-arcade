// src/game/gameState.ts
import { Clock } from "../core/clock.js";
import { eventBus } from "../core/eventBus.js";
import type { GameMode } from "../gameModes.js";
import type { GraphType, LevelConfigType } from "../types.js";
import { generateLevelConfig } from "../utils.js";
import { Tally } from "./tally.js";

export class GameState {
  private static instance: GameState;

  private tally: Tally;

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
    this.tally = Tally.getInstance();
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

  private initEventListeners(): void {
    eventBus.on("dot:eaten", () => {
      if (this.isProcessingLevelTransition) return;

      this.dotsEaten++;

      if (this.dotsEaten >= this.totalDots && this.totalDots > 0) {
        this.isProcessingLevelTransition = true;
        eventBus.emit("level:complete", {
          level: this.currentLevel,
          score: this.tally.score,
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
  }

  public setTotalDots(count: number): void {
    this.totalDots = count;
    this.dotsEaten = 0;
    this.isProcessingLevelTransition = false;
  }

  public resetLevelProgress(): void {
    this.dotsEaten = 0;
    this.isProcessingLevelTransition = false;
  }

  public updateLevelConfig(level: number): void {
    this.currentLevel = level;
    this.levelData = generateLevelConfig(level);
  }

  public loseLife(): void {
    if (this._lives - 1 < 0) {
      eventBus.emit("game:over", {
        finalScore: this.tally.score,
        level: this.currentLevel,
      });
      return;
    }

    this.lives--;
  }
}
