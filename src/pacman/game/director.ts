import { Clock } from "../core/clock.svelte.js";
import { eventBus } from "../core/eventBus.js";
import { createPathGraph } from "../utils.js";
import { GameRegistry } from "./gameRegistry.js";
import { GameState } from "./gameState.svelte.js";
import { Sequence } from "../core/sequence.js";
import { Tally } from "./tally.svelte.js";
import { SceneRegistry } from "../scenes/sceneRegistry.js";
import type { IGameScene } from "../interfaces.js";

export class Director {
  private static instance: Director;
  private gameState: GameState;
  private registry: GameRegistry;
  private tally: Tally;

  // Isolated timers to prevent Svelte UI state confusion
  private transitionClock: Clock = new Clock();
  private activeSequence: Sequence = new Sequence();

  private sceneRegistry: SceneRegistry = new SceneRegistry();
  private activeIntermissionScene: IGameScene | null = null;

  private constructor() {
    this.gameState = GameState.getInstance();
    this.registry = GameRegistry.getInstance();
    this.tally = Tally.getInstance();
    this.initEventListeners();
  }

  static getInstance(): Director {
    if (!Director.instance) Director.instance = new Director();
    return Director.instance;
  }

  private initEventListeners(): void {
    eventBus.on("game:load", () => this.loadGame());
    eventBus.on("game:start", () => this.startGame());
    eventBus.on("game:restart", () => this.restartGame());
    eventBus.on("game:over", () => this.handleGameOver());

    eventBus.on("level:complete", (payload) =>
      this.triggerIntermissionSequence(payload),
    );
    eventBus.on("pacman:death_triggered", () => this.triggerDeathSequence());
    eventBus.on("command:death_sequence_continue", () =>
      this.completeDeathSequence(),
    );
    eventBus.on("command:ghost_eaten", (data) =>
      this.triggerGhostEatenSequence(data),
    );
  }

  // Hook the Svelte UI countdown property strictly to the level intro timer
  get currentClock(): Clock {
    return this.transitionClock;
  }

  public get currentIntermissionScene(): IGameScene | null {
    return this.activeIntermissionScene;
  }

  private resetTickingState(): void {
    this.transitionClock.stop();
    this.activeSequence.clear();
  }

  triggerGhostEatenSequence(data: { ghostName: string }): void {
    this.resetTickingState();
    // Reusing transition clock for short freeze frames is safe
    this.transitionClock.start(
      1,
      1000,
      () => {},
      () => {
        eventBus.emit("game:resumed");
      },
    );
  }

  private handleGameOver(): void {
    this.resetTickingState();
    eventBus.emit("ui:game_over_show", {
      score: this.tally.score,
      level: this.gameState.currentLevel,
    });
  }

  restartGame(): void {
    this.loadLevel();
    this.startGame();
  }

  loadGame(): void {
    eventBus.emit("command:create_entities");
    this.loadLevel();
  }

  loadLevel(): void {
    eventBus.emit("command:reset_all");
    eventBus.emit("command:setup_environment");
  }

  startGame(): void {
    this.resetTickingState();

    eventBus.emit("level:transition_start", { duration: 5 });
    eventBus.emit("command:spawn_entities");
    this.gameState.pathGraph = createPathGraph(this.gameState.levelData.map);

    // This drives the UI "READY!" text
    this.transitionClock.start(
      5,
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

  triggerDeathSequence(): void {
    this.resetTickingState();
    const pacman = this.registry.getPacman();
    if (!pacman) return;

    eventBus.emit("pacman:death_animation_start", { x: pacman.x, y: pacman.y });

    this.activeSequence
      .addWait(3000)
      .addCallback(() => {
        eventBus.emit("command:execute_life_loss", {
          currentScore: this.tally.score,
        });
      })
      .start();
  }

  completeDeathSequence(): void {
    this.resetTickingState();
    eventBus.emit("pacman:death_animation_end");
    eventBus.emit("command:reset_positions");
    eventBus.emit("level:transition_start", { duration: 5 });

    this.transitionClock.start(
      5,
      1000,
      () => {},
      () => {
        eventBus.emit("level:transition_end");
        eventBus.emit("game:resumed");
        eventBus.emit("command:exit_lair_all");
      },
    );
  }

  // Inside src/game/director.ts

  triggerIntermissionSequence(payload: { level: number; score: number }): void {
    this.resetTickingState();
    const maze = this.registry.getMaze();
    if (!maze) return;

    // Phase 1: Flash the maze 4 times
    for (let i = 0; i < 4; i++) {
      this.activeSequence
        .addCallback(() => {
          maze.isFlashing = true;
          maze.requestRedraw();
        })
        .addWait(400)
        .addCallback(() => {
          maze.isFlashing = false;
          maze.requestRedraw();
        })
        .addWait(400);
    }

    // Phase 2: Run the Intermission Screen
    this.activeSequence
      .addCallback(() => {
        eventBus.emit("command:clear_canvases");
        eventBus.emit("level:intermission_start", {
          nextLevel: payload.level + 1,
        });

        this.activeIntermissionScene = this.sceneRegistry.getRandomScene();
        this.activeIntermissionScene.start(5, () => {});
      })
      .addWait(5000) // Keep the engine loop locked in INTERMISSION mode for 5s

      // Phase 3: Explicit Exit, Cleanup, and Mode Pivot
      .addCallback(() => {
        if (
          this.activeIntermissionScene &&
          "clear" in this.activeIntermissionScene
        ) {
          (this.activeIntermissionScene as any).clear();
        }
        this.activeIntermissionScene = null;
        eventBus.emit("command:clear_canvases");

        // FIX: Force change the engine state back to level transition view state
        this.gameState.mode = "LEVEL_TRANSITION";

        // Load the fresh map assets into memory buffers
        this.loadLevel();
      })

      // Phase 4: Spin up next level countdown tracking smoothly
      .start(() => {
        this.startGame();
      });
  }
}
