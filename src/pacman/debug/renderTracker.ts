export class RenderTracker {
  private static instance: RenderTracker | null = null;
  private drawCounts: Record<string, number> = {};
  private lastSummaryTime: number = performance.now();
  private readonly intervalMs: number = 3000; // Summary loop interval

  private constructor() {}

  public static getInstance(): RenderTracker {
    if (!RenderTracker.instance) {
      RenderTracker.instance = new RenderTracker();
    }
    return RenderTracker.instance;
  }

  /**
   * Increments the redraw count for a specific canvas layer.
   * @param canvasId - The string identifier of the target canvas element
   */
  public recordDraw(canvasId: string): void {
    this.drawCounts[canvasId] = (this.drawCounts[canvasId] || 0) + 1;
  }

  /**
   * Checks if the metric interval has passed to process and log the draw counts.
   * Call this at the end of the main rendering loop.
   */
  public processMetrics(): void {
    const now = performance.now();
    if (now - this.lastSummaryTime < this.intervalMs) return;

    this.printSummary();
    this.flush();
    this.lastSummaryTime = now;
  }

  /** Calculates drawing frequency per canvas and displays a performance profile table */
  private printSummary(): void {
    console.log(`\n📊 --- RENDER PIPELINE SNAPSHOT (PAST 3s) ---`);

    // Group draw data and classify layers based on their frame rates
    const report = Object.entries(this.drawCounts).reduce(
      (acc, [canvasId, count]) => {
        const fps = Number((count / 3).toFixed(1));
        let classification = "⚡ OPTIMIZED STATIC";

        if (fps > 45) {
          classification = "🌀 ACTIVE DYNAMIC (60 FPS)";
        } else if (fps > 2 && fps <= 45) {
          classification = "⚠️ WARNING: POTENTIAL LEAK";
        }

        acc[canvasId] = {
          "Total Draws": count,
          "Avg FPS": fps,
          "Performance Profile": classification,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    if (Object.keys(report).length === 0) {
      console.log("No canvases were drawn during this interval window.");
    } else {
      console.table(report);
    }
  }

  /** Resets all tracked draw counts back to zero for the next monitoring interval */
  private flush(): void {
    Object.keys(this.drawCounts).forEach((key) => (this.drawCounts[key] = 0));
  }
}
