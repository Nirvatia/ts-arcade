// src/game/Clock.svelte.ts

type TickCallback = (remaining: number) => void;
type CompleteCallback = () => void;

/**
 * Универсальный таймер обратного отсчёта.
 * Использует руны Svelte 5 для автоматического обновления пользовательского интерфейса.
 */
export class Clock {
  // Svelte 5 State Runes force UI updates on every mutation frame
  private duration = $state(0);
  private elapsed = $state(0);
  private _isRunning = $state(false);
  
  private intervalId: number | null = null;
  private onTick: TickCallback | null = null;
  private onComplete: CompleteCallback | null = null;

  constructor() {}

  /** Запущен ли таймер */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Запустить таймер обратного отсчёта.
   */
  start(
    duration: number,
    interval: number,
    onTick: TickCallback,
    onComplete?: CompleteCallback,
  ): void {
    this.stop();

    this.duration = duration;
    this.elapsed = 0;
    this.onTick = onTick;
    this.onComplete = onComplete || null;
    this._isRunning = true;

    // Немедленный первый тик
    this.onTick?.(this.duration - this.elapsed);

    this.intervalId = window.setInterval(() => {
      this.elapsed++;
      if (this.elapsed < this.duration) {
        this.onTick?.(this.duration - this.elapsed);
      } else {
        this.complete();
      }
    }, interval);
  }

  /** Остановить таймер */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isRunning = false;
  }

  /** Сбросить таймер */
  reset(): void {
    this.stop();
    this.elapsed = 0;
  }

  /** Оставшееся время */
  getRemaining(): number {
    return this.duration - this.elapsed;
  }

  /** Прогресс от 0 до 1 */
  getProgress(): number {
    return this.duration > 0 ? this.elapsed / this.duration : 0;
  }

  private complete(): void {
    this.stop();
    this.onComplete?.();
  }
}