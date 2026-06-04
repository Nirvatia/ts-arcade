import { Clock } from "../core/Clock.svelte.js";
import { eventBus } from "../core/EventBus.js";
import { GameRegistry } from "./GameRegistry.js";
import { GameState } from "./GameState.svelte.js";
import { Tally } from "./Tally.svelte.js";
import { SceneRegistry } from "../scenes/SceneRegistry.js";
import { GameRenderer } from "../render/GameRenderer.js";
import { Renderer } from "../render/Renderer.js";
import { GameLoop } from "../core/GameLoop.js";
import { SceneRenderer } from "../render/SceneRenderer.js";
import { Sequence } from "../core/Sequence.js";
import { trackClockLifespan } from "../debug/trackClockLifespan.js";

// Constants
const TRANSITION_DURATION = 5;
const INTERMISSION_DURATION = 10;
const FLASH_COUNT = 4;
const FLASH_INTERVAL_MS = 400;
const GHOST_EAT_PAUSE_DURATION = 1;

export class Director {
  private static instance: Director;
  private gameState: GameState;
  private registry: GameRegistry;
  private tally: Tally;
  private sceneRegistry: SceneRegistry;
  private gameLoop: GameLoop;
  private renderer: Renderer;
  private sceneRenderer: SceneRenderer;
  private gameRenderer: GameRenderer;

  private _currentClock: Clock | null = null;
  private activeSequence: Sequence = new Sequence();

  private constructor() {
    this.gameState = GameState.getInstance();
    this.registry = GameRegistry.getInstance();
    this.tally = Tally.getInstance();
    this.sceneRegistry = SceneRegistry.getInstance();
    this.gameLoop = GameLoop.getInstance();
    this.renderer = Renderer.getInstance();
    this.gameRenderer = GameRenderer.getInstance();
    this.sceneRenderer = SceneRenderer.getInstance();
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

    this.gameLoop.stop();

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
    eventBus.on("pacman:death_animation_end", () => this.evaluateLifeLoss());
    eventBus.on("command:ghost_eaten", () => this.triggerGhostEatenSequence());
  }

  loadGame(): void {
    eventBus.emit("command:create_all");
    this.loadLevel();

    const updatables = this.registry.getAllUpdatable();
    const drawables = this.registry.getAllDrawable();

    this.gameLoop.setUpdatables(updatables);
    this.gameRenderer.setDrawables(drawables);
  }

  startGame(): void {
    this.resetTickingState();

    this.gameLoop.start();

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
        this._currentClock = null;
      },
    );
  }

  restartGame(): void {
    this.loadLevel();

    const updatables = this.registry.getAllUpdatable();
    const drawables = this.registry.getAllDrawable();
    this.gameLoop.setUpdatables(updatables);
    this.gameRenderer.setDrawables(drawables);

    this.gameLoop.start();
    this.startGame();
  }

  loadLevel(): void {
    eventBus.emit("command:reset_all");
    eventBus.emit("command:setup_environment");
    eventBus.emit("command:create_path_graph");
    eventBus.emit("command:spawn_actors");
  }

  triggerGhostEatenSequence(): void {
    this.resetTickingState();

    const clock = this.createClock("GhostEatPause");

    clock.start(
      GHOST_EAT_PAUSE_DURATION,
      1000,
      () => {},
      () => {
        eventBus.emit("game:resumed");
      },
    );
  }

  handlePacmanDeath(): void {
    this.resetTickingState();
  }

  private evaluateLifeLoss(): void {
    this.resetTickingState();

    // Deduct the life inside GameState
    eventBus.emit("command:execute_life_loss", {
      currentScore: this.tally.score,
    });

    // Clean, explicit branching. No hidden conditional checks down the line.
    if (this.gameState.mode === "GAME_OVER") {
      // GameState has already emitted "game:over", which triggers handleGameOver()
      return;
    }

    // If we survived, explicitly move to the next logical phase
    this.startRespawnCountdown();
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
        this._currentClock = null;
      },
    );
  }

  triggerIntermission(payload: { level: number; score: number }): void {
    this.resetTickingState();

    const maze = this.registry.getMaze();

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

      // Step 1: Allocate the scene in memory safely
      this.sceneRegistry.loadRandomScene();
      const newScene = this.sceneRegistry.getActiveScene();

      if (!newScene) {
        throw new Error("[Director] Failed to resolve active scene resource.");
      }

      // Step 2: Explicitly PUSH the cache pointer to the engine cores.
      // There is zero guessing games or race conditions here.
      this.gameLoop.setActiveScene(newScene);
      this.sceneRenderer.setActiveScene(newScene);

      this.renderer.switchRenderer("INTERMISSION");

      // Step 3: Now it is perfectly safe to broadcast that the phase has started
      eventBus.emit("level:intermission_start", {
        nextLevel: payload.level + 1,
      });

      // Step 4: Fire the scene timeline execution
      this.sceneRegistry.startActiveScene(INTERMISSION_DURATION, () => {
        eventBus.emit("command:clear_canvases");

        // Step 5: Clean teardown. Scrub the references explicitly.
        this.gameLoop.setActiveScene(null);
        this.sceneRenderer.setActiveScene(null);
        this.sceneRenderer.clear();

        eventBus.emit("game:mode_change", { mode: "LEVEL_TRANSITION" });
        this.loadLevel();

        const updatables = this.registry.getAllUpdatable();
        const drawables = this.registry.getAllDrawable();
        this.gameLoop.setUpdatables(updatables);
        this.gameRenderer.setDrawables(drawables);
        this.renderer.switchRenderer("LEVEL_TRANSITION");

        this.startGame();
      });
    });

    this.activeSequence.start();
  }
}
