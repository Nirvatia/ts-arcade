type TickCallback = (remaining: number) => void;
type CompleteCallback = () => void;

/**
 * A countdown timer utility.
 * Uses Svelte 5 reactive runes ($state) for automated UI synchronization.
 */
export class Clock {
  private _duration = $state(0);
  private _elapsed = $state(0);
  private _isRunning = $state(false);

  private intervalId: number | null = null;
  private onTick: TickCallback | null = null;
  private onComplete: CompleteCallback | null = null;

  constructor() {}

  public get duration(): number {
    return this._duration;
  }

  public get elapsed(): number {
    return this._elapsed;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Initializes variables and begins the asynchronous countdown interval tracker.
   * @param duration - Total ticks to execute before concluding
   * @param interval - Time delay between ticks in milliseconds
   * @param onTick - Event callback executed on every successful interval pass
   * @param onComplete - Optional event callback executed when the countdown reaches zero
   */
  start(
    duration: number,
    interval: number,
    onTick: TickCallback,
    onComplete?: CompleteCallback,
  ): void {
    this.stop();

    this._duration = duration;
    this._elapsed = 0;
    this.onTick = onTick;
    this.onComplete = onComplete || null;
    this._isRunning = true;

    // Fire initial tick notification immediately on start
    this.onTick?.(this.duration - this.elapsed);

    this.intervalId = window.setInterval(() => {
      this._elapsed++;

      if (this.elapsed < this.duration) {
        this.onTick?.(this.duration - this.elapsed);
      } else {
        this.complete();
      }
    }, interval);
  }

  /** Clears the background execution interval and pauses timer progression */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isRunning = false;
  }

  /** Halts execution and resets total elapsed ticks back to zero */
  reset(): void {
    this.stop();
    this._elapsed = 0;
  }

  /** Returns total remaining ticks left in the countdown timeline */
  getRemaining(): number {
    return this.duration - this.elapsed;
  }

  /** Returns normalized progress scale mapping execution completion between 0 and 1 */
  getProgress(): number {
    return this.duration > 0 ? this.elapsed / this.duration : 0;
  }

  /** Finalizes interval tracking and dispatches completion event callbacks */
  private complete(): void {
    this.stop();
    this.onComplete?.();
  }
}
