import { CFG_SCORE } from "../config/score.config.js";
import { eventBus } from "../core/EventBus.js";

export class Tally {
  private static instance: Tally;

  private _state = $state({
    score: 0,
  });

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
    return this._state.score;
  }

  public set score(value: number) {
    this._state.score = value;
    eventBus.emit("ui:score_display_update", { score: this._state.score });
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
    eventBus.on("game:restart", () => {
      this.reset();
    });

    eventBus.on("level:start", () => {
      this.resetForLevel();
    });

    eventBus.on("dot:eaten", () => {
      this.addDot();
    });

    eventBus.on("power_pill:eaten", () => {
      this.addPowerPellet();
    });

    eventBus.on("ghost:eaten", () => {
      this.addGhost();
    });

    eventBus.on("power_pill:activated", () => {
      this.resetGhostMultiplier();
    });
  }

  // --- Scoring Methods ---

  private addDot(): void {
    this.score += CFG_SCORE.DOTS.PELLET;
  }

  private addPowerPellet(): void {
    this.score += CFG_SCORE.DOTS.POWER_PELLET;
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

  private checkBonusLife(): boolean {
    if (
      !this._hasReceivedBonusLife &&
      this._state.score >= this.BONUS_LIFE_THRESHOLD
    ) {
      this._hasReceivedBonusLife = true;
      eventBus.emit("bonus_life:earned");
      return true;
    }
    return false;
  }

  public reset(): void {
    this._state.score = 0;
    this._ghostMultiplier = 0;
    this._hasReceivedBonusLife = false;
    eventBus.emit("ui:score_display_update", { score: this._state.score });
  }

  public resetForLevel(): void {
    this._ghostMultiplier = 0;
    this._hasReceivedBonusLife = false;
  }
}
