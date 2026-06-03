import { Clock } from "../core/clock.svelte.js";
import { eventBus } from "../core/eventBus.js";
import { GameRegistry } from "./gameRegistry.js";
import { GameState } from "./gameState.svelte.js";
import { Sequence } from "../core/sequence.js";
import { Tally } from "./tally.svelte.js";
import { SceneRegistry } from "../scenes/sceneRegistry.js";
import { trackClockLifespan } from "../debug/garbageCollector.js";

// Constants
const TRANSITION_DURATION = 5; // seconds
const INTERMISSION_DURATION = 10; // seconds
const FLASH_COUNT = 4;
const FLASH_INTERVAL_MS = 400;

export class Director {
  private static instance: Director;
  private gameState: GameState;
  private registry: GameRegistry;
  private tally: Tally;
  private sceneRegistry: SceneRegistry;

  private _currentClock: Clock | null = null;
  private activeSequence: Sequence = new Sequence();

  private constructor() {
    this.gameState = GameState.getInstance();
    this.registry = GameRegistry.getInstance();
    this.tally = Tally.getInstance();
    this.sceneRegistry = new SceneRegistry();
    this.initEventListeners();
  }

  public get currentClock(): Clock | null {
    return this._currentClock;
  }

  static getInstance(): Director {
    if (!Director.instance) Director.instance = new Director();
    return Director.instance;
  }

  private resetTickingState(): void {
    if (this._currentClock) {
      this._currentClock.stop();
      this._currentClock = null;
    }
    this.activeSequence.clear();
  }

  private createClock(name: string): Clock {
    const clock = new Clock();
    trackClockLifespan(clock, name);
    this._currentClock = clock;
    return clock;
  }

  private handleGameOver(): void {
    this.resetTickingState();
    eventBus.emit("ui:game_over_show", {
      score: this.tally.score,
      level: this.gameState.currentLevel,
    });
  }

  private initEventListeners(): void {
    eventBus.on("game:load", () => this.loadGame());
    eventBus.on("game:start", () => this.startGame());
    eventBus.on("game:restart", () => this.restartGame());
    eventBus.on("game:over", () => this.handleGameOver());
    eventBus.on("level:complete", (payload) =>
      this.triggerIntermission(payload),
    );
    eventBus.on("pacman:death_triggered", () => this.handlePacmanDeath());
    eventBus.on("pacman:death_animation_end", () =>
      this.startRespawnCountdown(),
    );
  }

  restartGame(): void {
    this.loadLevel();
    this.startGame();
  }

  loadGame(): void {
    eventBus.emit("command:create_all");
    this.loadLevel();
  }

  loadLevel(): void {
    eventBus.emit("command:reset_all");
    eventBus.emit("command:setup_environment");
    eventBus.emit("command:create_path_graph");
    eventBus.emit("command:spawn_actors");
  }

  startGame(): void {
    this.resetTickingState();
    eventBus.emit("level:transition_start", { duration: TRANSITION_DURATION });

    const clock = this.createClock(
      `Clock_Level_${this.gameState.currentLevel}`,
    );

    clock.start(
      TRANSITION_DURATION,
      1000,
      () => {},
      () => {
        eventBus.emit("level:transition_end");
        eventBus.emit("game:started");
        eventBus.emit("command:init_all");
        eventBus.emit("command:exit_lair_all");
      },
    );
  }

  handlePacmanDeath(): void {
    this.resetTickingState();
    eventBus.emit("command:execute_life_loss", {
      currentScore: this.tally.score,
    });
  }

  startRespawnCountdown(): void {
    this.resetTickingState();

    eventBus.emit("command:reset_actors");
    eventBus.emit("command:spawn_actors");
    eventBus.emit("level:transition_start", { duration: TRANSITION_DURATION });

    const clock = this.createClock(
      `Respawn_Clock_Level_${this.gameState.currentLevel}`,
    );

    clock.start(
      TRANSITION_DURATION,
      1000,
      () => {},
      () => {
        eventBus.emit("level:transition_end");
        eventBus.emit("game:resumed");
        eventBus.emit("command:exit_lair_all");
      },
    );
  }

  triggerIntermission(payload: { level: number; score: number }): void {
    this.resetTickingState();
    const maze = this.registry.getMaze();
    if (!maze) {
      console.error("[Director] Cannot start intermission: no maze available");
      this.startGame();
      return;
    }

    for (let i = 0; i < FLASH_COUNT; i++) {
      this.activeSequence
        .addCallback(() => {
          maze.isFlashing = true;
          maze.requestRedraw();
        })
        .addWait(FLASH_INTERVAL_MS)
        .addCallback(() => {
          maze.isFlashing = false;
          maze.requestRedraw();
        })
        .addWait(FLASH_INTERVAL_MS);
    }

    this.activeSequence.addCallback(() => {
      eventBus.emit("command:clear_canvases");
      eventBus.emit("level:intermission_start", {
        nextLevel: payload.level + 1,
      });

      this.sceneRegistry.startRandomScene(INTERMISSION_DURATION, () => {
        eventBus.emit("command:clear_canvases");
        eventBus.emit("game:mode_change", { mode: "LEVEL_TRANSITION" });
        this.loadLevel();
        this.startGame();
      });
    });

    this.activeSequence.start();
  }
}
