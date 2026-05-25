// src/world/Pill.ts

import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { eventBus } from "../core/eventBus.js";
import { GameState } from "../game/gameState.js";
import type { Collectible, Updatable } from "../interfaces.js";

/**
 * Управляет энерджайзерами (power pellets) на карте.
 * Динамический объект — анимируется пульсацией каждый кадр.
 */
export class Pill implements Updatable, Collectible {
  private gameState: GameState;
  private canvasLayer: CanvasLayer;
  private tileSize: number;
  private pillColor: string;

  private _needsRedraw: boolean = true;
  private animationSpeed: number = 0.05;
  private animationCounter: number = 0;

  /** Позиции энерджайзеров */
  public positions: { i: number; j: number }[] = [];

  constructor() {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(CFG_CANVAS.canvasIds.pills);
    this.tileSize = CFG_CANVAS.tile.size;
    this.pillColor = "#F0F4FF";
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

  // --- Collectible ---

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

      // Emit power_pill:eaten event that GameState listens to
      eventBus.emit("power_pill:eaten", { position: { i, j } });
    }
  }

  // --- Lifecycle ---

  init(): void {
    // Пусто — создаются в spawn()
  }

  reset(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this.positions = [];
    this.animationCounter = 0;
    this._needsRedraw = true;
  }

  // --- Updatable ---

  update(_dt: number): void {
    this.animationCounter += this.animationSpeed;
  }

  draw(): void {
    this.clearCanvas();

    this.positions.forEach(({ i, j }) => {
      const baseSize = this.tileSize / 6;
      const pulseSize =
        Math.sin(this.animationCounter * 3) * (this.tileSize / 15);
      const finalSize = baseSize + pulseSize;

      this.ctx.fillStyle = this.pillColor;
      this.ctx.beginPath();
      this.ctx.arc(
        this.tileSize * j + this.tileSize / 2,
        this.tileSize * i + this.tileSize / 2,
        finalSize,
        0,
        Math.PI * 2,
      );
      this.ctx.fill();
      this.ctx.closePath();
    });
  }
}
