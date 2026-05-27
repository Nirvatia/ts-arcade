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

    const cyberCyan = "#0ff";
    const baseRadius = this.tileSize * 0.22;

    this.positions.forEach(({ i, j }) => {
      const cx = this.tileSize * j + this.tileSize / 2;
      const cy = this.tileSize * i + this.tileSize / 2;

      const pulse = 0.5 + 0.5 * Math.sin(this.animationCounter * 4);
      const radius = baseRadius + pulse * 3;

      ctx.save();
      
      // Outer pulsing ring
      ctx.shadowColor = cyberCyan;
      ctx.shadowBlur = 16 * pulse;
      ctx.strokeStyle = cyberCyan;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner filled circle
      ctx.shadowBlur = 10;
      ctx.fillStyle = cyberCyan;
      ctx.globalAlpha = 0.5 + pulse * 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Bright center
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }
}