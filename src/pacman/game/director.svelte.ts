import { Clock } from "../core/clock.svelte.js";
import { eventBus } from "../core/eventBus.js";
import { GameRegistry } from "./gameRegistry.js";
import { GameState } from "./gameState.svelte.js";
import { Sequence } from "../core/sequence.js";
import { Tally } from "./tally.svelte.js";
import { SceneRegistry } from "../scenes/sceneRegistry.js";
import type { IGameScene } from "../interfaces.js";
import { trackClockLifespan } from "../debug/garbageCollector.js";
import { createPathGraph } from "../pathfinding/graph.js";

export class Director {
  private static instance: Director;
  private gameState: GameState;
  private registry: GameRegistry;
  private tally: Tally;

  private transitionClock = $state<Clock | null>(null);
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

  public get currentClock(): Clock | null {
    return this.transitionClock;
  }

  public get currentIntermissionScene(): IGameScene | null {
    return this.activeIntermissionScene;
  }

  private resetTickingState(): void {
    if (this.transitionClock) {
      this.transitionClock.stop();
    }
    this.activeSequence.clear();
  }

  private spawnFreshClock(): Clock {
    if (this.transitionClock) {
      this.transitionClock.stop();
    }

    this.transitionClock = new Clock();

    trackClockLifespan(
      this.transitionClock,
      `Clock_Level_${this.gameState.currentLevel}`,
    );

    return this.transitionClock;
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
      this.triggerIntermissionSequence(payload),
    );

    eventBus.on("pacman:death_triggered", () => this.handlePacmanDeath());

    eventBus.on("pacman:death_animation_end", () =>
      this.startRespawnCountdown(),
    );

    eventBus.on("command:ghost_eaten", (data) =>
      this.triggerGhostEatenSequence(data),
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
    eventBus.emit("command:spawn_actors");
  }

  startGame(): void {
    this.resetTickingState();

    eventBus.emit("level:transition_start", { duration: 5 });
    this.gameState.pathGraph = createPathGraph(this.gameState.levelData.map);

    const clock = this.spawnFreshClock();
    clock.start(
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

  triggerGhostEatenSequence(data: { ghostName: string }): void {
    this.resetTickingState();

    const clock = this.spawnFreshClock();
    clock.start(
      1,
      1000,
      () => {},
      () => {
        eventBus.emit("game:resumed");
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
    eventBus.emit("level:transition_start", { duration: 5 });

    const clock = this.spawnFreshClock();
    clock.start(
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
        this.activeIntermissionScene.start(10, () => {});
      })
      .addWait(10000)

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

        this.gameState.mode = "LEVEL_TRANSITION";
        this.loadLevel();
      })

      // Phase 4: Spin up next level countdown tracking smoothly
      .start(() => {
        this.startGame();
      });
  }
}
