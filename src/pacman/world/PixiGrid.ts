// world/PixiGrid.ts
import * as PIXI from "pixi.js";
import { WorldObject } from "./WorldObject.js";
import type { TileType, IUpdatable, TypeDeathScene } from "../shared/types.js";
import type { LevelContext } from "../core/LevelContext.js";
import type { CanvasLayer } from "../render/CanvasLayer.js";
import { pixiScenes } from "../scenes/pixiScenes.js";

const VOID = 0x111122;
const WALL_GLOW = 0x6666cc;
const DOT_COLOR = 0x8899ff;
const FLASH_COLOR = 0xffffff;
const PARTICLE_COLOR = 0xaabbff;

interface SimpleBlock {
  c: PIXI.Container;
  g: PIXI.Graphics;
  ox: number;
  oy: number;
  seed: number;
}

interface SimpleDot {
  g: PIXI.Graphics;
  ox: number;
  oy: number;
  seed: number;
}

interface SimpleParticle {
  g: PIXI.Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class PixiGrid extends WorldObject{
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

  private pulseActive = false;
  private pulseTimer = 0;
  private pulseAmplitude = 2.0;
  private deathEntities: TypeDeathScene | null = null;

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

  private simpleHash(p: number): number {
    let s = Math.floor(p * 12345.12345) / 10000;
    s = Math.abs(Math.sin(s));
    return s - Math.floor(s);
  }

  private buildBackground() {
    if (!this.bgLayer) return;
    this.bgLayer.removeChildren();
    this.dots = [];

    const bg = new PIXI.Graphics();
    bg.rect(0, 0, this.layer.canvas.width, this.layer.canvas.height);
    bg.fill({ color: VOID, alpha: 1 });
    this.bgLayer.addChild(bg);

    const map = this.gameState.levelData.map as TileType[][];
    const ts = this.tileSize;
    for (let r = 0; r <= map.length; r++) {
      for (let c = 0; c <= (map[0]?.length ?? 0); c++) {
        const g = new PIXI.Graphics();
        g.circle(c * ts, r * ts, 1);
        g.fill({ color: DOT_COLOR, alpha: 0.4 });
        this.bgLayer.addChild(g);
        this.dots.push({
          g,
          ox: c * ts,
          oy: r * ts,
          seed: Math.random() * 100,
        });
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
      return tile === "WL";
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isWall(r, c)) continue;

        const x = c * ts;
        const y = r * ts;

        const g = new PIXI.Graphics();
        const blockContainer = new PIXI.Container();

        blockContainer.position.set(x, y);
        blockContainer.addChild(g);
        this.wallLayer.addChild(blockContainer);

        this.blocks.push({
          c: blockContainer,
          g: g,
          ox: x,
          oy: y,
          seed: Math.random() * 500,
        });
      }
    }

    this.redrawWaveformWalls(0);
  }

