export class GameLoopTracker {
  private interval: number;
  private lastLogTime: number = performance.now();
  private frameCount: number = 0;
  private maxFrameTime: number = 0;
  private totalFrameTime: number = 0;

  constructor(fps: number) {
    this.interval = 1000 / fps;
  }

  /** Фиксация начала выполнения кадра */
  public startFrame(): number {
    this.frameCount++;
    return performance.now();
  }

  /** Фиксация окончания выполнения кадра и вывод логов */
  public endFrame(workStart: number, now: number): void {
    const workDuration = performance.now() - workStart;
    this.totalFrameTime += workDuration;

    if (workDuration > this.maxFrameTime) {
      this.maxFrameTime = workDuration;
    }

    // Мгновенное предупреждение, если вычисления вышли за лимит интервала кадров
    if (workDuration > this.interval) {
      console.warn(
        `[Perf Drop] Frame work took ${workDuration.toFixed(2)}ms (Budget: ${this.interval.toFixed(2)}ms)`,
      );
    }

    // Вывод агрегированных логов раз в секунду
    if (now - this.lastLogTime >= 1000) {
      const elapsedSeconds = (now - this.lastLogTime) / 1000;
      const actualFps = Math.round(this.frameCount / elapsedSeconds);
      const avgFrameTime = this.totalFrameTime / this.frameCount;

      let memoryLog = "N/A (Non-Chromium)";
      const perfMem = (performance as any).memory;
      if (perfMem) {
        memoryLog = `${(perfMem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`;
      }

      console.log(
        `[Engine Performance] FPS: ${actualFps} | Avg Work: ${avgFrameTime.toFixed(2)}ms | Max Spike: ${this.maxFrameTime.toFixed(2)}ms | Heap: ${memoryLog}`,
      );

      // Сброс счетчиков для следующей секунды
      this.lastLogTime = now;
      this.frameCount = 0;
      this.maxFrameTime = 0;
      this.totalFrameTime = 0;
    }
  }
}
