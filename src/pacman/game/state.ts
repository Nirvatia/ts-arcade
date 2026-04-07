import { SCORE_CONFIG } from "../config/scoring.js";
import { EntityManager } from "../entities/entityManager.js";
import { Collision } from "./collision.js";
import { eventBus } from "./eventBus.js";
import { GameLoop } from "./loop.js";
import { Timer } from "./timer.js";

import type { GameMode, GraphType, LevelConfigType } from "../types.js";
import { createPathGraph, generateLevelConfig } from "../utils.js";
import { getAudio } from "./audioManager.js";
import type { Map } from "../map/map.js";

class GameState {
  private static instance: GameState;
  private entityManager: EntityManager;
  private gameLoop: GameLoop;

  private isProcessingLevelTransition: boolean = false;
  private hasReceivedBonusLife: boolean = false;
  private readonly BONUS_LIFE_THRESHOLD = 10000;
  public pathGraph: GraphType | null;
  private buffTimer: Timer = new Timer();

  private buffDuration: number = 10;
  private buffThreshold: number = 3;

  public mode: GameMode = "INIT";
  public lives: number;
  public currentLevel: number;
  public levelData: LevelConfigType;
  public score: number;
  public ghostMultiplier: number;

  public totalDots: number = 0;
  public dotsEaten: number = 0;

  public isBuffed: boolean = false;

  private constructor() {
    this.entityManager = EntityManager.getInstance();
    this.gameLoop = GameLoop.getInstance();
    this.pathGraph = null;
    this.lives = 3;
    this.currentLevel = 1;
    this.levelData = generateLevelConfig(this.currentLevel);
    this.score = 0;
    this.ghostMultiplier = 0;

    this.initEventListeners();
  }

  static getInstance(): GameState {
    if (!GameState.instance) GameState.instance = new GameState();
    return GameState.instance;
  }

  private initEventListeners() {
    eventBus.on("GHOST_EATEN", () => {
      this.updateScore("GHOST");
    });

    eventBus.on("DOT_EATEN", () => {
      if (this.isProcessingLevelTransition) return;
      this.dotsEaten++;
      this.updateScore("DOT");

      // 🌟 Compare against the dynamic total instead of hardcoded 40!
      if (this.dotsEaten >= this.totalDots && this.totalDots > 0) {
        this.isProcessingLevelTransition = true;
        this.triggerIntermissionSequence();
      }
    });

    eventBus.on("POWER_PILL_EATEN_BY_PACMAN", () => {
      this.updateScore("POWER_PELLET");
      this.handlePowerPillEaten();
    });
  }

  private getLevelConfig(level: number): LevelConfigType {
    return generateLevelConfig(level);
  }

  public setTotalDots(count: number) {
    this.totalDots = count;
    this.dotsEaten = 0;
  }

  // GameState.ts
  private triggerIntermissionSequence() {
    this.mode = "LEVEL_COMPLETE";

    // 🌟 ARCADE FIX: Clear the dynamic canvases immediately
    this.entityManager.getAllDynamic().forEach((e) => e.clearCanvas());

    const mapEntity = this.entityManager.staticEntities.map[0] as Map;
    let flashCount = 0;

    if (mapEntity) {
      const flashInterval = setInterval(() => {
        mapEntity.isFlashing = !mapEntity.isFlashing;
        mapEntity.needsRedraw = true;
        flashCount++;

        if (flashCount >= 4) {
          clearInterval(flashInterval);
          mapEntity.isFlashing = false;
          // 🌟 CRITICAL: Clear all static canvases (dots/walls) before Intermission
          this.entityManager.getAllStatic().forEach((e) => e.clearCanvas());

          this.proceedToIntermission();
        }
      }, 400);
    } else {
      this.proceedToIntermission();
    }
  }

  private proceedToIntermission() {
    [
      ...this.entityManager.getAllStatic(),
      ...this.entityManager.getAllDynamic(),
    ].forEach((e) => {
      e.clearCanvas();
      if ("needsRedraw" in e) (e as any).needsRedraw = true;
    });

    // 🌟 Svelte picks up on this state and fires up the Intermission cartoon!
    this.mode = "INTERMISSION";
    eventBus.emit("INTERMISSION_START");

    const audio = getAudio();
    const trackDuration = audio.getTrackDuration("intermission");
    const finalDuration = trackDuration > 0 ? trackDuration : 5;

    // We control game transition simply by waiting the track duration
    setTimeout(() => {
      // 🌟 Check if we are still in a valid state to progress
      if (this.mode !== "GAME_OVER") {
        this.nextLevel();
      }
    }, finalDuration * 1000);
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

    this.entityManager.resetAll();
    this.entityManager.spawnObjects();

    this.buffDuration = this.levelData.buffDuration;
    this.buffThreshold = this.levelData.buffThreshold;
    this.isProcessingLevelTransition = false;
    collision.initTeleports(this.levelData.map);
  }

