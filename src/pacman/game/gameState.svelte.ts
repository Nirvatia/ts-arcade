import { Clock } from "../core/Clock.svelte.js";
import { eventBus } from "../core/EventBus.js";
import { generateLevelConfig } from "../shared/utils.js";

import type { GameMode } from "../shared/gameModes.js";
import type { GraphType, LevelConfigType, TileType } from "../shared/types.js";

export class GameState {
  private _state = $state({
    mode: "INIT" as GameMode,
    lives: 3,
    currentLevel: 1,
  });

  public deathProgress = $state(0);

  public pathGraph: GraphType | null = null;
  public levelData: LevelConfigType;

  public activeDots = new Set<string>();
  public activePills = new Set<string>();

  public totalDots: number = 0;
  public isBuffed: boolean = false;
  public isProcessingLevelTransition: boolean = false;

  private buffClock: Clock = new Clock();

  constructor() {
    this.levelData = generateLevelConfig(this.currentLevel);
    this.initEventListeners();
  }

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
      this.decrementLivesNotification();
    }
  }

  private decrementLivesNotification(): void {
    eventBus.emit("ui:lives_display_update", { lives: this._state.lives });
  }

  public get currentLevel(): number {
    return this._state.currentLevel;
  }

  public set currentLevel(value: number) {
    this._state.currentLevel = value;
  }

  public reset(): void {
    this._state.currentLevel = 1;
    this.lives = 3;
    this.activeDots.clear();
    this.activePills.clear();
    this.totalDots = 0;
  }

  /**
   * Performs an absolute layout parse. Only run this during intermissions/true level resets.
   */
  public initializeCollectibles(grid: TileType[][]): void {
    this.activeDots.clear();
    this.activePills.clear();

    let dotCount = 0;

    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const tile = grid[i][j];

        if (tile === "DT") {
          this.activeDots.add(`${i},${j}`);
          dotCount++;
        } else if (tile === "PP") {
          this.activePills.add(`${i},${j}`);
        }
      }
    }

    this.totalDots = dotCount;
    this.isProcessingLevelTransition = false;

    eventBus.emit("dot:spawned", { count: this.totalDots });
  }

  public eatDot(i: number, j: number): number {
    this.activeDots.delete(`${i},${j}`);

    if (this.activeDots.size === 0 && !this.isProcessingLevelTransition) {
      this.isProcessingLevelTransition = true;
      eventBus.emit("level:complete", {
        level: this.currentLevel,
        score: 0,
      });
    }

    return this.activeDots.size;
  }

  public eatPill(i: number, j: number): boolean {
    return this.activePills.delete(`${i},${j}`);
  }

  private initEventListeners(): void {
    eventBus.on("level:intermission_start", (data) => {
      this.mode = "INTERMISSION";
      this.currentLevel = data.nextLevel;
      this.isProcessingLevelTransition = false;
      this.levelData = generateLevelConfig(this.currentLevel);
    });

    eventBus.on("dot:collect", (data) => {
      const remainingCount = this.eatDot(data.position.i, data.position.j);

      eventBus.emit("dot:eaten", {
        position: data.position,
        dotsRemaining: remainingCount,
      });
    });

    eventBus.on("power_pill:collect", (data) => {
      const wasEaten = this.eatPill(data.position.i, data.position.j);

      if (wasEaten) {
        eventBus.emit("power_pill:eaten", { position: data.position });
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
      eventBus.emit("power_pill:activated", {
        duration: this.levelData.buffDuration,
      });
    });

    eventBus.on("bonus_life:acquired", (data) => {
      this._state.lives += 1;
      eventBus.emit("ui:lives_display_update", { lives: this._state.lives });
    });
  }
}
