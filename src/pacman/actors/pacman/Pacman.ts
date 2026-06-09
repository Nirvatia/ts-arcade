import * as PIXI from "pixi.js";
import { Actor } from "../Actor.js";
import { eventBus } from "../../core/EventBus.js";
import type { Ghost } from "../ghost/Ghost.js";
import type { PacmanConfig } from "../../config/pacman.config.js";
import type { LevelContext } from "../../core/LevelContext.js";

// ──────────────────────────────────────────────
// EVENT HORIZON — v2
// Cosmic horror adapted for game readability.
// ──────────────────────────────────────────────

// ── Palette ──────────────────────────────────
const VOID_CORE       = 0x020612; // Deep blue-black body
const VOID_EDGE       = 0x030a1f; // Slightly lighter at rim
const PHOTON_INNER    = 0x8899ff; // Blue-shifted (forward)
const PHOTON_OUTER    = 0x4455cc; // Soft glow ring
const PHOTON_TRAILING = 0x664488; // Red-shifted (rear)
const PHOTON_BUFFED   = 0xccddff; // Buffed bright ring
const ACCRETION_DISK  = 0x4466aa; // Buffed disk fill
const MOUTH_GLOW      = 0x223366; // Light escaping mouth
const MOUTH_BUFFED    = 0x4466cc; // Buffed mouth interior
const CHERENKOV_BASE  = 0x3344aa; // Trail core
const CHERENKOV_GLOW  = 0x8899ff; // Trail glow
const FLARE_WHITE     = 0xffffff;
const GHOST_STREAK    = 0x44ccff;

interface TrailNode {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
}

interface RingVFX {
  x: number;          // World X
  y: number;          // World Y
  radius: number;     // Current radius
  maxRadius: number;  // Target max radius
  life: number;
  maxLife: number;
  type: "DOT_SWALLOW" | "PILL_EXPAND" | "WORMHOLE_EXIT" | "WORMHOLE_ENTRY";
  rotation: number;   // For wormhole cross orientation
}

export class Pacman extends Actor {
  private config: PacmanConfig;
  public state: "ALIVE" | "EATEN" | "DYING" = "ALIVE";
  public nextDirection: { dx: number; dy: number } | null = null;
  private lastDirection: { dx: number; dy: number } = { dx: 1, dy: 0 };
  private time = 0;

  private normalSpeed: number;
  private buffedSpeed: number;

  // ── Display Tree ────────────────────────
  public container: PIXI.Container;
  private trailGfx: PIXI.Graphics;
  private accretionGfx: PIXI.Graphics;  // Buffed disk (behind body)
  private bodyGfx: PIXI.Graphics;
  private mouthGfx: PIXI.Graphics;      // Mouth interior glow (on top of body)
  private particleGfx: PIXI.Graphics;
  private ringVfxGfx: PIXI.Graphics;    // Eat/teleport ring effects
  private flashGfx: PIXI.Graphics;
  private ghostStreakGfx: PIXI.Graphics;

  // ── Trail buffer ────────────────────────
  private trail: TrailNode[] = [];

  // ── Particle pool ───────────────────────
  private particles: Particle[] = [];

  // ── Ring VFX pool ───────────────────────
  private ringVfx: RingVFX[] = [];

  // ── Death state ─────────────────────────
  private deathTimer = 0;
  private deathParticleTimer = 0;
  private deathShrinkFactor = 0;
  private deathConvulsePhase = 0;

  // ── Ghost absorption ────────────────────
  private ghostStreakTimer = 0;
  private ghostStreakStartX = 0;
  private ghostStreakStartY = 0;
  private ghostTerminalFlash = 0;

  // ── Eat flash ───────────────────────────
  private eatFlashTimer = 0;
  private eatFlashType: "DOT" | "PILL" | "GHOST" | null = null;

