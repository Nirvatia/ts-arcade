// src/game/Tally.ts
import { CFG_SCORE } from "../config/score.js";
import { eventBus } from "../core/eventBus.js";

/**
 * Manages score tracking, bonus lives, and multipliers.
 * Isolates scoring logic cleanly from GameState.
 */
export class Tally {
  private static instance: Tally;

  private _score: number = 0;
  private _ghostMultiplier: number = 0;
  private readonly BONUS_LIFE_THRESHOLD = 10000;
  private _hasReceivedBonusLife: boolean = false;

  private constructor() {
    this.initEventListeners();
  }

  public static getInstance(): Tally {
    if (!Tally.instance) {
      Tally.instance = new Tally();
    }
    return Tally.instance;
  }

  // --- Getters & Setters ---

  public get score(): number {
    return this._score;
  }

  public set score(value: number) {
    this._score = value;
    eventBus.emit("ui:score_display_update", { score: this._score });
    this.checkBonusLife();
  }

  public get ghostMultiplier(): number {
    return this._ghostMultiplier;
  }

  public set ghostMultiplier(value: number) {
    this._ghostMultiplier = value;
  }

  public get hasReceivedBonusLife(): boolean {
    return this._hasReceivedBonusLife;
  }

  public set hasReceivedBonusLife(value: boolean) {
    this._hasReceivedBonusLife = value;
  }

  private initEventListeners(): void {
    eventBus.on("dot:eaten", () => {
      this.addDot();
    });

    eventBus.on("power_pill:eaten", () => {
      this.addPowerPellet();
    });

    eventBus.on("ghost:eaten", () => {
      this.addGhost();
    });
  }

  // --- Scoring Methods ---

  private addDot(): void {
    this.score += CFG_SCORE.DOTS.PELLET; // Uses setter now
  }

  private addPowerPellet(): void {
    this.score += CFG_SCORE.DOTS.POWER_PELLET; // Uses setter now
  }

  private addGhost(): void {
    const multiplierIndex = Math.min(
      this._ghostMultiplier,
      CFG_SCORE.GHOSTS.MULTIPLIERS.length - 1,
    );

    this.score +=
      CFG_SCORE.GHOSTS.BASE * CFG_SCORE.GHOSTS.MULTIPLIERS[multiplierIndex];
    this._ghostMultiplier++;
  }

  public addFruit(fruitScore: number): void {
    this.score += fruitScore;
  }

  public resetGhostMultiplier(): void {
    this._ghostMultiplier = 0;
  }

  /**
   * Checks thresholds and rewards bonus life.
   * Automatically invoked whenever score properties change.
   */
  private checkBonusLife(): boolean {
    if (
      !this._hasReceivedBonusLife &&
      this._score >= this.BONUS_LIFE_THRESHOLD
    ) {
      this._hasReceivedBonusLife = true;
      eventBus.emit("bonus_life:earned");
      return true;
    }
    return false;
  }

  public reset(): void {
    this._score = 0;
    this._ghostMultiplier = 0;
    this._hasReceivedBonusLife = false;
    eventBus.emit("ui:score_display_update", { score: this._score });
  }

  public resetForLevel(): void {
    this._ghostMultiplier = 0;
    this._hasReceivedBonusLife = false;
  }
}
