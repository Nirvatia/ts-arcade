// world/PixiGrid.ts
import * as PIXI from "pixi.js";
import { WorldObject } from "./WorldObject.js";
import type { TileType, IUpdatable } from "../shared/types.js";
import type { LevelContext } from "../core/LevelContext.js";
import type { CanvasLayer } from "../render/CanvasLayer.js";
import { pixiScenes } from "../scenes/pixiScenes.js";

// ── Palette (simplified) ────────────────────────────────────────
const VOID = 0x111122;
const WALL_COLOR = 0x4444aa;
const WALL_GLOW = 0x6666cc;
const DOT_COLOR = 0x8899ff;
const FLASH_COLOR = 0xffffff;
const PARTICLE_COLOR = 0xaabbff;

// ── Types (simplified) ──────────────────────────────────────────
interface SimpleBlock {
  c: PIXI.Container;
  ox: number;
  oy: number;
}

interface SimpleDot {
  g: PIXI.Graphics;
  ox: number;
  oy: number;
}

interface SimpleParticle {
  g: PIXI.Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

// ── Class ───────────────────────────────────────────────────────
export class PixiGrid extends WorldObject implements IUpdatable {
  private time = 0;
  private app: PIXI.Application | null = null;
  private ready = false;

  private bgLayer: PIXI.Container | null = null;
  private wallLayer: PIXI.Container | null = null;
  private fxLayer: PIXI.Container | null = null;

  private blocks: SimpleBlock[] = [];
  private dots: SimpleDot[] = [];
  private particles: SimpleParticle[] = [];

  private dying = false;
  private deathP = 0;
  private holeX = 0;
  private holeY = 0;
  private flash: PIXI.Graphics | null = null;
  private flashLife = 0;

  private collapseActive = false;
  private collapseStartTime = 0;

  constructor(layer: CanvasLayer, lc: LevelContext) {
    super(layer, lc);
  }

  get isFlashing() {
    return this.collapseActive;
  }
  set isFlashing(v: boolean) {
    if (v && !this.collapseActive) {
      this.collapseActive = true;
      this.collapseStartTime = this.time;
      this.needsRedraw = true;
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  public async init() {
    if (this.ready) return;
    const map = this.gameState.levelData.map as TileType[][];
    if (map?.length) this.layer.resize(this.tileSize, map);
    await this.initPixi();
  }

  private async initPixi() {
    if (this.app) await this.nuke();
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.layer.canvas,
      width: this.layer.canvas.width,
      height: this.layer.canvas.height,
      backgroundAlpha: 0,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: "webgl",
    });

    this.bgLayer = new PIXI.Container();
    this.wallLayer = new PIXI.Container();
    this.fxLayer = new PIXI.Container();

    this.app.stage.addChild(this.bgLayer);
    this.app.stage.addChild(this.wallLayer);
    this.app.stage.addChild(this.fxLayer);

    this.ready = true;
    this.buildBackground();
    this.buildWalls();
    this.app.render();
  }

  public playIntermission(duration: number, onComplete: () => void): void {
    if (!this.app) return;
    if (this.bgLayer) this.bgLayer.visible = false;
    if (this.wallLayer) this.wallLayer.visible = false;

    const keys = Object.keys(pixiScenes);
    const key = keys[Math.floor(Math.random() * keys.length)];
    const fn = pixiScenes[key];

    const done = () => {
      if (this.bgLayer) this.bgLayer.visible = true;
      if (this.wallLayer) this.wallLayer.visible = true;
      onComplete();
    };

    if (fn) {
      fn(
        this.app.stage,
        this.layer.canvas.width,
        this.layer.canvas.height,
        duration,
        done,
      );
    } else {
      done();
    }
  }

  // ── Basic Builders ────────────────────────────────────────────
  private buildBackground() {
    if (!this.bgLayer) return;
    this.bgLayer.removeChildren();
    this.dots = [];

    // Solid background
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, this.layer.canvas.width, this.layer.canvas.height);
    bg.fill({ color: VOID, alpha: 1 });
    this.bgLayer.addChild(bg);

    // Simple dot grid
    const map = this.gameState.levelData.map as TileType[][];
    const ts = this.tileSize;
    for (let r = 0; r <= map.length; r++) {
      for (let c = 0; c <= (map[0]?.length ?? 0); c++) {
        const g = new PIXI.Graphics();
        g.circle(c * ts, r * ts, 1);
        g.fill({ color: DOT_COLOR, alpha: 0.4 });
        this.bgLayer.addChild(g);
        this.dots.push({ g, ox: c * ts, oy: r * ts });
      }
    }
  }

  private buildWalls() {
    if (!this.wallLayer) return;
    this.wallLayer.removeChildren();
    this.blocks = [];

    const map = this.gameState.levelData.map as TileType[][];
    const ts = this.tileSize;
    const rows = map.length;
    const cols = map[0]?.length ?? 0;

    const isWall = (r: number, c: number): boolean => {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
      const tile = map[r][c];
      return tile === "WL" || tile === "LE";
    };

    const g = new PIXI.Graphics();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isWall(r, c)) continue;

        const x = c * ts;
        const y = r * ts;

