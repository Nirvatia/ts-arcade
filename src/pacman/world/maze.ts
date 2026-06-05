import * as PIXI from "pixi.js";
import { CFG_CANVAS } from "../config/canvas.config.js";
import { WorldObject } from "./WorldObject.js";
import type { TileType } from "../shared/types.js";

export class Maze extends WorldObject {
  private _isFlashing: boolean = false;
  private flashTicker: number = 0;
  private pulseTicker: number = 0;

  private pixiApp: PIXI.Application | null = null;
  private isPixiReady: boolean = false;

  // Discrete rendering layers for architectural contrast control
  private rootContainer: PIXI.Container | null = null;
  private spaceVoidLayer: PIXI.Graphics | null = null;
  private circuitGlowLayer: PIXI.Graphics | null = null;
  private tronRailLayer: PIXI.Graphics | null = null;
  private plasmaFilamentLayer: PIXI.Graphics | null = null;
  private dataNodesLayer: PIXI.Graphics | null = null;

  private nodeBlurFilter: PIXI.BlurFilter | null = null;

  constructor() {
    super(CFG_CANVAS.canvasIds.maze);
    this.initPixi();
  }

  get isFlashing(): boolean {
    return this._isFlashing;
  }
  set isFlashing(value: boolean) {
    this._isFlashing = value;
    this.needsRedraw = true;
  }

  private async initPixi(): Promise<void> {
    this.pixiApp = new PIXI.Application();

    await this.pixiApp.init({
      width: this.canvas.width,
      height: this.canvas.height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      preference: "webgl",
    });

    this.rootContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(this.rootContainer);

    this.spaceVoidLayer = new PIXI.Graphics();
    this.circuitGlowLayer = new PIXI.Graphics();
    this.tronRailLayer = new PIXI.Graphics();
    this.plasmaFilamentLayer = new PIXI.Graphics();
    this.dataNodesLayer = new PIXI.Graphics();

    // Tighten the blur filter to prevent massive, overwhelming light bleeds
    this.nodeBlurFilter = new PIXI.BlurFilter();
    this.nodeBlurFilter.strength = 3;
    this.circuitGlowLayer.filters = [this.nodeBlurFilter];

    // Hardware blend pooling
    this.circuitGlowLayer.blendMode = 'screen';
    this.tronRailLayer.blendMode = 'screen';
    this.plasmaFilamentLayer.blendMode = 'add';
    this.dataNodesLayer.blendMode = 'add';

    // Master layer stacking order
    this.rootContainer.addChild(this.spaceVoidLayer);
    this.rootContainer.addChild(this.circuitGlowLayer);
    this.rootContainer.addChild(this.tronRailLayer);
    this.rootContainer.addChild(this.plasmaFilamentLayer);
    this.rootContainer.addChild(this.dataNodesLayer);

    this.isPixiReady = true;
    this.bakeTronCosmicMaze();
  }

  private getBalancedPalette() {
    const hue = this.gameState.levelData.mapHue ?? 195; // Theme hue
    return {
      deepSpace: 0x010103,          // Darkened backdrop from 0x03030a to drop ambient clutter
      gridLine: 0x05080e,           // Faded background coordinate grid lines to 3% opacity
      circuitCore: this.hslToHex(hue, 40, 8),   // Subdued runner tracks (lowered saturation and lightness)
      tronNeon: this.hslToHex(hue, 85, 40),     // Slipped out neon intensity (85% sat, 40% light instead of 100/50)
      energyNode: this.hslToHex(hue, 70, 30),   // Locked node hue to match theme, lowered brightness significantly
      hotPlasma: 0xeef7ff,          // Shifted center core from bright white to a muted ice-blue
    };
  }

