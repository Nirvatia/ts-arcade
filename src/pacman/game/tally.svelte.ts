import { CFG_SCORE } from "../config/score.config.js";
import { eventBus } from "../core/EventBus.js";

export class Tally {
  private _state = $state({ score: 0 });
  private _ghostMultiplier: number = 0;
  private readonly BONUS_LIFE_THRESHOLD = 10000;
  private _bonusEarnedThisLevel: boolean = false;

  constructor() {
    this.initEventListeners();
  }

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

  private initEventListeners(): void {
    eventBus.on("game:restart", () => this.reset());
    eventBus.on("level:start", () => this.resetForLevel());
    eventBus.on("dot:eaten", () => this.addDot());
    eventBus.on("power_pill:eaten", () => this.addPowerPellet());
    eventBus.on("ghost:eaten", (payload) => this.addGhost(payload));
    eventBus.on("power_pill:activated", () => this.resetGhostMultiplier());
  }

  private addDot(): void {
    this.score += CFG_SCORE.DOTS.PELLET;
  }
  private addPowerPellet(): void {
    this.score += CFG_SCORE.DOTS.POWER_PELLET;
  }

  private addGhost(payload: {
    ghostName: string;
    points: number;
    ghostIndex: number;
  }): void {
    const idx = Math.min(
      this._ghostMultiplier,
      CFG_SCORE.GHOSTS.MULTIPLIERS.length - 1,
    );
    const points = CFG_SCORE.GHOSTS.BASE * CFG_SCORE.GHOSTS.MULTIPLIERS[idx];
    this.score += points;
    payload.points = points;
    this._ghostMultiplier++;
  }

  public addFruit(fruitScore: number): void {
    this.score += fruitScore;
  }
  public resetGhostMultiplier(): void {
    this._ghostMultiplier = 0;
  }

  private checkBonusLife(): void {
    if (
      !this._bonusEarnedThisLevel &&
      this._state.score >= this.BONUS_LIFE_THRESHOLD
    ) {
      this._bonusEarnedThisLevel = true;
      eventBus.emit("bonus_life:acquired", { lives: 1 });
    }
  }

  public reset(): void {
    this._state.score = 0;
    this._ghostMultiplier = 0;
    this._bonusEarnedThisLevel = false;
    eventBus.emit("ui:score_display_update", { score: this._state.score });
  }

  public resetForLevel(): void {
    this._ghostMultiplier = 0;
    this._bonusEarnedThisLevel = false;
  }
}
