// src/game/Tally.ts
import { CFG_SCORE } from "../config/score.js";
import { eventBus } from "../core/eventBus.js";

/**
 * Управляет подсчётом очков, бонусными жизнями и множителями.
 * Изолирует логику скорринга из GameState.
 */
export class Tally {
  private static instance: Tally;

  /** Текущий счёт игрока */
  private _score: number = 0;

  /** Множитель для последовательного поедания призраков */
  private _ghostMultiplier: number = 0;

  /** Количество жизней */
  private _lives: number = 3;

  /** Порог для получения бонусной жизни */
  private readonly BONUS_LIFE_THRESHOLD = 10000;

  /** Была ли уже получена бонусная жизнь на этом уровне */
  private _hasReceivedBonusLife: boolean = false;

  private constructor() {
    this.initEventListeners();
  }

  static getInstance(): Tally {
    if (!Tally.instance) {
      Tally.instance = new Tally();
    }
    return Tally.instance;
  }

  get score(): number {
    return this._score;
  }

  get ghostMultiplier(): number {
    return this._ghostMultiplier;
  }

  get lives(): number {
    return this._lives;
  }

  set lives(value: number) {
    this._lives = value;
  }

  get hasReceivedBonusLife(): boolean {
    return this._hasReceivedBonusLife;
  }

  private initEventListeners(): void {
    // Listen to scoring events instead of being called directly
    eventBus.on("dot:eaten", () => {
      this.addDot();
      this.checkBonusLife();
    });

    eventBus.on("power_pill:eaten", () => {
      this.addPowerPellet();
      this.checkBonusLife();
    });

    eventBus.on("ghost:eaten", () => {
      this.addGhost();
      this.checkBonusLife();
    });

    // Listen to lives changes
    eventBus.on("lives:changed", (data) => {
      this._lives = data.lives;
      // Emit UI update event
      eventBus.emit("ui:lives_display_update", { lives: data.lives });
    });
  }

  // --- Методы начисления очков ---

  /** Начислить очки за точку еды */
  private addDot(): void {
    this._score += CFG_SCORE.DOTS.PELLET;
    eventBus.emit("ui:score_display_update", { score: this._score });
  }

  private addPowerPellet(): void {
    this._score += CFG_SCORE.DOTS.POWER_PELLET;
    eventBus.emit("ui:score_display_update", { score: this._score });
  }

  private addGhost(): void {
    const multiplierIndex = Math.min(
      this._ghostMultiplier,
      CFG_SCORE.GHOSTS.MULTIPLIERS.length - 1,
    );
    this._score +=
      CFG_SCORE.GHOSTS.BASE *
      CFG_SCORE.GHOSTS.MULTIPLIERS[multiplierIndex];
    this._ghostMultiplier++;
    eventBus.emit("ui:score_display_update", { score: this._score });
  }

  /** Начислить очки за фрукт */
  addFruit(fruitScore: number): void {
    this._score += fruitScore;
  }

  /** Сбросить множитель призраков (при новом энерджайзере) */
  resetGhostMultiplier(): void {
    this._ghostMultiplier = 0;
  }

  /**
   * Проверить и выдать бонусную жизнь при достижении порога.
   * @returns true если жизнь была выдана
   */
  checkBonusLife(): boolean {
    if (
      !this._hasReceivedBonusLife &&
      this._score >= this.BONUS_LIFE_THRESHOLD
    ) {
      this._lives++;
      this._hasReceivedBonusLife = true;
      eventBus.emit("bonus_life:earned", {
        newTotal: this._lives,
        threshold: this.BONUS_LIFE_THRESHOLD,
      });
      return true;
    }
    return false;
  }

  /**
   * Уменьшить количество жизней на 1.
   * @returns оставшееся количество жизней
   */
  loseLife(): number {
    const previousLives = this._lives;
    this._lives--;
    eventBus.emit("lives:changed", {
      lives: this._lives,
      delta: -1,
      reason: "death",
    });
    return this._lives;
  }

  /** Полный сброс счёта (новая игра) */
  reset(): void {
    this._score = 0;
    this._ghostMultiplier = 0;
    this._lives = 3;
    this._hasReceivedBonusLife = false;
  }

  /** Сброс для нового уровня (сохраняет счёт и жизни) */
  resetForLevel(): void {
    this._ghostMultiplier = 0;
    this._hasReceivedBonusLife = false;
  }
}
