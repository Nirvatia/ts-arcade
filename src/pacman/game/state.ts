import { LEVEL_CONFIGS } from "../config/levels.js";
import { SCORE_CONFIG } from "../config/scoring.js";
import { EntityManager } from "../entities/entityManager.js";
import { Collision } from "./collision.js";
import { eventBus } from "./eventBus.js";
import { GameLoop } from "./loop.js";
import { Timer } from "./timer.js";

import type { GameMode, GraphType, LevelConfigType } from "../types.js";
import { createPathGraph } from "../utils.js";
import { audio } from "./audio.js";

class GameState {
  private static instance: GameState;
  private entityManager: EntityManager;
  private gameLoop: GameLoop;

  public pathGraph: GraphType | null;
  private buffTimer: Timer = new Timer();
  private buffDuration = LEVEL_CONFIGS[1].buffDuration;
  private buffThreshold = LEVEL_CONFIGS[1].buffThreshold;

  public mode: GameMode = "INIT";
  public lives: number;
  public currentLevel: number;
  public levelData: LevelConfigType;
  public score: number;
  public ghostMultiplier: number;

  private constructor() {
    this.entityManager = EntityManager.getInstance();
    this.gameLoop = GameLoop.getInstance();
    this.pathGraph = null;
    this.lives = 3;
    this.currentLevel = 1;
    this.levelData = LEVEL_CONFIGS[1];
    this.score = 0;
    this.ghostMultiplier = 0;
  }

  static getInstance(): GameState {
    if (!GameState.instance) GameState.instance = new GameState();
    return GameState.instance;
  }

  private getLevelConfig(level: number): LevelConfigType {
    return LEVEL_CONFIGS[level] || LEVEL_CONFIGS[1];
  }

  public loadGame() {
    this.entityManager.createEntities();
    this.loadLevel();
    this.gameLoop.start();
    this.mode = "INIT";
  }

  public loadLevel() {
    const collision = Collision.getInstance();
    this.levelData = this.getLevelConfig(this.currentLevel);

    // 1. Hard reset on everything (clears grids, scores stay intact)
    this.entityManager.resetAll();

    // 2. Draw the maze & dots immediately
    this.entityManager.spawnObjects();

    this.buffDuration = LEVEL_CONFIGS[this.currentLevel].buffDuration;
    this.buffThreshold = LEVEL_CONFIGS[this.currentLevel].buffThreshold;
    collision.initTeleports(this.levelData.map);
  }

  // 🔥 REMOVED: resetLevel() because it pointed to a non-existent method!

  public nextLevel() {
    this.currentLevel++;
    this.loadLevel();

    // 🔥 NEW: Apply the countdown transition to new level loaded!
    const ui = this.entityManager.getUI();
    this.mode = "LEVEL_TRANSITION";

    const timer = new Timer();
    timer.start(
      3,
      1000,
      (remaining) => ui.drawCounter(remaining),
      () => {
        ui.resetForLevel();

        // Spawn players and calculate their paths
        this.entityManager.spawnEntities();
        this.pathGraph = createPathGraph(this.levelData.map);
        this.entityManager.exitLairAll();
        this.entityManager.initAll();

        this.mode = "PLAYING";
      },
    );
  }

  public startGame() {
    this.mode = "LEVEL_TRANSITION";

    // 1. Play game start audio (non-looping)
    audio.playMusic("start", false);

    this.entityManager.spawnEntities();
    this.pathGraph = createPathGraph(this.levelData.map);

    const ui = this.entityManager.getUI();

    const timer = new Timer();
    // 2. We trigger a 4-second sequence to bridge the 4.5s audio clip
    timer.start(
      4,
      1000,
      (remaining) => {
        if (remaining > 1) {
          // Display the numbers 3, 2 for the first ticks
          ui.drawCounter(remaining - 1);
        } else if (remaining === 1) {
          // When we hit the last second of audio, flash READY!
          ui.drawReady();
        }
      },
      () => {
        // Countdown completed! Clear everything out.
        ui.clearReady();

        if (this.pathGraph && Object.keys(this.pathGraph).length > 0) {
          this.entityManager.exitLairAll();
          this.entityManager.initAll();
        }

        // 3. Start background siren loop!
        audio.playMusic("siren_0", true);

        this.mode = "PLAYING";
      },
    );
  }

  public stopGame(): void {
    this.mode = "GAME_OVER";
    this.gameLoop.stop();
  }

  public resetGame() {
    this.lives = 3;
    this.currentLevel = 1;
    this.levelData = this.getLevelConfig(this.currentLevel);
    this.score = 0;
    this.ghostMultiplier = 0;
    this.mode = "INIT";
  }

  public pauseGame() {
    this.mode = "PAUSED";
  }

  public resumeGame() {
    this.mode = "PLAYING";
  }

  public triggerGhostEatenFreeze() {
    // 1. Temporarily change the mode to freeze updates
    const previousMode = this.mode;
    this.mode = "GHOST_EATEN";

    // 2. Play the ghost eating SFX immediately if you have it!
    audio.playSFX("eat_ghost");

    // 3. Set a timeout to resume the game after ~500ms (half a second)
    setTimeout(() => {
      // Put the mode back to what it was (usually "PLAYING")
      this.mode = previousMode;
    }, 500);
  }

  public triggerDeathSequence() {
    if (this.lives <= 0) {
      this.mode = "GAME_OVER";
      return;
    }

    this.mode = "PACMAN_DEAD";
    this.lives--;
  }

  public completeDeathSequence(): void {
    const ui = this.entityManager.getUI();

    // 3. Perfect! Points back to the working EntityManager method now.
    this.entityManager.resetPositionsForDeath();

    this.mode = "LEVEL_TRANSITION";

    const timer = new Timer();
    timer.start(
      3,
      1000,
      (remaining) => ui.drawCounter(remaining),
      () => {
        ui.resetForLevel();

        // 4. Countdown hit 0! Unleash the ghosts.
        this.entityManager.exitLairAll();

        this.mode = "PLAYING";
      },
    );
  }

  private handlePowerPillEaten() {
    this.resetGhostMultiplier();

    this.buffTimer.stop();

    eventBus.emit("POWER_PILL_EATEN");

    this.buffTimer.start(
      this.buffDuration,
      1000,
      (remaining: number) => {
        if (remaining === this.buffThreshold)
          eventBus.emit("POWER_PILL_WARNING");
      },
      () => {
        eventBus.emit("POWER_PILL_EXPIRED");
      },
    );
  }

  public updateScore(type: string) {
    switch (type) {
      case "DOT":
        this.score += SCORE_CONFIG.DOTS.PELLET;
        this.entityManager.getUI().needsRedraw = true;
        break;
      case "POWER_PELLET":
        this.score += SCORE_CONFIG.DOTS.POWER_PELLET;
        this.handlePowerPillEaten();
        break;
      case "GHOST":
        this.score +=
          SCORE_CONFIG.GHOSTS.BASE *
          SCORE_CONFIG.GHOSTS.MULTIPLIERS[this.ghostMultiplier];
        this.ghostMultiplier++;

        // 🔥 Trigger the screen freeze!
        this.triggerGhostEatenFreeze();
        this.ghostMultiplier++;
        break;
    }
  }

  public resetGhostMultiplier() {
    this.ghostMultiplier = 0;
  }
}

export { GameState };