  constructor(levelContext: LevelContext, config: PacmanConfig) {
    super(levelContext);
    this.config = config;
    this.normalSpeed = this.tileSize * config.normalSpeedMultiplier;
    this.buffedSpeed = this.tileSize * config.buffedSpeedMultiplier;
    this.speed = this.normalSpeed;
    this.r = this.tileSize * config.radiusMultiplier;

    // ── Build display tree (back to front) ──
    this.container = new PIXI.Container();
    this.container.isRenderGroup = true;

    this.trailGfx = new PIXI.Graphics();
    this.accretionGfx = new PIXI.Graphics();
    this.bodyGfx = new PIXI.Graphics();
    this.mouthGfx = new PIXI.Graphics();
    this.particleGfx = new PIXI.Graphics();
    this.ringVfxGfx = new PIXI.Graphics();
    this.flashGfx = new PIXI.Graphics();
    this.ghostStreakGfx = new PIXI.Graphics();

    this.trailGfx.blendMode = "add";
    this.accretionGfx.blendMode = "add";
    this.bodyGfx.blendMode = "normal";
    this.mouthGfx.blendMode = "add";
    this.particleGfx.blendMode = "add";
    this.ringVfxGfx.blendMode = "add";
    this.flashGfx.blendMode = "add";
    this.ghostStreakGfx.blendMode = "add";

    this.container.addChild(this.trailGfx);
    this.container.addChild(this.accretionGfx);
    this.container.addChild(this.bodyGfx);
    this.container.addChild(this.mouthGfx);
    this.container.addChild(this.particleGfx);
    this.container.addChild(this.ringVfxGfx);
    this.container.addChild(this.ghostStreakGfx);
    this.container.addChild(this.flashGfx);

    // ── Pre-allocate pools ────────────────
    for (let i = 0; i < 250; i++) {
      this.particles.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 0,
        active: false,
      });
    }
    for (let i = 0; i < 12; i++) {
      this.ringVfx.push({
        x: 0, y: 0, radius: 0, maxRadius: 0,
        life: 0, maxLife: 1, type: "DOT_SWALLOW", rotation: 0,
      });
    }
  }

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════

  public spawn(): void {
    const map = this.gameState.levelData.map;
    for (let y = 0; y < map.length; y++) {
      const x = map[y].findIndex((t: string) => t === "PM");
      if (x !== -1) {
        this.x = x * this.tileSize + this.tileSize / 2;
        this.y = y * this.tileSize + this.tileSize / 2;
        this.container.position.set(this.x, this.y);
        this.lastTeleportExit = null;
        return;
      }
    }
  }

  public update(dt: number): void {
    this.time += dt;

    if (this.state === "DYING") {
      this.updateDeath(dt);
      this.updateParticles(dt);
      this.updateRingVfx(dt);
      this.draw();
      return;
    }

    if (this.gameState.mode !== "PLAYING") return;

    // ── Decay all systems ─────────────────
    this.updateTrail(dt);
    this.updateParticles(dt);
    this.updateRingVfx(dt);
    this.updateGhostStreak(dt);
    if (this.eatFlashTimer > 0) this.eatFlashTimer -= dt;

    this.speed = this.isBuffed ? this.buffedSpeed : this.normalSpeed;

    // ── Emission ──────────────────────────
    if (this.direction.dx !== 0 || this.direction.dy !== 0) {
      this.trail.push({ x: this.x, y: this.y, life: this.isBuffed ? 0.55 : 0.38, maxLife: this.isBuffed ? 0.55 : 0.38 });
      this.emitHawkingParticles();
    }

    // ── Movement ──────────────────────────
    const px = this.x, py = this.y;
    this.updateMovement(dt);
    this.teleport();
    this.container.position.set(this.x, this.y);

    // Teleport detected
    if (Math.abs(this.x - px) > this.tileSize * 2 || Math.abs(this.y - py) > this.tileSize * 2) {
      this.trail.length = 0;
      this.spawnWormholeVFX(px, py, false); // Exit
      this.spawnWormholeVFX(this.x, this.y, true); // Entry
    }

    // ── Ghost collision ───────────────────
    const ghost = this.getCollidedGhost();
    if (ghost) {
      if (this.isBuffed && ghost.state === "FRIGHTENED") {
        this.beginGhostAbsorption(ghost);
        eventBus.emit("ghost:eaten", { ghostName: ghost.name, points: 0, ghostIndex: 0 });
      } else if (!this.isBuffed && ghost.state !== "FRIGHTENED" && ghost.state !== "EATEN") {
        this.triggerDeath();
      }
    }

    this.tryEatTile();
    this.draw();
  }

  public changeDirection(d: { dx: number; dy: number }): void {
    this.nextDirection = d;
  }

  public triggerDeath(): void {
    if (this.state === "DYING") return;
    this.state = "DYING";
    this.speed = 0;
    this.deathTimer = 0;
    this.deathParticleTimer = 0;
    this.deathShrinkFactor = 0;
    this.deathConvulsePhase = 0;
    eventBus.emit("pacman:death");
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  // ══════════════════════════════════════════
  // MOVEMENT
  // ══════════════════════════════════════════

  private updateMovement(dt: number): void {
    if (this.direction.dx === 0 && this.direction.dy === 0 && this.nextDirection) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
    }
    if (this.nextDirection) this.tryTurn();
    if (this.willHitWall(dt, this.direction)) {
      this.snapToTileCenter();
      return;
    }
    const n = this.getNextPosition(dt);
    this.x = n.newX;
    this.y = n.newY;
    if (this.direction.dx !== 0 || this.direction.dy !== 0) {
      this.lastDirection = { ...this.direction };
    }
    this.smoothAlign(dt);
  }

  private tryTurn(): void {
    if (!this.nextDirection) return;
    const { centerX, centerY } = this.gridContext.getTileCenter(this.x, this.y);
    const { tileX, tileY } = this.gridContext.getTile(this.x, this.y);

    if (this.nextDirection.dx === -this.direction.dx && this.nextDirection.dy === -this.direction.dy) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
      return;
    }

    const tx = tileX + this.nextDirection.dx;
    const ty = tileY + this.nextDirection.dy;
    if (this.gridContext.isWall(tx, ty)) return;

    if (Math.hypot(this.x - centerX, this.y - centerY) < this.tileSize * this.config.turnThreshold) {
      if (this.nextDirection.dx !== 0) this.y = centerY;
      if (this.nextDirection.dy !== 0) this.x = centerX;
      this.direction = this.nextDirection;
      this.nextDirection = null;
    }
  }

  private smoothAlign(dt: number): void {
    const { centerX, centerY } = this.gridContext.getTileCenter(this.x, this.y);
    const f = 1 - Math.exp(-this.config.axisAlignSpeed * dt);
    if (this.direction.dx !== 0) this.y += (centerY - this.y) * f;
    if (this.direction.dy !== 0) this.x += (centerX - this.x) * f;
  }

  private getCollidedGhost(): Ghost | null {
    for (const g of this.levelContext.ghosts) {
      if (Math.hypot(this.x - g.x, this.y - g.y) < this.r + g.r) return g;
    }
    return null;
  }

  private tryEatTile(): void {
    const { tileX, tileY } = this.gridContext.getTile(this.x, this.y);
    if (this.gameState.activeDots.has(`${tileY},${tileX}`)) {
      this.spawnDotSwallowVFX(
        tileX * this.tileSize + this.tileSize / 2,
        tileY * this.tileSize + this.tileSize / 2,
      );
      this.eatFlashTimer = 0.1;
      this.eatFlashType = "DOT";
      eventBus.emit("dot:collect", { position: { i: tileY, j: tileX } });
    }
    if (this.gameState.activePills.has(`${tileY},${tileX}`)) {
      this.spawnPillExpandVFX();
      this.eatFlashTimer = 0.45;
      this.eatFlashType = "PILL";
      eventBus.emit("power_pill:collect", { position: { i: tileY, j: tileX } });
    }
  }

  // ══════════════════════════════════════════
  // VFX SPAWNERS
  // ══════════════════════════════════════════

  private spawnRingVFX(x: number, y: number, maxR: number, life: number, type: RingVFX["type"], rot: number = 0): void {
    for (const r of this.ringVfx) {
      if (r.life <= 0) {
        r.x = x;
        r.y = y;
        r.radius = type === "PILL_EXPAND" || type === "WORMHOLE_ENTRY" ? 0 : maxR;
        r.maxRadius = maxR;
        r.life = life;
        r.maxLife = life;
        r.type = type;
        r.rotation = rot;
        return;
      }
    }
  }

  private spawnDotSwallowVFX(wx: number, wy: number): void {
    this.spawnRingVFX(wx, wy, 7, 0.18, "DOT_SWALLOW");
  }

  private spawnPillExpandVFX(): void {
    this.spawnRingVFX(this.x, this.y, this.r * 3.5, 0.45, "PILL_EXPAND");
  }

  private spawnWormholeVFX(wx: number, wy: number, isEntry: boolean): void {
    const type = isEntry ? "WORMHOLE_ENTRY" : "WORMHOLE_EXIT";
    const life = isEntry ? 0.35 : 0.25;
    const rot = Math.random() * Math.PI;
    this.spawnRingVFX(wx, wy, this.r * 1.6, life, type, rot);
  }

  private spawnParticle(overrides: Partial<Particle>): void {
    for (const p of this.particles) {
      if (!p.active) {
        Object.assign(p, {
          x: 0, y: 0, vx: 0, vy: 0,
          life: 1, maxLife: 1, size: 1.5,
        }, overrides, { active: true });
        return;
      }
    }
  }

  private emitHawkingParticles(): void {
    const rate = this.isBuffed ? 0.7 : 0.25;
    if (Math.random() < rate) {
      const rimAngle = Math.random() * Math.PI * 2;
      const dist = this.r * (0.85 + Math.random() * 0.3);
      this.spawnParticle({
        x: this.x + Math.cos(rimAngle) * dist,
        y: this.y + Math.sin(rimAngle) * dist,
        vx: Math.cos(rimAngle) * (50 + Math.random() * 140),
        vy: Math.sin(rimAngle) * (50 + Math.random() * 140),
        life: 0.3 + Math.random() * 0.6,
        maxLife: 0.9,
        size: 0.5 + Math.random() * 2.2,
      });
    }
  }

  private emitDeathParticles(): void {
    const count = 2 + Math.floor(this.deathShrinkFactor * 4);
    for (let i = 0; i < count; i++) {
      // Polar jets along last direction axis
      const jetAxis = this.getAngle();
      const isJet = Math.random() < 0.5;
      const angle = isJet
        ? jetAxis + (Math.random() - 0.5) * 0.6 + (Math.random() < 0.5 ? 0 : Math.PI)
        : Math.random() * Math.PI * 2;
      const speed = isJet ? 180 + Math.random() * 250 : 60 + Math.random() * 120;
      this.spawnParticle({
        x: this.x + Math.cos(angle) * this.r * 0.3,
        y: this.y + Math.sin(angle) * this.r * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.7,
        maxLife: 1.1,
        size: 0.4 + Math.random() * 2.5,
      });
    }
  }

  // ══════════════════════════════════════════
  // GHOST ABSORPTION
  // ══════════════════════════════════════════

  private beginGhostAbsorption(ghost: Ghost): void {
    this.ghostStreakTimer = 0.45;
    this.ghostStreakStartX = ghost.x;
    this.ghostStreakStartY = ghost.y;
    this.ghostTerminalFlash = 0;
    this.eatFlashTimer = 0.4;
    this.eatFlashType = "GHOST";
  }

  private updateGhostStreak(dt: number): void {
    if (this.ghostStreakTimer > 0) {
      this.ghostStreakTimer -= dt;
      // Terminal flash when streak reaches center
      if (this.ghostStreakTimer <= 0.1 && this.ghostTerminalFlash === 0) {
        this.ghostTerminalFlash = 0.15;
      }
    }
    if (this.ghostTerminalFlash > 0) {
      this.ghostTerminalFlash -= dt;
    }
  }

  // ══════════════════════════════════════════
  // UPDATE SYSTEMS
  // ══════════════════════════════════════════

  private updateTrail(dt: number): void {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.93;
      p.vy *= 0.93;
    }
  }

  private updateRingVfx(dt: number): void {
    for (const r of this.ringVfx) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const progress = 1 - r.life / r.maxLife;
      if (r.type === "DOT_SWALLOW") {
        r.radius = r.maxRadius * (1 - progress);
      } else if (r.type === "PILL_EXPAND" || r.type === "WORMHOLE_ENTRY") {
        r.radius = r.maxRadius * progress;
      }
      // WORMHOLE_EXIT: stays at max and fades
    }
  }

  private updateDeath(dt: number): void {
    this.deathTimer += dt;
    this.deathShrinkFactor = Math.min(1, Math.max(0, (this.deathTimer - 0.3) / 1.5));

    // Convulsion phase (0-0.3s)
    if (this.deathTimer < 0.3) {
      this.deathConvulsePhase += dt * 50; // 8Hz
    }

    // Particle emission during evaporation (0.3-1.8s)
    if (this.deathTimer >= 0.3 && this.deathTimer < 1.8) {
      this.deathParticleTimer += dt;
      const interval = 0.06 - this.deathShrinkFactor * 0.04; // Gets faster
      while (this.deathParticleTimer > interval) {
        this.deathParticleTimer -= interval;
        this.emitDeathParticles();
      }
    }
  }

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════

  private get isBuffed(): boolean {
    return this.gameState.isBuffed;
  }

  private getAngle(): number {
    const d = (this.direction.dx !== 0 || this.direction.dy !== 0)
      ? this.direction
      : this.lastDirection;
    return Math.atan2(d.dy, d.dx);
  }

  // ── FIX 1: Buffed no longer bloats the body size ──
  // Buffed state is communicated through the accretion disk, brighter photon ring,
  // and brighter mouth — NOT through making the body bigger which creates visual clutter.
  private getDisplayRadius(): number {
    if (this.state === "DYING" && this.deathTimer < 0.3) {
      const convulse = 1 + Math.sin(this.deathConvulsePhase) * 0.12;
      return this.r * convulse;
    }
    if (this.state === "DYING") {
      return this.r * (1 - this.deathShrinkFactor * 0.88);
    }
    // Same size regardless of buffed state
    return this.r;
  }

  // ══════════════════════════════════════════
  // DRAW
  // ══════════════════════════════════════════

  public draw(): void {
    this.trailGfx.clear();
    this.accretionGfx.clear();
    this.bodyGfx.clear();
    this.mouthGfx.clear();
    this.particleGfx.clear();
    this.ringVfxGfx.clear();
    this.flashGfx.clear();
    this.ghostStreakGfx.clear();

    const r = this.getDisplayRadius();
    if (r <= 0.3) return;

    if (this.state === "DYING") {
      this.drawDeathBody(r);
      this.drawParticles();
      this.drawRingVfx();
      return;
    }

    this.drawTrail();
    if (this.isBuffed) this.drawAccretionDisk(r);
    this.drawBody(r);
    this.drawMouthGlow(r);
    this.drawParticles();
    this.drawRingVfx();
    this.drawGhostStreak();
    this.drawEatFlash(r);
  }

  // ── TRAIL ──────────────────────────────────

  private drawTrail(): void {
    if (this.trail.length < 2) return;

    const baseWidth = this.r * (this.isBuffed ? 0.55 : 0.35);

    for (let i = 1; i < this.trail.length; i++) {
      const p1 = this.trail[i - 1];
      const p2 = this.trail[i];
      const ratio = p2.life / p2.maxLife;
      if (ratio <= 0.01) continue;

      const x1 = p1.x - this.x;
      const y1 = p1.y - this.y;
      const x2 = p2.x - this.x;
      const y2 = p2.y - this.y;

      const width = baseWidth * ratio;

      // Soft outer glow
      this.trailGfx.moveTo(x1, y1);
      this.trailGfx.lineTo(x2, y2);
      this.trailGfx.stroke({
        color: CHERENKOV_BASE,
        width: width * 3.5,
        alpha: ratio * (this.isBuffed ? 0.2 : 0.12),
        cap: "round",
        join: "round",
      });

      // Core line
      this.trailGfx.moveTo(x1, y1);
      this.trailGfx.lineTo(x2, y2);
      this.trailGfx.stroke({
        color: this.isBuffed ? FLARE_WHITE : CHERENKOV_GLOW,
        width: width * (this.isBuffed ? 1.0 : 0.55),
        alpha: ratio * (this.isBuffed ? 0.65 : 0.5),
        cap: "round",
        join: "round",
      });
    }
  }

  // ── ACCRETION DISK (buffed only) ──────────
  // ── FIX 1: Cleaner disk — single swept ring instead of 8 concentric strokes ──

  private drawAccretionDisk(r: number): void {
    // Single thin, bright ring at the photon sphere radius — much cleaner
    const diskR = r * 1.2;
    this.accretionGfx.circle(0, 0, diskR);
    this.accretionGfx.stroke({
      color: ACCRETION_DISK,
      width: 2.5,
      alpha: 0.35,
    });

    // Faint outer whisper
    this.accretionGfx.circle(0, 0, diskR + 3);
    this.accretionGfx.stroke({
      color: PHOTON_BUFFED,
      width: 1,
      alpha: 0.15,
    });
  }

  // ── BODY ───────────────────────────────────
  // ── FIX 2: Increased visibility in normal state — lighter void fill, thicker photon ring ──

  private drawBody(r: number): void {
    const t = this.time * 1000;
    const moving = this.direction.dx !== 0 || this.direction.dy !== 0;
    const angle = this.getAngle();

    // Mouth
    let mouth: number;
    if (moving) {
      const speedMult = this.isBuffed ? 1.35 : 1;
      mouth = Math.abs(Math.sin(t * this.config.mouthSpeed * speedMult)) * this.config.maxMouthAngle;
    } else {
      mouth = this.config.idleMouthAngle;
    }
    mouth = Math.max(0.06, Math.min(mouth, Math.PI * 0.5));
    if (this.isBuffed) mouth = Math.min(mouth * 1.15, Math.PI * 0.52);

    const sa = angle + mouth;
    const ea = angle + Math.PI * 2 - mouth;

    // ── 1. Void fill with subtle radial gradient ──
    // Lighter than before — base alpha raised so it doesn't disappear on dark backgrounds
    const gradSteps = 6;
    for (let i = gradSteps; i >= 0; i--) {
      const frac = i / gradSteps;
      const gradR = r * frac;
      if (gradR < 0.3) continue;
      const cr = ((VOID_CORE >> 16) & 0xff) + ((VOID_EDGE >> 16 & 0xff) - (VOID_CORE >> 16 & 0xff)) * frac;
      const cg = ((VOID_CORE >> 8) & 0xff) + ((VOID_EDGE >> 8 & 0xff) - (VOID_CORE >> 8 & 0xff)) * frac;
      const cb = (VOID_CORE & 0xff) + ((VOID_EDGE & 0xff) - (VOID_CORE & 0xff)) * frac;
      const color = (Math.round(cr) << 16) | (Math.round(cg) << 8) | Math.round(cb);

      this.bodyGfx.moveTo(0, 0);
      this.bodyGfx.arc(0, 0, gradR, sa, ea, false);
      this.bodyGfx.lineTo(0, 0);
      this.bodyGfx.closePath();
      // Raised base alpha from 0.5→0.7 so the body is visible against dark tiles
      this.bodyGfx.fill({ color, alpha: 0.7 + frac * 0.3 });
    }

    // ── 2. Photon ring: outer soft glow ──
    this.bodyGfx.moveTo(0, 0);
    this.bodyGfx.arc(0, 0, r, sa, ea, false);
    this.bodyGfx.lineTo(0, 0);
    this.bodyGfx.closePath();
    this.bodyGfx.stroke({
      color: this.isBuffed ? PHOTON_BUFFED : PHOTON_OUTER,
      // Thicker in both states for visibility
      width: this.isBuffed ? 7 : 5,
      alpha: this.isBuffed ? 0.45 : 0.4,
      alignment: 0.5,
    });

    // ── 3. Photon ring: inner sharp ring with Doppler shift ──
    this.drawDopplerRing(r, sa, ea, angle);
  }

  // ── FIX 2: Thicker Doppler ring for readability ──

  private drawDopplerRing(r: number, sa: number, ea: number, angle: number): void {
    const segments = 48;
    for (let i = 0; i < segments; i++) {
      const a1 = sa + ((ea - sa) / segments) * i;
      const a2 = sa + ((ea - sa) / segments) * (i + 1);

      const midAngle = (a1 + a2) / 2;
      const doppler = 0.5 + 0.5 * Math.cos(midAngle - angle);
      const brightness = 0.5 + doppler * 0.5;

      const cr = Math.round(100 + doppler * 155);
      const cg = Math.round(60 + doppler * 95);
      const cb = Math.round(180 + doppler * 75);
      const color = (cr << 16) | (cg << 8) | cb;

      this.bodyGfx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
      this.bodyGfx.arc(0, 0, r, a1, a2, false);
      this.bodyGfx.stroke({
        color,
        // Thicker in normal state, slightly thinner in buffed (disk carries the weight)
        width: this.isBuffed ? 2.5 : 2.2,
        alpha: brightness * (this.isBuffed ? 0.95 : 0.85),
        cap: "butt",
      });
    }
  }

  // ── MOUTH INTERIOR GLOW ────────────────────
  // ── FIX 2: Brighter mouth glow so the opening reads clearly ──

  private drawMouthGlow(r: number): void {
    const moving = this.direction.dx !== 0 || this.direction.dy !== 0;
    const t = this.time * 1000;
    const angle = this.getAngle();

    let mouth: number;
    if (moving) {
      const speedMult = this.isBuffed ? 1.35 : 1;
      mouth = Math.abs(Math.sin(t * this.config.mouthSpeed * speedMult)) * this.config.maxMouthAngle;
    } else {
      mouth = this.config.idleMouthAngle;
    }
    mouth = Math.max(0.06, Math.min(mouth, Math.PI * 0.5));
    if (this.isBuffed) mouth = Math.min(mouth * 1.15, Math.PI * 0.52);

    const sa = angle + mouth;
    const ea = angle + Math.PI * 2 - mouth;
    const mouthSize = Math.PI * 2 - (ea - sa);

    if (mouthSize < 0.05) return;

    const glowR = r * 0.85;
    // Raised alpha floor for visibility
    const alpha = Math.min(1, mouthSize / 0.6) * (this.isBuffed ? 0.35 : 0.22);

    this.mouthGfx.moveTo(0, 0);
    this.mouthGfx.arc(0, 0, glowR, sa, ea, false);
    this.mouthGfx.lineTo(0, 0);
    this.mouthGfx.closePath();
    this.mouthGfx.fill({ color: this.isBuffed ? MOUTH_BUFFED : MOUTH_GLOW, alpha });

    // Einstein ring inside mouth — thin arc of brighter light
    const ringR = r * 0.48;
    const ringSpan = Math.PI * 0.55;
    const mouthCenter = sa + (ea - sa) / 2;
    const ra1 = mouthCenter - ringSpan / 2;
    const ra2 = mouthCenter + ringSpan / 2;

    this.mouthGfx.moveTo(Math.cos(ra1) * ringR, Math.sin(ra1) * ringR);
    this.mouthGfx.arc(0, 0, ringR, ra1, ra2, false);
    this.mouthGfx.stroke({
      color: this.isBuffed ? FLARE_WHITE : CHERENKOV_GLOW,
      width: this.isBuffed ? 1.2 : 0.9,
      alpha: alpha * 1.6,
      cap: "round",
    });

    // Central singularity point
    if (mouthSize > 0.2) {
      const pointAlpha = alpha * 1.2;
      this.mouthGfx.circle(0, 0, r * 0.05);
      this.mouthGfx.fill({ color: FLARE_WHITE, alpha: pointAlpha });
    }
  }

  // ── PARTICLES ──────────────────────────────

  private drawParticles(): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      if (alpha <= 0.01) continue;

      const rx = p.x - this.x;
      const ry = p.y - this.y;

      // Glow
      this.particleGfx.circle(rx, ry, p.size * 2.2 * alpha);
      this.particleGfx.fill({ color: CHERENKOV_BASE, alpha: alpha * 0.18 });

      // Core
      this.particleGfx.circle(rx, ry, p.size * 0.45 * alpha);
      this.particleGfx.fill({ color: CHERENKOV_GLOW, alpha: alpha * 0.7 });
    }
  }

  // ── RING VFX ───────────────────────────────
  // ── FIX 3: Wormhole VFX rebuilt — thick, dramatic spiral collapse instead of thin cross ──

  private drawRingVfx(): void {
    for (const r of this.ringVfx) {
      if (r.life <= 0) continue;
      const alpha = Math.max(0, r.life / r.maxLife);

      const rx = r.x - this.x;
      const ry = r.y - this.y;

      if (r.type === "DOT_SWALLOW") {
        if (r.radius > 0.5) {
          this.ringVfxGfx.circle(rx, ry, r.radius);
          this.ringVfxGfx.stroke({
            color: CHERENKOV_GLOW,
            width: 1.5 * alpha,
            alpha: alpha * 0.8,
          });
          this.ringVfxGfx.circle(rx, ry, r.radius * 0.6);
          this.ringVfxGfx.stroke({
            color: FLARE_WHITE,
            width: 0.8 * alpha,
            alpha: alpha * 0.6,
          });
        }
      } else if (r.type === "PILL_EXPAND") {
        this.ringVfxGfx.circle(rx, ry, r.radius);
        this.ringVfxGfx.stroke({
          color: FLARE_WHITE,
          width: 3 * alpha,
          alpha: alpha * 0.7,
        });
        this.ringVfxGfx.circle(rx, ry, r.radius * 0.85);
        this.ringVfxGfx.stroke({
          color: PHOTON_OUTER,
          width: 5 * alpha,
          alpha: alpha * 0.3,
        });
        this.ringVfxGfx.circle(rx, ry, r.radius * 0.3);
        this.ringVfxGfx.stroke({
          color: FLARE_WHITE,
          width: 1.5 * alpha,
          alpha: alpha * 0.5,
        });
      } else if (r.type === "WORMHOLE_EXIT" || r.type === "WORMHOLE_ENTRY") {
        // ── FIX 3: Dramatic wormhole ──
        // Instead of a thin cross of ellipses, draw a bright collapsing/expanding
        // ring with radial streaks that twist — reads as a proper portal tear.

        const isEntry = r.type === "WORMHOLE_ENTRY";
        const progress = 1 - alpha; // 0→1 for entry (growing), 1→0 for exit (fading)
        const ringR = isEntry ? r.radius : r.maxRadius;

        // Thick outer ring
        this.ringVfxGfx.circle(rx, ry, ringR);
        this.ringVfxGfx.stroke({
          color: isEntry ? PHOTON_BUFFED : CHERENKOV_GLOW,
          width: 4 * alpha,
          alpha: alpha * 0.7,
        });

        // Bright inner ring
        this.ringVfxGfx.circle(rx, ry, ringR * 0.65);
        this.ringVfxGfx.stroke({
          color: FLARE_WHITE,
          width: 2.5 * alpha,
          alpha: alpha * 0.8,
        });

        // Radial streaks from center — like light being pulled through
        const streakCount = 12;
        const twist = isEntry ? progress * Math.PI * 1.5 : (1 - progress) * Math.PI * 1.5;
        for (let s = 0; s < streakCount; s++) {
          const baseAngle = (s / streakCount) * Math.PI * 2 + r.rotation;
          const innerAngle = baseAngle + twist;
          const outerAngle = baseAngle - twist * 0.5;
          const innerDist = ringR * 0.15 * alpha;
          const outerDist = ringR * (0.9 + alpha * 0.1);

          this.ringVfxGfx.moveTo(
            rx + Math.cos(innerAngle) * innerDist,
            ry + Math.sin(innerAngle) * innerDist,
          );
          this.ringVfxGfx.lineTo(
            rx + Math.cos(outerAngle) * outerDist,
            ry + Math.sin(outerAngle) * outerDist,
          );
          this.ringVfxGfx.stroke({
            color: s % 3 === 0 ? FLARE_WHITE : CHERENKOV_GLOW,
            width: (s % 3 === 0 ? 1.8 : 0.8) * alpha,
            alpha: alpha * 0.5,
          });
        }

        // Entry gets an extra bright core flash at the end
        if (isEntry && progress > 0.7) {
          const coreAlpha = (progress - 0.7) / 0.3;
          this.ringVfxGfx.circle(rx, ry, ringR * 0.2 * coreAlpha);
          this.ringVfxGfx.fill({ color: FLARE_WHITE, alpha: coreAlpha * 0.9 });
        }
      }
    }
  }

  // ── GHOST STREAK ───────────────────────────

  private drawGhostStreak(): void {
    if (this.ghostStreakTimer <= 0 && this.ghostTerminalFlash <= 0) return;

    if (this.ghostStreakTimer > 0) {
      const progress = 1 - this.ghostStreakTimer / 0.45;
      const startX = this.ghostStreakStartX - this.x;
      const startY = this.ghostStreakStartY - this.y;
      const t = Math.min(1, progress * 2.5);
      const cx = startX + (0 - startX) * t;
      const cy = startY + (0 - startY) * t;
      const alpha = 1 - progress;

      this.ghostStreakGfx.moveTo(startX, startY);
      this.ghostStreakGfx.lineTo(cx, cy);
      this.ghostStreakGfx.stroke({
        color: GHOST_STREAK,
        width: 3.5 * alpha,
        alpha: alpha * 0.3,
        cap: "round",
      });

      this.ghostStreakGfx.moveTo(startX, startY);
      this.ghostStreakGfx.lineTo(cx, cy);
      this.ghostStreakGfx.stroke({
        color: FLARE_WHITE,
        width: 1.2 * alpha,
        alpha: alpha * 0.7,
        cap: "round",
      });
    }

    if (this.ghostTerminalFlash > 0) {
      const flashAlpha = this.ghostTerminalFlash / 0.15;
      const flashR = this.r * (0.5 + flashAlpha * 1.5);
      this.ghostStreakGfx.circle(0, 0, flashR);
      this.ghostStreakGfx.fill({ color: FLARE_WHITE, alpha: flashAlpha * 0.6 });
      this.ghostStreakGfx.circle(0, 0, flashR * 1.6);
      this.ghostStreakGfx.fill({ color: GHOST_STREAK, alpha: flashAlpha * 0.2 });
    }
  }

  // ── EAT FLASH ──────────────────────────────

  private drawEatFlash(r: number): void {
    if (this.eatFlashTimer <= 0) return;

    const maxTime = this.eatFlashType === "DOT" ? 0.1
      : this.eatFlashType === "PILL" ? 0.45
      : 0.4;
    const alpha = this.eatFlashTimer / maxTime;

    if (this.eatFlashType === "GHOST") {
      this.flashGfx.circle(0, 0, r);
      this.flashGfx.stroke({
        color: FLARE_WHITE,
        width: 3.5 * alpha,
        alpha: alpha * 0.65,
      });
      this.flashGfx.circle(0, 0, r + 8);
      this.flashGfx.stroke({
        color: GHOST_STREAK,
        width: 6 * alpha,
        alpha: alpha * 0.25,
      });
    } else if (this.eatFlashType === "PILL") {
      this.flashGfx.circle(0, 0, r);
      this.flashGfx.stroke({
        color: FLARE_WHITE,
        width: 2.5 * alpha,
        alpha: alpha * 0.8,
      });
    }
    if (this.eatFlashType === "DOT") {
      this.flashGfx.circle(0, 0, r * 0.25);
      this.flashGfx.fill({ color: FLARE_WHITE, alpha: alpha * 0.2 });
    }
  }

  // ── DEATH BODY ─────────────────────────────

  private drawDeathBody(r: number): void {
    const alpha = this.deathTimer < 1.8 ? 1 : Math.max(0, 1 - (this.deathTimer - 1.8) / 0.2);
    if (alpha <= 0) return;

    this.bodyGfx.circle(0, 0, r);
    this.bodyGfx.fill({ color: VOID_CORE, alpha });

    const shrink = this.deathShrinkFactor;
    const rimBrightness = 0.5 + shrink * 0.5;
    const rimWidth = 1.5 + shrink * 1.5;

    if (this.deathTimer < 0.3) {
      const flicker = 0.5 + 0.5 * Math.sin(this.deathConvulsePhase);
      const color = flicker > 0.7 ? FLARE_WHITE : PHOTON_INNER;
      this.bodyGfx.circle(0, 0, r);
      this.bodyGfx.stroke({
        color,
        width: 2 + flicker * 3,
        alpha: (0.5 + flicker * 0.5) * alpha,
      });
    } else {
      const color = shrink > 0.7 ? FLARE_WHITE : PHOTON_BUFFED;
      this.bodyGfx.circle(0, 0, r);
      this.bodyGfx.stroke({
        color,
        width: rimWidth,
        alpha: rimBrightness * alpha,
      });

      const haloR = r * (1.2 + shrink * 2.5);
      this.bodyGfx.circle(0, 0, haloR);
      this.bodyGfx.stroke({
        color: PHOTON_OUTER,
        width: 1,
        alpha: shrink * alpha * 0.3,
      });
    }

    if (this.deathTimer >= 1.5 && this.deathTimer < 1.8) {
      const popProgress = (this.deathTimer - 1.5) / 0.3;
      this.flashGfx.circle(0, 0, this.r * 0.2 * (1 + popProgress * 3));
      this.flashGfx.fill({ color: FLARE_WHITE, alpha: (1 - popProgress) * 0.8 });
    }

    if (this.deathTimer >= 1.8 && this.deathTimer < 1.95) {
      const flashAlpha = Math.max(0, 1 - (this.deathTimer - 1.8) / 0.15);
      this.flashGfx.circle(0, 0, this.r * 2 * (2 - flashAlpha));
      this.flashGfx.fill({ color: FLARE_WHITE, alpha: flashAlpha * 0.5 });
    }
  }
}