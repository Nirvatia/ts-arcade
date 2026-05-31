// src/core/GameLoopTracker.ts

export class GameLoopTracker {
  private frameTimes: number[] = [];
  private frameDurations: number[] = []; // Actual CPU work time in ms
  private lastSummaryTime: number = performance.now();
  private readonly intervalMs: number = 3000;
  private targetFps: number;
  private idealFrameBudget: number; // Dynamic replacement for 16.666ms

  /**
   * @param targetFps - The target tick-rate of the game loop (Defaults to 60)
   */
  constructor(targetFps: number = 60) {
    this.targetFps = targetFps;
    this.idealFrameBudget = 1000 / targetFps; // e.g. 16.666ms for 60fps, 33.33ms for 30fps
  }

  /**
   * Captures high-precision starting timestamp trace of a frame execution step
   */
  public startFrame(): number {
    this.frameTimes.push(performance.now());
    return performance.now(); // Returns start anchor point token
  }

  /**
   * Concludes diagnostic calculations for the current tick block
   */
  public endFrame(workStartToken: number): void {
    const workEnd = performance.now();
    this.frameDurations.push(workEnd - workStartToken);

    this.processMetrics();
  }

  private processMetrics(): void {
    const now = performance.now();
    if (now - this.lastSummaryTime < this.intervalMs) return;

    this.printSummary();
    this.flush();
    this.lastSummaryTime = now;
  }

  private printSummary(): void {
    const totalFrames = this.frameTimes.length;
    const actualFps = Math.round(totalFrames / (this.intervalMs / 1000));

    // Calculate average time spent inside execution algorithms per frame step
    const avgWorkDuration =
      this.frameDurations.reduce((a, b) => a + b, 0) /
      (this.frameDurations.length || 1);

    // Dynamic budget utilization calculations based on target loop limits
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

  private flush(): void {
    this.frameTimes = [];
    this.frameDurations = [];
  }
}
