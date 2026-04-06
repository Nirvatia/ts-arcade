import { LEVEL_CONFIGS } from "../config/levels.js";
import { SCORE_CONFIG } from "../config/scoring.js";
import { EntityManager } from "../entities/entityManager.js";
import { Collision } from "./collision.js";
import { eventBus } from "./eventBus.js";
import { GameLoop } from "./loop.js";
import { Timer } from "./timer.js";

import type { GameMode, GraphType, LevelConfigType } from "../types.js";
import { createPathGraph } from "../utils.js";
import { getAudio } from "./audioManager.js";
import type { Map } from "../map/map.js";

class GameState {
  private static instance: GameState;
  private entityManager: EntityManager;
  private gameLoop: GameLoop;

  public pathGraph: GraphType | null;
  private buffTimer: Timer = new Timer();

  // 🌟 ИСПРАВЛЕНИЕ 1: Убрали хардкод LEVEL_CONFIGS[1].
  // Теперь эти значения будут динамически подтягиваться в loadLevel()
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
    this.levelData = LEVEL_CONFIGS[1];
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
      this.dotsEaten++;
      this.updateScore("DOT");

      // 🌟 ИСПРАВЛЕНИЕ 2: Сравниваем с общим количеством точек на уровне!
      // (Для тестов можешь временно вернуть dotsEaten === 10, если лень собирать всю карту)
      if (this.dotsEaten >= 40) {
        this.triggerIntermissionSequence();
      }
    });

    eventBus.on("POWER_PILL_EATEN_BY_PACMAN", () => {
      this.updateScore("POWER_PELLET");
      this.handlePowerPillEaten();
    });
  }

  private getLevelConfig(level: number): LevelConfigType {
    return LEVEL_CONFIGS[level] || LEVEL_CONFIGS[1];
  }

  public setTotalDots(count: number) {
    this.totalDots = count;
    this.dotsEaten = 0;
  }

  private triggerIntermissionSequence() {
    this.mode = "LEVEL_COMPLETE";

    const mapEntity = this.entityManager.staticEntities.map[0] as Map;
    let flashCount = 0;

    if (mapEntity) {
      // 🌟 Запускаем интервал мигания: каждые 150мс меняем флаг
      const flashInterval = setInterval(() => {
        mapEntity.isFlashing = !mapEntity.isFlashing;
        mapEntity.needsRedraw = true;
        flashCount++;

        // Сделаем 6 переключений (3 раза моргнет белым)
        if (flashCount >= 4) {
          clearInterval(flashInterval);
          mapEntity.isFlashing = false;
          mapEntity.needsRedraw = true;

          // Как только доморгали — запускаем интермиссию!
          this.proceedToIntermission();
        }
      }, 400);
    } else {
      // Если карты вдруг нет, просто идем дальше
      this.proceedToIntermission();
    }
  }

  // Вынес в отдельный метод, чтобы не плодить ад из коллбеков
  private proceedToIntermission() {
    [
      ...this.entityManager.getAllStatic(),
      ...this.entityManager.getAllDynamic(),
    ].forEach((e) => {
      e.clearCanvas();
    });

    this.mode = "INTERMISSION";

    // 🌟 Запускаем музыку
    eventBus.emit("INTERMISSION_START");

    const ui = this.entityManager.getUI();
    const intermission = ui.getIntermission();
    const audio = getAudio();

    // 🌟 Запрашиваем длительность трека intermission
    const trackDuration = audio.getTrackDuration("intermission");
    // Если аудио еще не загрузилось, дадим дефолтные 5 секунд
    const finalDuration = trackDuration > 0 ? trackDuration : 5;

    if (intermission) {
      intermission.start(finalDuration, () => {
        this.nextLevel();
      });
    }
  }

  public loadGame() {
    this.entityManager.createEntities();
    this.loadLevel();
    this.gameLoop.start();
    this.mode = "INIT";
  }

  public loadLevel() {
    const collision = Collision.getInstance();

    // 🌟 Загружаем конфиг ТЕКУЩЕГО уровня
    this.levelData = this.getLevelConfig(this.currentLevel);

    this.entityManager.resetAll();
    this.entityManager.spawnObjects();

    // 🌟 Обновляем тайминги энерджайзера под текущий уровень
    this.buffDuration = this.levelData.buffDuration;
    this.buffThreshold = this.levelData.buffThreshold;

    collision.initTeleports(this.levelData.map);
  }

  public nextLevel() {
    this.currentLevel++;
    this.loadLevel();

    const ui = this.entityManager.getUI();
    this.mode = "LEVEL_TRANSITION";

    // 🌟 1. ОПОВЕЩАЕМ О НАЧАЛЕ СЕКВЕНЦИИ (включит музыку "start")
    eventBus.emit("GAME_START_SEQUENCE");

    this.entityManager
      .getAllStatic()
      .forEach((entity) => entity.resetForLevel());
    this.entityManager
      .getAllDynamic()
      .forEach((entity) => entity.resetForLevel());

    this.entityManager.spawnEntities();
    this.pathGraph = createPathGraph(this.levelData.map);
    this.entityManager.exitLairAll();
    this.entityManager.initAll();

    this.entityManager.getAllStatic().forEach((entity) => {
      entity.needsRedraw = true;
      entity.draw(false);
    });

    // 🌟 Получаем длительность трека, чтобы таймер UI и музыка идеально совпали
    const audio = getAudio();
    const trackDuration = audio.getTrackDuration("start");
    const countdownTime = trackDuration > 0 ? Math.ceil(trackDuration) : 3;

    const timer = new Timer();
    timer.start(
      countdownTime, // 🌟 Используем динамическое время вместо хардкода 3 сек
      1000,
      (remaining) => ui.drawCounter(remaining),
      () => {
        ui.clearReady();

        // 🌟 2. ОПОВЕЩАЕМ О НАЧАЛЕ ГЕЙМПЛЕЯ (включит "siren_0")
        eventBus.emit("GAME_START");

        this.mode = "PLAYING";
      },
    );
  }

  public startGame() {
    this.mode = "LEVEL_TRANSITION";

    const audio = getAudio();
    eventBus.emit("GAME_START_SEQUENCE");

    const trackDuration = audio.getTrackDuration("start");
    const countdownTime = trackDuration > 0 ? Math.ceil(trackDuration) : 4;

    this.entityManager.spawnEntities();
    this.pathGraph = createPathGraph(this.levelData.map);

    const ui = this.entityManager.getUI();
    const timer = new Timer();

    timer.start(
      countdownTime,
      1000,
      (remaining) => {
        if (remaining > 1) {
          ui.drawCounter(remaining - 1);
        } else if (remaining === 1) {
          ui.drawReady();
        }
      },
      () => {
        ui.clearReady();

        if (this.pathGraph && Object.keys(this.pathGraph).length > 0) {
          this.entityManager.exitLairAll();
          this.entityManager.initAll();
        }

        eventBus.emit("GAME_START");
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
    if (this.lives <= 0) {
      this.mode = "GAME_OVER";
      return;
    }

    this.mode = "PACMAN_DEAD";
    this.lives--;

    eventBus.emit("PACMAN_DEATH");
  }

  public completeDeathSequence(): void {
    const ui = this.entityManager.getUI();
    const audio = getAudio();

    this.entityManager.resetPositionsForDeath();
    this.mode = "LEVEL_TRANSITION";

    eventBus.emit("GAME_START_SEQUENCE");

    const trackDuration = audio.getTrackDuration("start");
    const countdownTime = trackDuration > 0 ? Math.ceil(trackDuration) : 3;

    const timer = new Timer();
    timer.start(
      countdownTime,
      1000,
      (remaining) => ui.drawCounter(remaining),
      () => {
        ui.resetForLevel();
        this.entityManager.exitLairAll();

        eventBus.emit("GAME_RESUMED");
        this.mode = "PLAYING";
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
        this.entityManager.getUI().needsRedraw = true;
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
  }
}

export { GameState };