  public nextLevel() {
    if (this.mode === "GAME_OVER") return;
    // 1. IMMEDIATELY flip mode so the Renderer knows to stop returning early
    this.mode = "LEVEL_TRANSITION";

    // 2. Clear the old pixels manually before doing ANY logic
    [
      ...this.entityManager.getAllStatic(),
      ...this.entityManager.getAllDynamic(),
    ].forEach((e) => e.clearCanvas());

    this.currentLevel++;
    this.loadLevel(); // This sets up Level 2 data

    eventBus.emit("GAME_START_SEQUENCE");

    this.entityManager.getAllStatic().forEach((e) => e.resetForLevel());
    this.entityManager.getAllDynamic().forEach((e) => e.resetForLevel());

    this.entityManager.getAllStatic().forEach((entity) => {
      entity.needsRedraw = true;
      entity.draw(false);
    });

    this.entityManager.spawnEntities();
    this.pathGraph = createPathGraph(this.levelData.map);
    this.entityManager.exitLairAll();
    this.entityManager.initAll();

    this.entityManager.getAllStatic().forEach((entity) => {
      entity.needsRedraw = true;
      entity.draw(false);
    });

    const audio = getAudio();
    const trackDuration = audio.getTrackDuration("start");
    const countdownTime = trackDuration > 0 ? Math.ceil(trackDuration) : 3;

    const timer = new Timer();

    // 🌟 ADD THIS: Expose it so Svelte can steal the countdown!
    (this as any).activeTimer = timer;

    timer.start(
      countdownTime,
      1000,
      (remaining) => {
        // Handled by Svelte
      },
      () => {
        eventBus.emit("GAME_START");
        this.mode = "PLAYING";
        (this as any).activeTimer = null; // Clean up afterward!
      },
    );
  }

