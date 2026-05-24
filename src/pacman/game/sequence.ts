// src/game/Sequence.ts

type SequenceStep =
  | { type: "wait"; duration: number }
  | { type: "callback"; action: () => void };

type SequenceCompleteCallback = () => void;

/**
 * Управляет последовательным выполнением цепочки событий.
 * Используется для сложных сценариев: интермиссия, смерть, сброс уровня.
 *
 */
export class Sequence {
  private steps: SequenceStep[] = [];
  private currentIndex: number = 0;
  private timeoutId: number | null = null;
  private _isRunning: boolean = false;

  constructor() {}

  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Добавить шаг ожидания (в миллисекундах) */
  addWait(duration: number): this {
    this.steps.push({ type: "wait", duration });
    return this;
  }

  /** Добавить шаг с колбэком */
  addCallback(action: () => void): this {
    this.steps.push({ type: "callback", action });
    return this;
  }

  /** Запустить последовательность */
  start(onComplete?: SequenceCompleteCallback): void {
    if (this._isRunning) this.stop();

    this.currentIndex = 0;
    this._isRunning = true;
    this.runNext(onComplete);
  }

  /** Остановить последовательность */
  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this._isRunning = false;
  }

  /** Очистить все шаги */
  clear(): void {
    this.stop();
    this.steps = [];
    this.currentIndex = 0;
  }

  private runNext(onComplete?: SequenceCompleteCallback): void {
    if (!this._isRunning) return;

    if (this.currentIndex >= this.steps.length) {
      this._isRunning = false;
      onComplete?.();
      return;
    }

    const step = this.steps[this.currentIndex];
    this.currentIndex++;

    if (step.type === "callback") {
      step.action();
      this.runNext(onComplete);
    } else if (step.type === "wait") {
      this.timeoutId = window.setTimeout(() => {
        this.runNext(onComplete);
      }, step.duration);
    }
  }
}