// src/game/director.ts
import { Clock } from "../core/clock.js";
import { eventBus } from "../core/eventBus.js";
import { GameLoop } from "../core/gameLoop.js";
import { sfx } from "../sfx/sfx.js";
import { createPathGraph } from "../utils.js";
import { Environment } from "../world/environment.js";
import { GameRegistry } from "./gameRegistry.js";
import { GameState } from "./gameState.js";
import { Sequence } from "./sequence.js";
import { Tally } from "./tally.js";

export class Director {
  private static instance: Director;
  private gameState: GameState;
  private gameLoop: GameLoop;
  private registry: GameRegistry;
  private environment: Environment;
  private tally: Tally;
  private activeClock: Clock | null = null;

  private constructor() {
    this.gameState = GameState.getInstance();
    this.registry = GameRegistry.getInstance();
    this.environment = Environment.getInstance();
    this.tally = Tally.getInstance();
    this.gameLoop = GameLoop.getInstance();

    // ГЛАВНОЕ: Директор слушает команды из шины
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
    eventBus.on("level:complete", () => this.triggerIntermissionSequence());
    eventBus.on("pacman:death_triggered", () => this.triggerDeathSequence());
    eventBus.on("command:ghost_eaten", (data: { ghostName: string }) =>
      this.triggerGhostEatenSequence(data),
    );
  }

  private triggerGhostEatenSequence(data: { ghostName: string }): void {
    this.stopActiveClock();
    this.gameState.mode = "GHOST_EATEN";

    const ghostEatenDuration = 1000;

    this.activeClock = new Clock();
    this.activeClock.start(
      ghostEatenDuration / 1000,
      ghostEatenDuration,
      () => {},
      () => {
        this.gameState.mode = "PLAYING";
        this.activeClock = null;
      },
    );
  }

  get currentClock(): Clock | null {
    return this.activeClock;
  }

  loadGame(): void {
    this.registry.createEntities();
    this.loadLevel();
    this.gameState.mode = "INIT";
  }

  loadLevel(): void {
    this.tally.resetForLevel();
    this.registry.resetAll();
    this.gameState.updateLevelConfig(this.gameState.currentLevel);
    this.gameState.dotsEaten = 0; // ОБЯЗАТЕЛЬНО ОБНУЛЯЕМ ТУТ
    this.gameState.isProcessingLevelTransition = false;
    this.environment.setup();
  }

  startGame(): void {
    if (this.gameState.mode === "LEVEL_TRANSITION") return;
    this.stopActiveClock();
    this.gameState.mode = "LEVEL_TRANSITION";

    eventBus.emit("level:transition_start", { duration: 4 });
    this.registry.spawnEntities();
    this.gameState.pathGraph = createPathGraph(this.gameState.levelData.map);

    const trackDuration = sfx.getTrackDuration("start");
    const countdownTime = trackDuration > 0 ? Math.ceil(trackDuration) : 4;

    this.activeClock = new Clock();
    this.activeClock.start(
      countdownTime,
      1000,
      () => {},
      () => {
        this.registry.exitLairAll();
        this.registry.initAll();
        eventBus.emit("game:started");
        eventBus.emit("level:transition_end");
        this.gameState.mode = "PLAYING";
        this.activeClock = null;
      },
    );
  }

  triggerDeathSequence(): void {
    this.gameState.mode = "PACMAN_DEAD";

    // Get Pacman's actual position for the death animation
    const pacman = this.registry.getPacman();
    eventBus.emit("pacman:death_animation_start", {
      x: pacman.x,
      y: pacman.y,
    });

    const deathDuration = sfx.getTrackDuration("death") || 2;

    setTimeout(
      () => {
        const remainingLives = this.tally.loseLife();
        if (remainingLives < 0) {
          this.handleGameOver();
        } else {
          this.completeDeathSequence();
        }
      },
      deathDuration * 1000 + 200,
    );
  }

  completeDeathSequence(): void {
    this.stopActiveClock();
    this.registry.resetPositionsForDeath();
    this.gameState.mode = "LEVEL_TRANSITION";

    eventBus.emit("level:transition_start", { duration: 3 });
    eventBus.emit("pacman:death_animation_end");

    this.activeClock = new Clock();
    this.activeClock.start(
      3,
      1000,
      () => {},
      () => {
        this.registry.exitLairAll();
        eventBus.emit("game:resumed");
        eventBus.emit("level:transition_end");
        this.gameState.mode = "PLAYING";
        this.activeClock = null;
      },
    );
  }

  triggerIntermissionSequence(): void {
    this.gameState.mode = "LEVEL_COMPLETE";
    const maze = this.registry.getMaze();
    const sequence = new Sequence();

    // Maze flash
    for (let i = 0; i < 4; i++) {
      sequence
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

    sequence.addCallback(() => {
      this.registry.clearAllCanvases();
      this.gameState.mode = "INTERMISSION";
      eventBus.emit("level:intermission_start", {
        nextLevel: this.gameState.currentLevel + 1,
      });

      setTimeout(() => this.nextLevel(), 5000);
    });
    sequence.start();
  }

  nextLevel(): void {
    this.gameState.currentLevel++;
    this.loadLevel();
    this.startGame();
  }

  private handleGameOver(): void {
    this.gameState.mode = "GAME_OVER";
    this.stopActiveClock();
    eventBus.emit("game:over", {
      finalScore: this.tally.score,
      level: this.gameState.currentLevel,
    });
  }

  restartGame(): void {
    this.tally.reset();
    this.gameState.currentLevel = 1;
    this.gameState.dotsEaten = 0;
    this.loadLevel();
    this.startGame();
  }

  private stopActiveClock(): void {
    if (this.activeClock) {
      this.activeClock.stop();
      this.activeClock = null;
    }
  }
}
