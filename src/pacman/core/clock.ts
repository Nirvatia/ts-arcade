// src/game/Clock.ts

type TickCallback = (remaining: number) => void;
type CompleteCallback = () => void;

/**
 * Универсальный таймер обратного отсчёта.
 * Поддерживает колбэки на каждый тик и на завершение.
 * Может быть остановлен и сброшен в любой момент.
 */
export class Clock {
  private duration: number = 0;
  private elapsed: number = 0;
  private intervalId: number | null = null;
  private onTick: TickCallback | null = null;
  private onComplete: CompleteCallback | null = null;
  private _isRunning: boolean = false;

  constructor() {}

  /** Запущен ли таймер */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Запустить таймер обратного отсчёта.
   * @param duration - общая длительность в секундах
   * @param interval - интервал тика в миллисекундах
   * @param onTick - вызывается на каждом тике с оставшимся временем
   * @param onComplete - вызывается при завершении отсчёта
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