        // Top edge: draw if neighbor above is NOT a wall
        if (!isWall(r - 1, c)) {
          g.moveTo(x, y);
          g.lineTo(x + ts, y);
        }
        // Bottom edge
        if (!isWall(r + 1, c)) {
          g.moveTo(x, y + ts);
          g.lineTo(x + ts, y + ts);
        }
        // Left edge
        if (!isWall(r, c - 1)) {
          g.moveTo(x, y);
          g.lineTo(x, y + ts);
        }
        // Right edge
        if (!isWall(r, c + 1)) {
          g.moveTo(x + ts, y);
          g.lineTo(x + ts, y + ts);
        }
      }
    }

    g.stroke({ width: 1.5, color: WALL_GLOW, alpha: 0.8 });

    const container = new PIXI.Container();
    container.addChild(g);
    this.wallLayer!.addChild(container);
    this.blocks.push({ c: container, ox: 0, oy: 0 });
  }

  // ── Death Animation (simplified) ──────────────────────────────
  public startDeathAnimation(px: number, py: number) {
    if (!this.ready || !this.fxLayer) return;
    this.dying = true;
    this.deathP = 0;
    this.holeX = px;
    this.holeY = py;
    this.particles = [];

    this.flash = new PIXI.Graphics();
    this.flash.circle(px, py, 15);
    this.flash.fill({ color: FLASH_COLOR, alpha: 0.9 });
    this.flashLife = 1.0;
    this.fxLayer.addChild(this.flash);
  }

  public setDeathProgress(v: number) {
    this.deathP = Math.max(0, Math.min(v, 1));
  }

  private updateDeathAnimation(dt: number) {
    if (!this.dying || !this.app) return;
    const p = this.deathP;

    // Flash shrinks
    if (this.flash) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) {
        this.flash.alpha = 0;
      } else {
        this.flash.alpha = this.flashLife;
        this.flash.scale.set(1 + (1 - this.flashLife) * 3);
      }
    }

    // Walls fade and move toward hole
    this.blocks.forEach((b) => {
      const bx = b.ox + this.tileSize / 2;
      const by = b.oy + this.tileSize / 2;
      const dx = bx - this.holeX;
      const dy = by - this.holeY;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const pull = p * 0.5 * (1 / (dist * 0.01 + 1));
      b.c.x = b.ox - dx * pull;
      b.c.y = b.oy - dy * pull;
      b.c.alpha = 1 - p;
    });

    // Spawn particles
    if (Math.random() < p * 5 * dt) {
      const g = new PIXI.Graphics();
      g.rect(-2, -2, 4, 4);
      g.fill({ color: PARTICLE_COLOR, alpha: 0.8 });
      g.x = this.holeX + (Math.random() - 0.5) * 20;
      g.y = this.holeY + (Math.random() - 0.5) * 20;
      this.fxLayer!.addChild(g);
      this.particles.push({
        g,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        life: 1.5 + Math.random(),
        maxLife: 1.5 + Math.random(),
      });
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.g.alpha = 0;
        this.particles.splice(i, 1);
        continue;
      }
      pt.g.x += pt.vx * dt;
      pt.g.y += pt.vy * dt;
      pt.g.alpha = pt.life / pt.maxLife;
    }
  }

  public endDeathAnimation() {
    this.dying = false;
    this.deathP = 0;
    this.fxLayer?.removeChildren();
    this.particles = [];
    this.flash = null;

    // Reset all walls
    this.blocks.forEach((b) => {
      b.c.x = b.ox;
      b.c.y = b.oy;
      b.c.alpha = 1;
    });
    this.app?.render();
  }

  // ── Level Complete Collapse (simplified) ──────────────────────
  private updateCollapseAnimation(dt: number) {
    const elapsed = this.time - this.collapseStartTime;
    const totalDuration = 4.0;

    if (elapsed >= totalDuration) {
      this.collapseActive = false;
      this.needsRedraw = true;
      return;
    }

    const progress = elapsed / totalDuration;
    const cx = this.layer.canvas.width / 2;
    const cy = this.layer.canvas.height / 2;
    const ringRadius = progress * Math.max(cx, cy) * 0.9;

    this.blocks.forEach((b) => {
      const bx = b.ox + this.tileSize / 2;
      const by = b.oy + this.tileSize / 2;
      const dist = Math.sqrt((bx - cx) ** 2 + (by - cy) ** 2);
      if (dist > ringRadius) {
        b.c.alpha = 0.1;
      } else {
        b.c.alpha = 1;
      }
    });

    this.dots.forEach((d) => {
      const dist = Math.sqrt((d.ox - cx) ** 2 + (d.oy - cy) ** 2);
      if (dist > ringRadius) {
        d.g.alpha = 0.05;
      } else {
        d.g.alpha = 0.4;
      }
    });

    this.needsRedraw = true;
  }

  // ── Update / Draw ─────────────────────────────────────────────
  public update(dt: number) {
    if (!this.ready || !this.app) return;
    const fs = Math.min(
      dt === undefined || isNaN(dt) || dt === 0 ? 0.016 : dt,
      0.1,
    );
    this.time += fs;

    if (this.dying) {
      this.updateDeathAnimation(fs);
      this.needsRedraw = true;
      return;
    }
    if (this.collapseActive) {
      this.updateCollapseAnimation(fs);
      return;
    }

    // Subtle dot twinkle
    this.dots.forEach((d, i) => {
      d.g.alpha = 0.3 + Math.sin(this.time * 2 + i * 0.1) * 0.1;
    });

    this.needsRedraw = true;
  }

  public draw() {
    if (!this.ready || !this.app) return;
    this.app.render();
  }

  public reset() {
    const map = this.gameState.levelData.map as TileType[][];
    if (map?.length) this.layer.resize(this.tileSize, map);
    if (this.app && this.ready) {
      this.app.renderer.resize(
        this.layer.canvas.width,
        this.layer.canvas.height,
      );
      this.endDeathAnimation();
      this.buildBackground();
      this.buildWalls();
      this.app.render();
    }
  }

  private async nuke() {
    if (!this.app) return;
    try {
      this.app.destroy(false, { children: true, texture: true });
    } catch {}
    this.app = null;
    this.ready = false;
  }

  public override destroy() {
    this.nuke();
  }
}
