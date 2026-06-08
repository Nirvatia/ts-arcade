type SequenceStep =
  | { type: "wait"; duration: number }
  | { type: "callback"; action: () => void };

type SequenceCompleteCallback = () => void;

/**
 * Manages an ordered queue of timed delays and execution callbacks.
 * Used to run step-by-step game events linearly.
 */
export class Sequence {
  private steps: SequenceStep[] = [];
  private currentIndex: number = 0;
  private timeoutId: number | null = null;
  private _isRunning: boolean = false;

  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Appends a timed delay step to the sequence queue.
   * @param duration - Time to wait in milliseconds
   */
  addWait(duration: number): this {
    this.steps.push({ type: "wait", duration });
    return this;
  }

  /**
   * Appends an executable function step to the sequence queue.
   * @param action - Callback function to run
   */
  addCallback(action: () => void): this {
    this.steps.push({ type: "callback", action });
    return this;
  }

  /**
   * Resets the execution index and starts running the sequence from the first step.
   * @param onComplete - Optional callback invoked when all steps conclude
   */
  start(onComplete?: SequenceCompleteCallback): void {
    this.stop();
    this.currentIndex = 0;
    this._isRunning = true;
    this.runNext(onComplete);
  }

  /** Cancels any active window timeout and freezes sequence progression */
  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this._isRunning = false;
  }

  /** Stops progression and clears all steps from the internal array queue */
  clear(): void {
    this.stop();
    this.steps = [];
    this.currentIndex = 0;
  }

  /**
   * Evaluates and executes the current step in the sequence loop.
   * Recursively processes adjacent callbacks or handles asynchronous wait timeouts.
   */
  private runNext(onComplete?: SequenceCompleteCallback): void {
    if (!this._isRunning) return;

    // Check if the end of the step queue has been reached
    if (this.currentIndex >= this.steps.length) {
      this._isRunning = false;
      onComplete?.();
      return;
    }

    const step = this.steps[this.currentIndex];
    this.currentIndex++;

    if (step.type === "callback") {
      step.action();

      // Guard check in case the executed callback invoked this.stop() internally
      if (!this._isRunning) return;

      this.runNext(onComplete);
    } else if (step.type === "wait") {
      this.timeoutId = window.setTimeout(() => {
        this.timeoutId = null; // Reset native timeout tracker pointer
        this.runNext(onComplete);
      }, step.duration);
    }
  }
}
