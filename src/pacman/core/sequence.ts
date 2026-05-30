type SequenceStep =
  | { type: "wait"; duration: number }
  | { type: "callback"; action: () => void };

type SequenceCompleteCallback = () => void;

export class Sequence {
  private steps: SequenceStep[] = [];
  private currentIndex: number = 0;
  private timeoutId: number | null = null;
  private _isRunning: boolean = false;

  get isRunning(): boolean {
    return this._isRunning;
  }

  addWait(duration: number): this {
    this.steps.push({ type: "wait", duration });
    return this;
  }

  addCallback(action: () => void): this {
    this.steps.push({ type: "callback", action });
    return this;
  }

  start(onComplete?: SequenceCompleteCallback): void {
    this.stop(); 
    this.currentIndex = 0;
    this._isRunning = true;
    this.runNext(onComplete);
  }

  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this._isRunning = false;
  }

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
      
      if (!this._isRunning) return;
      
      this.runNext(onComplete);
    } else if (step.type === "wait") {
      this.timeoutId = window.setTimeout(() => {
        this.timeoutId = null; // Clean out pointer ref
        this.runNext(onComplete);
      }, step.duration);
    }
  }
}