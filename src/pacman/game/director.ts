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
    eventBus.on("COMMAND_LOAD_GAME", () => this.loadGame());
    eventBus.on("COMMAND_START_GAME", () => this.startGame());
    eventBus.on("COMMAND_RESTART_GAME", () => this.restartGame());
    eventBus.on("COMMAND_INTERMISSION", () =>
      this.triggerIntermissionSequence(),
    );
    eventBus.on("PACMAN_DEATH_TRIGGER", () => this.triggerDeathSequence());
     eventBus.on("COMMAND_GHOST_EATEN", (data: { ghostName: string }) => 
    this.triggerGhostEatenSequence(data)
  );
  }

  private triggerGhostEatenSequence(data: { ghostName: string }): void {
  this.stopActiveClock();
  
  // Set the freeze mode
  this.gameState.mode = "GHOST_EATEN";
  
  // Emit so the ghost can transition to EATEN state
  // (Ghost already handles this in its own listener, 
  //  but we ensure the freeze happens here at the Director level)
  
  const ghostEatenDuration = 1000; // 1 second freeze — adjust as needed
  
  this.activeClock = new Clock();
  this.activeClock.start(
    ghostEatenDuration / 1000,
    ghostEatenDuration,
    () => {},
    () => {
      // Resume gameplay
      this.gameState.mode = "PLAYING";
      this.activeClock = null;
    }
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

    eventBus.emit("GAME_START_SEQUENCE");
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
        eventBus.emit("GAME_START");
        this.gameState.mode = "PLAYING";
        this.activeClock = null;
      },
    );
  }

  triggerDeathSequence(): void {
    this.gameState.mode = "PACMAN_DEAD";
    eventBus.emit("PACMAN_DEATH");
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
    eventBus.emit("GAME_START_SEQUENCE");

    this.activeClock = new Clock();
    this.activeClock.start(
      3,
      1000,
      () => {},
      () => {
        this.registry.exitLairAll();
        eventBus.emit("GAME_RESUMED");
        this.gameState.mode = "PLAYING";
        this.activeClock = null;
      },
    );
  }

  triggerIntermissionSequence(): void {
    this.gameState.mode = "LEVEL_COMPLETE";
    const maze = this.registry.getMaze();
    const sequence = new Sequence();

    // Моргание лабиринта
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
      eventBus.emit("INTERMISSION_START");

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
    eventBus.emit("GAME_OVER_SEQUENCE");
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
