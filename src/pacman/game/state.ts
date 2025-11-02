import { LEVEL_CONFIGS } from "../config/levels.js";
import { SCORE_CONFIG } from "../config/scoring.js";
import { EntityManager } from "../entities/entityManager.js";
import type { GameMode, LevelConfigType } from "../types.js";
import { Collision } from "./collision.js";
import { GameLoop } from "./loop.js";
import { Timer } from "./timer.js";

class GameState {
  private static instance: GameState;
  private entityManager: EntityManager;
  private gameLoop: GameLoop;

  public mode: GameMode = "INIT";
  public lives: number;
  public currentLevel: number;
  public levelData: LevelConfigType;
  public score: number;
  public ghostMultiplier: number;

  private constructor() {
    this.entityManager = EntityManager.getInstance();
    this.gameLoop = GameLoop.getInstance();
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
    this.entityManager.spawnAll();
    this.mode = "INIT";
  }

  public loadLevel() {
    const collision = Collision.getInstance();

    this.levelData = this.getLevelConfig(this.currentLevel);
    this.entityManager.resetAll();
    this.entityManager.initAll();

    collision.initTeleports(this.levelData.map);
  }

  private resetLevel(): void {
    this.entityManager.resetAllForLevel();
    this.entityManager.spawnAll();
  }

  public nextLevel() {
    this.currentLevel++;
    this.loadLevel();
    this.mode = "LEVEL_TRANSITION";
  }

  public startGame() {
    this.mode = "PLAYING";
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
    this.resetLevel();
    this.mode = "LEVEL_TRANSITION";

    const timer = new Timer();
    timer.start(
      3,
      1000,
      (remaining) => ui.drawCounter(remaining),
      () => {
        ui.resetForLevel();
        this.mode = "PLAYING";
      }
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
        break;
      case "GHOST":
        this.score +=
          SCORE_CONFIG.GHOSTS.BASE *
          SCORE_CONFIG.GHOSTS.MULTIPLIERS[this.ghostMultiplier];
        this.ghostMultiplier++;
        break;
    }
  }

  public resetGhostMultiplier() {
    this.ghostMultiplier = 0;
  }
}

export { GameState };
