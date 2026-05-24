// src/game/director.ts
import { Clock } from "../core/clock.js";
import { eventBus } from "../core/eventBus.js";
import { GameLoop } from "../core/gameLoop.js";
import { sfx } from "../sfx/sfx.js";
import { createPathGraph } from "../utils.js";
import { GameRegistry } from "./gameRegistry.js";
import { GameState } from "./gameState.js";
import { Sequence } from "./sequence.js";
import { Tally } from "./tally.js";

export class Director {
  private static instance: Director;
  private gameState: GameState;
  private registry: GameRegistry;
  private tally: Tally;
  private gameLoop: GameLoop;
  private activeClock: Clock = new Clock();
  private activeSequence: Sequence = new Sequence();

  private constructor() {
    this.gameState = GameState.getInstance();
    this.registry = GameRegistry.getInstance();
    this.tally = Tally.getInstance();
    this.gameLoop = GameLoop.getInstance();

    this.initCommandListeners();
    this.gameLoop.start();
  }

  static getInstance(): Director {
    if (!Director.instance) Director.instance = new Director();
    return Director.instance;
  }

  private initCommandListeners(): void {
    eventBus.on("game:load", () => this.loadGame());
    eventBus.on("game:start", () => this.startGame());
    eventBus.on("game:restart", () => this.restartGame());
    eventBus.on("game:over", () => this.handleGameOver());
    eventBus.on("level:complete", () => this.triggerIntermissionSequence());
    eventBus.on("pacman:death_triggered", () => this.triggerDeathSequence());
    eventBus.on("command:death_sequence_continue", () =>
      this.completeDeathSequence(),
    );
    eventBus.on("command:ghost_eaten", (data: { ghostName: string }) =>
      this.triggerGhostEatenSequence(data),
    );
  }

  get currentClock(): Clock {
    return this.activeClock;
  }

  private resetTickingState(): void {
    this.activeClock.stop();
    this.activeSequence.clear();
  }

  triggerGhostEatenSequence(data: { ghostName: string }): void {
    this.resetTickingState();

    const ghostEatenDuration = 1000;
    this.activeClock.start(
      ghostEatenDuration / 1000,
      ghostEatenDuration,
      () => {},
      () => {
        eventBus.emit("game:resumed"); // Centralized decoupled mode management
      },
    );
  }

  private handleGameOver(): void {
    this.resetTickingState();
  }

  restartGame(): void {
    this.resetTickingState();
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

    eventBus.emit("level:transition_start", { duration: 4 });
    eventBus.emit("command:spawn_entities");
    this.gameState.pathGraph = createPathGraph(this.gameState.levelData.map);

    const trackDuration = sfx.getTrackDuration("start");
    const countdownTime = trackDuration > 0 ? Math.ceil(trackDuration) : 4;

    this.activeClock.start(
      countdownTime,
      1000,
      () => {},
      () => {
        eventBus.emit("command:exit_lair_all");
        eventBus.emit("command:init_all");
        eventBus.emit("game:started");
        eventBus.emit("level:transition_end");
      },
    );
  }

  triggerDeathSequence(): void {
    this.resetTickingState();

    const pacman = this.registry.getPacman();
    eventBus.emit("pacman:death_animation_start", { x: pacman.x, y: pacman.y });

    const deathDuration = sfx.getTrackDuration("death") || 2;
    const msDuration = deathDuration * 1000 + 200;

    this.activeSequence
      .addWait(msDuration)
      .addCallback(() => {
        eventBus.emit("command:execute_life_loss", {
          currentScore: this.tally.score,
        });
      })
      .start();
  }

  // src/game/director.ts
  completeDeathSequence(): void {
    this.resetTickingState();
    eventBus.emit("command:reset_positions");
    eventBus.emit("level:transition_start", { duration: 3 });
    eventBus.emit("pacman:death_animation_end");

    this.activeClock.start(
      3,
      1000,
      () => {},
      () => {
        eventBus.emit("command:exit_lair_all");
        eventBus.emit("game:resumed"); 
        eventBus.emit("level:transition_end");
      },
    );
  }

  triggerIntermissionSequence(): void {
    this.resetTickingState();

    const maze = this.registry.getMaze();

    // 1. Flash the maze walls
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

    // 2. Complete transition, show splash screen, wait 5 seconds, then boot next level
    this.activeSequence
      .addCallback(() => {
        eventBus.emit("command:clear_canvases");
        eventBus.emit("level:intermission_start", {
          nextLevel: this.gameState.currentLevel + 1,
        });
      })
      .addWait(5000)
      .addCallback(() => {
        this.loadLevel();
        this.startGame();
      })
      .start();
  }
}
