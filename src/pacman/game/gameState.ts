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

  private buffClock: Clock = new Clock();
  private buffDuration: number = 10;
  private buffThreshold: number = 3;

  private constructor() {
    this.tally = Tally.getInstance();
    this.levelData = generateLevelConfig(this.currentLevel);
    this.initEventListeners();
  }

  static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  // Прокси-геттеры для UI (Svelte)
  get lives(): number {
    return this.tally.lives;
  }
  set lives(v: number) {
    this.tally.lives = v;
  }
  get score(): number {
    return this.tally.score;
  }

  private initEventListeners(): void {
    eventBus.on("dot:eaten", (data) => {
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
  }

  setTotalDots(count: number): void {
    this.totalDots = count;
    this.dotsEaten = 0; // Сбрасываем счетчик съеденных при установке новых
    this.isProcessingLevelTransition = false;
  }

  // Если нужно вручную сбросить прогресс уровня
  resetLevelProgress(): void {
    this.dotsEaten = 0;
    this.isProcessingLevelTransition = false;
  }

  // Хелпер для смены конфига (вызывается из Director)
  updateLevelConfig(level: number): void {
    this.currentLevel = level;
    this.levelData = generateLevelConfig(level);
  }
}
