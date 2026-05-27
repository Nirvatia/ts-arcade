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
    this.animationCounter += 3 * dt;
  }

  draw(): void {
    this.clearCanvas();
    const ctx = this.ctx;

    const baseRadius = this.tileSize * 0.2;

    this.positions.forEach(({ i, j }) => {
      const cx = this.tileSize * j + this.tileSize / 2;
      const cy = this.tileSize * i + this.tileSize / 2;

      const pulse = 0.5 + 0.5 * Math.sin(this.animationCounter * 3);
      const radius = baseRadius + pulse * 2;

      ctx.save();
      
      // Outer glowing ring - clearly visible
      ctx.shadowColor = "#0aa";
      ctx.shadowBlur = 10 * pulse;
      ctx.strokeStyle = "#0dd";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner diamond - Tron data crystal
      ctx.shadowBlur = 6;
      ctx.fillStyle = "#0cc";
      ctx.globalAlpha = 0.6 + pulse * 0.2;
      const innerSize = radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - innerSize);
      ctx.lineTo(cx + innerSize, cy);
      ctx.lineTo(cx, cy + innerSize);
      ctx.lineTo(cx - innerSize, cy);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    });
  }
}