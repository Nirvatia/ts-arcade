import * as PIXI from "pixi.js";
import { WorldObject } from "./WorldObject.js";
import type { TileType } from "../shared/types.js";
import type { LevelContext } from "../core/LevelContext.js";

// ──────────────────────────────────────────────
// THE OSSUARY — Static cosmic horror maze
// Fossilized remains. Cold. Silent. Ancient.
// ──────────────────────────────────────────────

// ── Palette ──────────────────────────────────
const VOID_FLOOR    = 0x020612; // Barely-perceptible path — thin ice over abyss
const VOID_ABYSS    = 0x000411; // Absolute void where no path exists
const BONE_CORE     = 0x7788cc; // Cold blue-white filament
const BONE_HALO     = 0x445599; // Outer glow of filament

// ── Constants ────────────────────────────────
const FILAMENT_WIDTH  = 1.2;  // Core line width
const HALO_WIDTH      = 3.5;  // Outer glow width

export class PixiGrid extends WorldObject {
  public container: PIXI.Container;

  private wallLayer: PIXI.Container;
  private floorLayer: PIXI.Container;

  private gridWidth = 0;
  private gridHeight = 0;
  private ready = false;

  constructor(levelContext: LevelContext) {
    super(levelContext);

    this.container = new PIXI.Container();
    this.floorLayer = new PIXI.Container();
    this.wallLayer = new PIXI.Container();

    this.container.addChild(this.floorLayer);
    this.container.addChild(this.wallLayer);
  }

  public async init() {
    if (this.ready) return;

    const map = this.gameState.levelData.map as TileType[][];
    const ts = this.tileSize;

    if (map?.length) {
      this.gridWidth = (map[0]?.length ?? 0) * ts;
      this.gridHeight = map.length * ts;
    }

    this.ready = true;
    this.drawFloor();
    this.drawWalls();
  }

  // ══════════════════════════════════════════
  // FLOOR — Thin ice over abyss
  // ══════════════════════════════════════════

  private drawFloor(): void {
    this.floorLayer.removeChildren();

    const g = new PIXI.Graphics();
    const map = this.gameState.levelData.map as TileType[][];
    const ts = this.tileSize;
    const rows = map.length;
    const cols = map[0]?.length ?? 0;

    // Full abyss fill
    g.rect(0, 0, this.gridWidth, this.gridHeight);
    g.fill({ color: VOID_ABYSS, alpha: 1 });

    // Precompute walkable tiles once
    const walkable = Array(rows).fill(null).map(() => Array(cols).fill(false));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = map[r][c];
        walkable[r][c] = tile !== "WL" && tile !== "LE";
      }
    }

    // Walkable tiles as merged horizontal spans — no seams
    for (let r = 0; r < rows; r++) {
      let spanStart: number | null = null;

      for (let c = 0; c < cols; c++) {
        if (walkable[r][c] && spanStart === null) {
          spanStart = c;
        }

        if (!walkable[r][c] && spanStart !== null) {
          const spanWidth = (c - spanStart) * ts;
          g.rect(spanStart * ts, r * ts, spanWidth, ts);
          g.fill({ color: VOID_FLOOR, alpha: 0.45 });
          spanStart = null;
        }
      }

      if (spanStart !== null) {
        const spanWidth = (cols - spanStart) * ts;
        g.rect(spanStart * ts, r * ts, spanWidth, ts);
        g.fill({ color: VOID_FLOOR, alpha: 0.45 });
      }
    }

    this.floorLayer.addChild(g);
  }

  // ══════════════════════════════════════════
  // WALLS — Pure filaments, no joints
  // ══════════════════════════════════════════

  private drawWalls(): void {
    this.wallLayer.removeChildren();

    const map = this.gameState.levelData.map as TileType[][];
    const ts = this.tileSize;
    const rows = map.length;
    const cols = map[0]?.length ?? 0;

    // Precompute solid/open grids
    const solid = Array(rows).fill(null).map(() => Array(cols).fill(false));
    const open = Array(rows).fill(null).map(() => Array(cols).fill(false));
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = map[r][c];
        solid[r][c] = tile === "WL" || tile === "LE";
        open[r][c] = !solid[r][c];
      }
    }

    // Batch edges by direction
    const upEdges: [number, number][] = [];
    const downEdges: [number, number][] = [];
    const leftEdges: [number, number][] = [];
    const rightEdges: [number, number][] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!solid[r][c]) continue;

        if (r > 0 && open[r - 1][c]) upEdges.push([c, r]);
        if (r + 1 < rows && open[r + 1][c]) downEdges.push([c, r]);
        if (c > 0 && open[r][c - 1]) leftEdges.push([c, r]);
        if (c + 1 < cols && open[r][c + 1]) rightEdges.push([c, r]);
      }
    }

    const g = new PIXI.Graphics();

    // Draw all up edges (top of wall)
    for (const [c, r] of upEdges) {
      const x = c * ts;
      const y = r * ts;
      g.moveTo(x, y);
      g.lineTo(x + ts, y);
    }

    // Draw all down edges (bottom of wall)
    for (const [c, r] of downEdges) {
      const x = c * ts;
      const y = r * ts + ts;
      g.moveTo(x, y);
      g.lineTo(x + ts, y);
    }

    // Draw all left edges
    for (const [c, r] of leftEdges) {
      const x = c * ts;
      const y = r * ts;
      g.moveTo(x, y);
      g.lineTo(x, y + ts);
    }

    // Draw all right edges
    for (const [c, r] of rightEdges) {
      const x = c * ts + ts;
      const y = r * ts;
      g.moveTo(x, y);
      g.lineTo(x, y + ts);
    }

    // Apply strokes in batch
    g.stroke({
      color: BONE_HALO,
      width: HALO_WIDTH,
      alpha: 0.25,
      cap: "round",
    });

    g.stroke({
      color: BONE_CORE,
      width: FILAMENT_WIDTH,
      alpha: 0.85,
      cap: "round",
    });

    this.wallLayer.addChild(g);
  }

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════

  public update(_dt: number): void {}

  public draw(): void {}

  public reset(): void {
    this.drawFloor();
    this.drawWalls();
  }

  public override destroy(): void {
    this.container.destroy({ children: true });
    this.ready = false;
  }
}