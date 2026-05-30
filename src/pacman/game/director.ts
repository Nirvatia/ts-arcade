// src/game/director.ts
import { Clock } from "../core/clock.svelte.js";
import { eventBus } from "../core/eventBus.js";
import { sfx } from "../sfx/sfx.js";
import { createPathGraph } from "../utils.js";
import { GameRegistry } from "./gameRegistry.js";
import { GameState } from "./gameState.svelte.js";
import { Sequence } from "../core/sequence.js";
import { Tally } from "./tally.svelte.js";

export class Director {
  private static instance: Director;
  private gameState: GameState;
  private registry: GameRegistry;
  private tally: Tally;
  private activeClock: Clock = new Clock();
  private activeSequence: Sequence = new Sequence();

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
    
    eventBus.on("level:complete", (payload) => this.triggerIntermissionSequence(payload));
    eventBus.on("pacman:death_triggered", () => this.triggerDeathSequence());
    eventBus.on("command:death_sequence_continue", () => this.completeDeathSequence());
    eventBus.on("command:ghost_eaten", (data) => this.triggerGhostEatenSequence(data));
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
        eventBus.emit("game:resumed"); 
      },
    );
  }

  private handleGameOver(): void {
    this.resetTickingState();
    eventBus.emit("ui:game_over_show", { 
      score: this.tally.score, 
      level: this.gameState.currentLevel 
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
    if (!pacman) return; // Defensive guard statement

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

  triggerIntermissionSequence(payload: { level: number; score: number }): void {
    this.resetTickingState();
    const maze = this.registry.getMaze();
    if (!maze) return;

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

    this.activeSequence
      .addCallback(() => {
        eventBus.emit("command:clear_canvases");
        eventBus.emit("level:intermission_start", {
          nextLevel: payload.level + 1,
        });
      })
      .addWait(5000)
      .start(() => {
        this.loadLevel();
        this.startGame();
      });
  }
}