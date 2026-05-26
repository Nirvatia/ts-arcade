// src/world/Pill.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { eventBus } from "../core/eventBus.js";
import { GameState } from "../game/gameState.js";
import type { Collectible, Updatable } from "../interfaces.js";

export class Pill implements Updatable, Collectible {
  private gameState: GameState;
  private canvasLayer: CanvasLayer;
  private tileSize: number;

  private _needsRedraw: boolean = true;
  private animationCounter: number = 0;

  public positions: { i: number; j: number }[] = [];

  constructor() {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.pills);
    this.tileSize = CFG_CANVAS.tile.size;
    this.initEventListeners();
  }

  get canvas(): HTMLCanvasElement {
    return this.canvasLayer.canvas;
  }

  get ctx(): CanvasRenderingContext2D {
    return this.canvasLayer.ctx;
  }

  get needsRedraw(): boolean {
    return this._needsRedraw;
  }

  set needsRedraw(value: boolean) {
    this._needsRedraw = value;
  }

  requestRedraw(): void {
    this._needsRedraw = true;
  }

  clearCanvas(): void {
    this.canvasLayer.clear();
  }

  initEventListeners(): void {
    eventBus.on(
      "power_pill:collect",
      (data: { position: { i: number; j: number } }) => {
        this.collect(data.position.i, data.position.j);
      },
    );
  }

  spawn(): void {
    this.positions = [];
    const map = this.gameState.levelData.map;

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        if (map[i][j] === "PP") {
          this.positions.push({ i, j });
        }
      }
    }
  }

  collect(i: number, j: number): void {
    const index = this.positions.findIndex(
      (pos: { i: number; j: number }) => pos.i === i && pos.j === j,
    );

    if (index !== -1) {
      this.positions.splice(index, 1);
      this.requestRedraw();
      eventBus.emit("power_pill:eaten", { position: { i, j } });
    }
  }

  init(): void {}

  reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this.positions = [];
    this.animationCounter = 0;
    this._needsRedraw = true;
  }

  update(dt: number): void {
    this.animationCounter += 4.5 * dt;
  }

  draw(): void {
    this.clearCanvas();
    const ctx = this.ctx;

    const cyberCyan = "#00f0ff";
    const dotSize = this.tileSize * 0.18;

    this.positions.forEach(({ i, j }) => {
      const cx = this.tileSize * j + this.tileSize / 2;
      const cy = this.tileSize * i + this.tileSize / 2;

      const pulseFactor = Math.sin(this.animationCounter * 1.5) * 0.12 + 1.0;
      const orbitRotation = this.animationCounter * 0.35;
      const r = this.tileSize * 0.24;

      ctx.save();
      ctx.translate(cx, cy);

      // --- Layer 1: Ambient Neon Bloom Backing ---
      ctx.shadowBlur = 12;
      ctx.shadowColor = cyberCyan;
      ctx.fillStyle = "rgba(0, 240, 255, 0.15)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.8 * pulseFactor, 0, Math.PI * 2);
      ctx.fill();

      // --- Layer 2: The Core Crosshair (The Dot design, scaled and pulsed) ---
      ctx.shadowBlur = 4;
      ctx.strokeStyle = cyberCyan;
      ctx.lineWidth = 2;
      const boxSize = dotSize * 1.2 * pulseFactor;
      ctx.strokeRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);

      // --- Layer 3: Tech-Arc Segmented Ring ---
      ctx.shadowBlur = 0;
      ctx.rotate(-orbitRotation);
      ctx.strokeStyle = cyberCyan;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(0, 0, r * 1.25, 0, Math.PI * 0.4);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 1.25, Math.PI, Math.PI * 1.4);
      ctx.stroke();

      // --- Layer 4: High-Intensity Energy Center ---
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-dotSize / 4, -dotSize / 4, dotSize / 2, dotSize / 2);

      ctx.restore();
    });
  }
}