  private redrawWaveformWalls(waveProgress: number) {
    const map = this.gameState.levelData.map as TileType[][];
    const ts = this.tileSize;
    const rows = map.length;
    const cols = map[0]?.length ?? 0;

    const isWall = (r: number, c: number): boolean => {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
      const tile = map[r][c];
      return tile === "WL" || tile === "LE";
    };

    const cx = this.layer.canvas.width / 2;
    const cy = this.layer.canvas.height / 2;
    const steps = 60;

    this.blocks.forEach((b) => {
      const r = Math.floor(b.oy / ts);
      const c = Math.floor(b.ox / ts);

      b.g.clear();

      const drawChaosWaveformLine = (
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        isHorizontal: boolean,
      ) => {
        b.g.moveTo(startX, startY);

        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          let currX = startX + (endX - startX) * t;
          let currY = startY + (endY - startY) * t;

          if (this.pulseActive) {
            const worldX = b.ox + currX;
            const worldY = b.oy + currY;
            const dx = worldX - cx;
            const dy = worldY - cy;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const waveFront = waveProgress * Math.max(cx, cy) * 1.3;
            const distanceToWavefront = Math.abs(distance - waveFront);
            const waveInfluenceWindow = 120;

            if (distanceToWavefront < waveInfluenceWindow) {
              const attenuation =
                1.0 - distanceToWavefront / waveInfluenceWindow;
              const uniquePointSeed = i * 23.17 + b.seed;

              const noisePrimary =
                (this.simpleHash(uniquePointSeed) * 0.7 +
                  this.simpleHash(uniquePointSeed * 3.1) * 0.3) *
                  2.0 -
                1.0;
              let spikePerpendicular =
                noisePrimary * this.pulseAmplitude * attenuation;
              spikePerpendicular *= Math.sin(
                this.time * 65.0 + uniquePointSeed * 0.1,
              );

              const noiseSkew =
                (this.simpleHash(uniquePointSeed * 5.4) * 0.6 +
                  this.simpleHash(uniquePointSeed * 7.9) * 0.4) *
                  2.0 -
                1.0;
              let spikeParallel =
                noiseSkew * (this.pulseAmplitude * 1.2) * attenuation;
              spikeParallel *= Math.cos(
                this.time * 50.0 + uniquePointSeed * 0.2,
              );

              if (isHorizontal) {
                currY += spikePerpendicular;
                currX += spikeParallel;
              } else {
                currX += spikePerpendicular;
                currY += spikeParallel;
              }
            }
          }
          b.g.lineTo(currX, currY);
        }
      };

      if (!isWall(r - 1, c)) drawChaosWaveformLine(0, 0, ts, 0, true);
      if (!isWall(r + 1, c)) drawChaosWaveformLine(0, ts, ts, ts, true);
      if (!isWall(r, c - 1)) drawChaosWaveformLine(0, 0, 0, ts, false);
      if (!isWall(r, c + 1)) drawChaosWaveformLine(ts, 0, ts, ts, false);

      b.g.stroke({ width: 1.5, color: WALL_GLOW, alpha: 0.8 });
    });
  }

  public startDeathAnimation(px: number, py: number, entities: TypeDeathScene) {
    if (!this.ready || !this.fxLayer || !this.app) return;

    // Fix: Force explicit size matching with high-DPR screens before reading layout dimensions
    this.app.renderer.resize(this.layer.canvas.width, this.layer.canvas.height);

    this.dying = true;
    this.deathP = 0;
    this.holeX = px;
    this.holeY = py;
    this.particles = [];
    this.deathEntities = entities;

    this.flash = new PIXI.Graphics();
    this.flash.circle(0, 0, 8);
    this.flash.fill({ color: FLASH_COLOR, alpha: 0.3 });
    this.flash.position.set(px, py);
    this.flashLife = 1.0;
    this.fxLayer.addChild(this.flash);

    this.blocks.forEach((b) => {
      b.c.position.set(b.ox, b.oy);
      b.c.rotation = 0;
      b.c.scale.set(1.0, 1.0);
      b.c.alpha = 1.0;
    });
  }

  public setDeathProgress(v: number) {
    this.deathP = Math.max(0, Math.min(v, 1));
  }

  private updateDeathAnimation(dt: number) {
    if (!this.dying || !this.app) return;
    const p = this.deathP;

    if (p <= 0.9) {
      const stageProgress = p / 0.9;
      this.pulseActive = true;
      this.pulseAmplitude = 2.0 + stageProgress * 26.0;
      this.time += dt * (stageProgress * 120.0);

      this.redrawWaveformWalls(stageProgress);

      this.blocks.forEach((b) => {
        b.c.alpha = 1.0 + stageProgress * 0.5;
      });

      if (Math.random() < stageProgress * 15 * dt) {
        const g = new PIXI.Graphics();
        g.rect(-1, -1, 2, 2);
        g.fill({ color: FLASH_COLOR, alpha: 0.8 });

        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (120 * (1.0 - stageProgress));
        g.position.set(
          this.holeX + Math.cos(angle) * radius,
          this.holeY + Math.sin(angle) * radius,
        );

        this.fxLayer!.addChild(g);
        this.particles.push({
          g,
          vx: -Math.cos(angle) * 100,
          vy: -Math.sin(angle) * 100,
          life: 0.2 + Math.random() * 0.2,
          maxLife: 0.4,
        });
      }
    } else {
      const stageProgress = (p - 0.9) / 0.1;
      const collapseFactor = Math.pow(stageProgress, 8);

      if (this.flash) {
        this.flash.alpha = 1.0;
        this.flash.clear();
        this.flash.circle(0, 0, (1.0 - collapseFactor) * 45 + 5);
        this.flash.fill({ color: FLASH_COLOR });
      }

      this.blocks.forEach((b) => {
        const bx = b.ox + this.tileSize / 2;
        const by = b.oy + this.tileSize / 2;

        const targetX = bx + (this.holeX - bx) * collapseFactor;
        const targetY = by + (this.holeY - by) * collapseFactor;

        b.c.x = targetX - this.tileSize / 2;
        b.c.y = targetY - this.tileSize / 2;

        const scaleVal = 1.0 - collapseFactor;
        b.c.scale.set(scaleVal, scaleVal);
        b.c.alpha = 1.0 - collapseFactor;
      });

      if (p >= 0.98 && this.particles.length < 50) {
        if (this.flash) this.flash.alpha = 0;

        const blastParticleCount = 80;
        for (let k = 0; k < blastParticleCount; k++) {
          const g = new PIXI.Graphics();
          g.rect(-2, -2, 4, 4);
          g.fill({ color: PARTICLE_COLOR, alpha: 1.0 });
          g.position.set(this.holeX, this.holeY);
          this.fxLayer!.addChild(g);

          const angle = Math.random() * Math.PI * 2;
          const speed = 250 + Math.random() * 450;

          this.particles.push({
            g,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.5 + Math.random() * 0.6,
            maxLife: 1.1,
          });
        }
      }
    }

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
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    }
  }

  public endDeathAnimation() {
    this.dying = false;
    this.deathP = 0;
    this.pulseActive = false;
    this.pulseAmplitude = 2.0;

    this.fxLayer?.removeChildren();
    this.particles = [];
    this.flash = null;

    this.blocks.forEach((b) => {
      b.c.position.set(b.ox, b.oy);
      b.c.rotation = 0;
      b.c.scale.set(1.0, 1.0);
      b.c.alpha = 1.0;
    });

    this.redrawWaveformWalls(0);
    this.app?.render();
  }

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
      b.c.alpha = dist > ringRadius ? 0.1 : 1;
    });

    this.dots.forEach((d) => {
      const dist = Math.sqrt((d.ox - cx) ** 2 + (d.oy - cy) ** 2);
      d.g.alpha = dist > ringRadius ? 0.05 : 0.4;
    });

    this.needsRedraw = true;
  }

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

    if (!this.pulseActive && !this.collapseActive) {
      this.pulseTimer += fs;
      if (this.pulseTimer >= 5.0) {
        this.pulseActive = true;
        this.pulseTimer = 0;
      }
    }

    if (this.pulseActive) {
      this.pulseTimer += fs;
      const duration = 1.5;
      if (this.pulseTimer >= duration) {
        this.pulseActive = false;
        this.pulseTimer = 0;
        this.redrawWaveformWalls(0);
      } else {
        this.redrawWaveformWalls(this.pulseTimer / duration);
      }
    }

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