  public startGame() {
    // Prevent double-starting if already in transition
    if (this.mode === "LEVEL_TRANSITION") return;

    this.mode = "LEVEL_TRANSITION";

    // Stop existing timers to prevent overlapping callbacks
    if ((this as any).activeTimer) {
      (this as any).activeTimer.stop();
    }

    const audio = getAudio();
    eventBus.emit("GAME_START_SEQUENCE");

    const trackDuration = audio.getTrackDuration("start");
    const countdownTime = trackDuration > 0 ? Math.ceil(trackDuration) : 4;

    this.entityManager.spawnEntities();
    this.pathGraph = createPathGraph(this.levelData.map);

    const timer = new Timer();
    (this as any).activeTimer = timer;

    timer.start(
      countdownTime,
      1000,
      (remaining) => {
        /* Svelte handles UI */
      },
      () => {
        // Ensure we are still in the right mode to start
        if (this.mode !== "LEVEL_TRANSITION") return;

        if (this.pathGraph && Object.keys(this.pathGraph).length > 0) {
          this.entityManager.exitLairAll();
          this.entityManager.initAll();
        }

        eventBus.emit("GAME_START");
        this.mode = "PLAYING";
        (this as any).activeTimer = null;
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
    this.isBuffed = false;
  }

  public pauseGame() {
    this.mode = "PAUSED";
  }

  public resumeGame() {
    this.mode = "PLAYING";
  }

  public triggerGhostEatenFreeze() {
    const previousMode = this.mode;
    this.mode = "GHOST_EATEN";

    setTimeout(() => {
      this.mode = previousMode;
    }, 500);
  }

  public triggerDeathSequence() {
    this.mode = "PACMAN_DEAD";
    eventBus.emit("PACMAN_DEATH");

    const audio = getAudio();
    // 🌟 Get actual duration, default to 2s if not found
    const deathDuration = audio.getTrackDuration("death") || 2;

    // We add a tiny 200ms buffer to the end of the sound for visual polish
    setTimeout(
      () => {
        const remainingLives = this.lives - 1;

        if (remainingLives < 0) {
          this.lives = 0;
          this.handleGameOver();
        } else {
          this.lives = remainingLives;
          this.completeDeathSequence();
        }
      },
      deathDuration * 1000 + 200,
    );
  }

  // GameState.ts

  private handleGameOver() {
    // 1. SET DATA STATE FIRST
    this.lives = 0;
    this.mode = "GAME_OVER";

    // 2. Clear actors immediately
    this.entityManager.getAllDynamic().forEach((e) => e.clearCanvas());

    // 3. Stop any background tasks
    const activeTimer = (this as any).activeTimer;
    if (activeTimer) {
      activeTimer.stop();
      (this as any).activeTimer = null;
    }

    // 4. Signal Svelte
    eventBus.emit("GAME_OVER_SEQUENCE");

    // 5. Short delay to let Svelte render the final score before the heart stops
    setTimeout(() => {
      this.entityManager.getAllStatic().forEach((e) => e.clearCanvas());
      this.gameLoop.stop();
    }, 50);
  }

  public restartGame() {
    this.lives = 3;
    this.currentLevel = 1;
    this.score = 0;
    this.hasReceivedBonusLife = false;
    this.dotsEaten = 0;
    this.isProcessingLevelTransition = false;

    this.loadLevel();

    // 🌟 Ensure the heart is beating again!
    this.gameLoop.start();

    this.startGame();
  }

  // GameState.ts

  // GameState.ts

  public completeDeathSequence(): void {
    // 1. SAFETY: If we are already in transition, don't start ANOTHER transition
    // This prevents the "double countdown" if this method is triggered rapidly.
    if (this.mode === "LEVEL_TRANSITION" && (this as any).activeTimer) {
      return;
    }

    // 2. STOPS THE LOOP: Kill any previous timer instance immediately
    if ((this as any).activeTimer) {
      (this as any).activeTimer.stop();
      (this as any).activeTimer = null;
    }

    // 3. EXIT: If the game is actually over, don't start a new countdown
    if (this.mode === "GAME_OVER" || this.lives <= 0) return;

    const audio = getAudio();
    this.entityManager.resetPositionsForDeath();
    this.mode = "LEVEL_TRANSITION";

    eventBus.emit("GAME_START_SEQUENCE");

    const trackDuration = audio.getTrackDuration("start");
    const countdownTime = trackDuration > 0 ? Math.ceil(trackDuration) : 3;

    const timer = new Timer();
    (this as any).activeTimer = timer;

    timer.start(
      countdownTime,
      1000,
      (remaining) => {
        /* UI Update */
      },
      () => {
        // 4. IDENTITY CHECK: Only proceed if this specific timer is still the 'active' one.
        // This prevents a "zombie" timer from an old life from starting the game.
        if (
          this.mode !== "LEVEL_TRANSITION" ||
          (this as any).activeTimer !== timer
        ) {
          return;
        }

        this.entityManager.exitLairAll();
        eventBus.emit("GAME_RESUMED");
        this.mode = "PLAYING";
        (this as any).activeTimer = null;
      },
    );
  }

  private handlePowerPillEaten() {
    this.resetGhostMultiplier();
    this.buffTimer.stop();

    this.isBuffed = true;
    eventBus.emit("POWER_PILL_EATEN");

    this.buffTimer.start(
      this.buffDuration,
      1000,
      (remaining: number) => {
        if (remaining === this.buffThreshold)
          eventBus.emit("POWER_PILL_WARNING");
      },
      () => {
        this.isBuffed = false;
        eventBus.emit("POWER_PILL_EXPIRED");
      },
    );
  }

  public resetGhostMultiplier() {
    this.ghostMultiplier = 0;
  }

  private updateScore(type: "DOT" | "POWER_PELLET" | "GHOST") {
    switch (type) {
      case "DOT":
        this.score += SCORE_CONFIG.DOTS.PELLET;
        // 🌟 Svelte auto-updates scores, we don't need to force redraw the UI canvas!
        break;
      case "POWER_PELLET":
        this.score += SCORE_CONFIG.DOTS.POWER_PELLET;
        break;
      case "GHOST":
        const multiplierIndex = Math.min(
          this.ghostMultiplier,
          SCORE_CONFIG.GHOSTS.MULTIPLIERS.length - 1,
        );
        this.score +=
          SCORE_CONFIG.GHOSTS.BASE *
          SCORE_CONFIG.GHOSTS.MULTIPLIERS[multiplierIndex];
        this.triggerGhostEatenFreeze();
        this.ghostMultiplier++;
        break;
    }

    if (!this.hasReceivedBonusLife && this.score >= this.BONUS_LIFE_THRESHOLD) {
      this.lives++;
      this.hasReceivedBonusLife = true;
      eventBus.emit("EXTRA_LIFE_GAINED");
      // TIP: You might want to play a 'ding' sound here!
    }
  }
}

export { GameState };
