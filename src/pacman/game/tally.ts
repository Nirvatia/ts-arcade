// src/game/Tally.ts
import { SCORE_CONFIG } from "../config/scoring.js";
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

  private constructor() {}

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

  // --- Методы начисления очков ---

  /** Начислить очки за точку еды */
  addDot(): void {
    this._score += SCORE_CONFIG.DOTS.PELLET;
  }

  /** Начислить очки за энерджайзер */
  addPowerPellet(): void {
    this._score += SCORE_CONFIG.DOTS.POWER_PELLET;
  }

  /** Начислить очки за съедение призрака */
  addGhost(): void {
    const multiplierIndex = Math.min(
      this._ghostMultiplier,
      SCORE_CONFIG.GHOSTS.MULTIPLIERS.length - 1,
    );
    this._score +=
      SCORE_CONFIG.GHOSTS.BASE *
      SCORE_CONFIG.GHOSTS.MULTIPLIERS[multiplierIndex];
    this._ghostMultiplier++;
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
