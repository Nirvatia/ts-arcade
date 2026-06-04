import { CFG_CANVAS } from "../config/canvas.config.js";
import { WorldObject } from "./WorldObject.js";

export class Maze extends WorldObject {
  private _isFlashing: boolean = false;

  constructor() {
    super(CFG_CANVAS.canvasIds.maze);
  }

  get isFlashing(): boolean {
    return this._isFlashing;
  }
  set isFlashing(value: boolean) {
    this._isFlashing = value;
  }

  private getColors(): { bg: string; wallCore: string; neonWire: string; glow: string } {
    const hue = this.gameState.levelData.mapHue ?? 190;
    return {
      bg: "#000000",
      // Dark solid infill for the center of the walls
      wallCore: `hsla(${hue}, 60%, 8%, 0.95)`, 
      // Muted laser line strictly defining the corridor perimeter edges
      neonWire: `hsla(${hue}, 75%, 35%, 0.80)`,
      // Minimal light bleed to maintain high contrast
      glow: `hsla(${hue}, 80%, 40%, 0.12)`,
    };
  }

  draw(): void {
    const map = this.gameState.levelData.map;
    const ctx = this.ctx;
    const ts = this.tileSize;
    const colors = this.getColors();
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.save();

    if (this._isFlashing) {
      const time = Date.now() / 150;
      ctx.globalAlpha = 0.15 + Math.sin(time) * 0.3;
    }

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, cw, ch);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // --- STEP 1: FILL THE WALL CORE MASS ---
    // This establishes solid volume down the center first
    ctx.beginPath();
    this.buildTronPath(map, ctx, ts, 0);
    ctx.strokeStyle = colors.wallCore;
    ctx.lineWidth = ts * 0.75; // Thick blocking fill
    ctx.shadowBlur = 0;
    ctx.stroke();

    // --- STEP 2: SHIFT ACCENTS TO THE OUTER EDGES ---
    // We calculate the boundary lines by offsetting the track slightly outwards (+ and -)
    // This frames the corridors perfectly and eliminates the wide illusion
    const edgeOffset = ts * 0.36; 
    ctx.strokeStyle = colors.neonWire;
    ctx.lineWidth = 1.5; // Crisper, thinner lines
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = this._isFlashing ? 6 : 2;

    // Left/Top boundary profile
    ctx.beginPath();
    this.buildTronPath(map, ctx, ts, edgeOffset);
    ctx.stroke();

    // Right/Bottom boundary profile
    ctx.beginPath();
    this.buildTronPath(map, ctx, ts, -edgeOffset);
    ctx.stroke();

    ctx.restore();
    this.needsRedraw = false;
  }

  private buildTronPath(
    map: string[][],
    ctx: CanvasRenderingContext2D,
    ts: number,
    offset: number,
  ): void {
    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const type = map[i][j];
        const x = j * ts;
        const y = i * ts;
        const hSize = ts / 2;

        if (type === "WH") {
          ctx.moveTo(x, y + hSize + offset);
          ctx.lineTo(x + ts, y + hSize + offset);
        } else if (type === "WV") {
          ctx.moveTo(x + hSize + offset, y + ts);
          ctx.lineTo(x + hSize + offset, y);
        } else if (type === "TL") {
          ctx.moveTo(x + hSize + offset, y + ts);
          ctx.lineTo(x + hSize + offset, y + hSize + offset);
          ctx.lineTo(x + ts, y + hSize + offset);
        } else if (type === "BL") {
          ctx.moveTo(x + hSize + offset, y);
          ctx.lineTo(x + hSize + offset, y + hSize - offset);
          ctx.lineTo(x + ts, y + hSize - offset);
        } else if (type === "BR") {
          ctx.moveTo(x + hSize - offset, y);
          ctx.lineTo(x + hSize - offset, y + hSize - offset);
          ctx.lineTo(x, y + hSize - offset);
        } else if (type === "TR") {
          ctx.moveTo(x + hSize - offset, y + ts);
          ctx.lineTo(x + hSize - offset, y + hSize + offset);
          ctx.lineTo(x, y + hSize + offset);
        }
      }
    }
  }
}