  public override reset(): void {
    super.reset();
    if (this.pixiApp && this.isPixiReady) {
      this.pixiApp.renderer.resize(this.canvas.width, this.canvas.height);
      this.bakeTronCosmicMaze();
    }
  }

private bakeTronCosmicMaze(): void {
    if (!this.isPixiReady || !this.rootContainer) return;

    const map = this.gameState.levelData.map as string[][];
    const ts = this.tileSize;
    const colors = this.getBalancedPalette();
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Flush graphics pipelines
    [this.spaceVoidLayer!, this.circuitGlowLayer!, this.tronRailLayer!, this.plasmaFilamentLayer!, this.dataNodesLayer!].forEach(l => l.clear());

    // 1. Draw Subdued Space Void
    this.spaceVoidLayer!.rect(0, 0, cw, ch).fill({ color: colors.deepSpace });
    
    // --- FAINT BACKGROUND GRID TEST ---
    // We draw fine coordinate cross-lines at tile intervals using ultra-low visibility
    for (let x = 0; x <= cw; x += ts) {
      this.spaceVoidLayer!.moveTo(x, 0).lineTo(x, ch);
    }
    for (let y = 0; y <= ch; y += ts) {
      this.spaceVoidLayer!.moveTo(0, y).lineTo(cw, y);
    }
    this.spaceVoidLayer!.stroke({ 
      width: 0.5, 
      color: colors.gridLine, 
      alpha: 0.15 // Dropped to a near-invisible whisper to test the background depth
    });
    // ----------------------------------

    // 2. Draw Circuit Runway Base Guide Tracks
    this.buildVectorTronPath(map, this.spaceVoidLayer!, ts, 0);
    this.spaceVoidLayer!.stroke({
      width: ts * 0.4,
      color: colors.circuitCore,
      cap: "square",
      join: "miter",
    });

    // 3. Draw Laser Fences (Corridor geometry mapping)
    const edgeOffset = ts * 0.42; 

    // Ambient Neon Underlay Pass
    this.buildVectorTronPath(map, this.tronRailLayer!, ts, edgeOffset);
    this.buildVectorTronPath(map, this.tronRailLayer!, ts, -edgeOffset);
    this.tronRailLayer!.stroke({
      width: 1.8, 
      color: colors.tronNeon,
      cap: "square",
      join: "miter",
    });

    // High-Contrast Core Filament Pass
    this.buildVectorTronPath(map, this.plasmaFilamentLayer!, ts, edgeOffset);
    this.buildVectorTronPath(map, this.plasmaFilamentLayer!, ts, -edgeOffset);
    this.plasmaFilamentLayer!.stroke({
      width: 0.6, 
      color: colors.hotPlasma,
      cap: "square",
      join: "miter",
    });

    // 4. Inject Graceful, Non-Overwhelming Corner Node Indicators
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const type = map[r][c];
        if (type === "WH" || type === "WV" || type === "ES") continue;
        if (this.isWall(type as TileType)) {
          const x = c * ts + ts / 2;
          const y = r * ts + ts / 2;

          // Soft localized corner glow
          this.circuitGlowLayer!.circle(x, y, ts * 0.25);
          this.circuitGlowLayer!.fill({ color: colors.energyNode, alpha: 0.25 });

          // Fine point pin-junction data nodes
          this.dataNodesLayer!.circle(x, y, 1.0);
          this.dataNodesLayer!.fill({ color: colors.hotPlasma });
        }
      }
    }
  }

  public draw(): void {
    if (!this.isPixiReady || !this.pixiApp) return;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    if (!this._isFlashing) {
      // Locked completely static for stable, distraction-free navigation balance
      this.circuitGlowLayer!.alpha = 0.7;
      this.dataNodesLayer!.alpha = 0.9;
      this.rootContainer!.alpha = 1.0;
      this.needsRedraw = false; 
    } else {
      this.flashTicker += 0.25;
      this.rootContainer!.alpha = Math.floor(this.flashTicker) % 2 === 0 ? 0.2 : 1.0;
      this.needsRedraw = true;
    }

    this.pixiApp.render();

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(this.pixiApp.canvas, 0, 0);
  }

  private buildVectorTronPath(
    map: string[][],
    g: PIXI.Graphics,
    ts: number,
    offset: number,
  ): void {
    const rSize = ts * 0.15; // Smooth arc radius transition values

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const type = map[i][j];
        const x = j * ts;
        const y = i * ts;
        const hSize = ts / 2;

        if (type === "WH" || type === "GL") {
          g.moveTo(x, y + hSize + offset);
          g.lineTo(x + ts, y + hSize + offset);
        } else if (type === "WV") {
          g.moveTo(x + hSize + offset, y + ts);
          g.lineTo(x + hSize + offset, y);
        } else if (type === "TL") {
          g.moveTo(x + hSize + offset, y + ts);
          g.arcTo(x + hSize + offset, y + hSize + offset, x + ts, y + hSize + offset, rSize);
          g.lineTo(x + ts, y + hSize + offset);
        } else if (type === "BL") {
          g.moveTo(x + hSize + offset, y);
          g.arcTo(x + hSize + offset, y + hSize - offset, x + ts, y + hSize - offset, rSize);
          g.lineTo(x + ts, y + hSize - offset);
        } else if (type === "BR") {
          g.moveTo(x + hSize - offset, y);
          g.arcTo(x + hSize - offset, y + hSize - offset, x, y + hSize - offset, rSize);
          g.lineTo(x, y + hSize - offset);
        } else if (type === "TR") {
          g.moveTo(x + hSize - offset, y + ts);
          g.arcTo(x + hSize - offset, y + hSize + offset, x, y + hSize + offset, rSize);
          g.lineTo(x, y + hSize + offset);
        }
      }
    }
  }

  private isWall(type: TileType): boolean {
    if (!type) return false;
    return ["WH", "WV", "TL", "TR", "BL", "BR", "GL"].includes(type);
  }

  private hslToHex(h: number, s: number, l: number): number {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`, 16);
  }

  public override destroy(): void {
    if (this.pixiApp) {
      this.pixiApp.destroy(true, { children: true });
      this.pixiApp = null;
    }
    this.isPixiReady = false;
  }
}