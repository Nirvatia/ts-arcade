import { CFG_CANVAS } from "../config/canvas.js";
import { eventBus } from "../core/eventBus.js";
import type { Collectible } from "../interfaces.js";
import { WorldObject } from "./worldObject.js";

export class Dot extends WorldObject implements Collectible {
  private dotSize: number;
  public positions: Set<string> = new Set<string>();

  constructor() {
    super(CFG_CANVAS.canvasIds.dots);
    this.dotSize = this.tileSize * 0.11;
    this.initEventListeners();
  }

  private initEventListeners(): void {
    eventBus.on(
      "dot:collect",
      (data: { position: { i: number; j: number } }) => {
        this.collect(data.position.i, data.position.j);
      },
    );
  }

  spawn(): void {
    this.positions.clear();
    this.clearCanvas();

    const map = this.gameState.levelData.map;
    let cnt = 0;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (map[i][j] === "FD") {
          this.positions.add(`${i},${j}`);
          cnt++;
        }
      }
    }

    this.needsRedraw = true;
    eventBus.emit("dot:spawned", { count: cnt });
  }

  collect(i: number, j: number): void {
    this.positions.delete(`${i},${j}`);
    this.clearCanvas(
      j * this.tileSize - 2,
      i * this.tileSize - 2,
      this.tileSize + 4,
      this.tileSize + 4,
    );
    eventBus.emit("dot:eaten", {
      position: { i, j },
      dotsRemaining: this.positions.size,
    });
  }

  override reset(): void {
    super.reset();
    this.positions.clear();
  }

  draw(): void {
    this.clearCanvas();
    const ctx = this.ctx;

    ctx.save();
    ctx.shadowColor = "rgba(0, 200, 255, 0.5)";
    ctx.shadowBlur = 3;
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";

    this.positions.forEach((pos) => {
      const [i, j] = pos.split(",").map(Number);
      const cx = this.tileSize * j + this.tileSize / 2;
      const cy = this.tileSize * i + this.tileSize / 2;
      const half = this.dotSize / 2;

      ctx.fillRect(cx - half, cy - half, this.dotSize, this.dotSize);
    });

    ctx.restore();
  }
}
