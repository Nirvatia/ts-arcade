export class GameLoopTracker {
  private frameTimes: number[] = [];
  private frameDurations: number[] = []; // Actual CPU work time in ms
  private lastSummaryTime: number = performance.now();
  private readonly intervalMs: number = 3000;
  private targetFps: number;
  private idealFrameBudget: number; // Dynamic target frame time in ms

  /**
   * @param targetFps - The target tick-rate of the game loop (Defaults to 60)
   */
  constructor(targetFps: number = 60) {
    this.targetFps = targetFps;
    this.idealFrameBudget = 1000 / targetFps; // e.g. 16.66ms for 60fps, 33.33ms for 30fps
  }

  /**
   * Records the high-precision timestamp at the start of a frame.
   * @returns The start time timestamp
   */
  public startFrame(): number {
    const startTime = performance.now();
    this.frameTimes.push(startTime);
    return startTime;
  }

  /**
   * Calculates the execution duration of the current frame and triggers performance logging.
   * @param workStartToken - The starting timestamp token returned by startFrame()
   */
  public endFrame(workStartToken: number): void {
    const workEnd = performance.now();
    this.frameDurations.push(workEnd - workStartToken);

    this.processMetrics();
  }

  /** Checks if the logging interval has passed to process and print performance statistics */
  private processMetrics(): void {
    const now = performance.now();
    if (now - this.lastSummaryTime < this.intervalMs) return;

    this.printSummary();
    this.flush();
    this.lastSummaryTime = now;
  }

  /** Computes and prints frame rates, task durations, and budget usage in a console table */
  private printSummary(): void {
    const totalFrames = this.frameTimes.length;
    const actualFps = Math.round(totalFrames / (this.intervalMs / 1000));

    // Calculate the average CPU time spent executing logic per frame
    const avgWorkDuration =
      this.frameDurations.reduce((a, b) => a + b, 0) /
      (this.frameDurations.length || 1);

    // Calculate percentage of the frame time budget used by engine processing
    const budgetUtilization = (
      (avgWorkDuration / this.idealFrameBudget) *
      100
    ).toFixed(1);

    console.log(`\n⚙️ --- ENGINE LOOP DIAGNOSTICS (PAST 3s) ---`);
    console.table({
      "System Loop Performance": {
        "Recorded Frame Count": totalFrames,
        "Calculated Tick Rate": `${actualFps} / ${this.targetFps} FPS`,
        "Avg Task Compute Cost": `${avgWorkDuration.toFixed(2)} ms`,
        "Frame Budget Utilization": `${budgetUtilization}%`,
      },
    });
  }

  /** Empties performance data tracking arrays for the next logging interval */
  private flush(): void {
    this.frameTimes = [];
    this.frameDurations = [];
  }
}
