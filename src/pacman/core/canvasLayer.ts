// src/core/CanvasLayer.ts
import { setCanvasSize } from "../utils.js";
import { LEVEL_1_MAP } from "../config/maps.js";
import { GameState } from "../game/gameState.svelte.js";
import { CFG_CANVAS } from "../config/canvas.js";

/**
 * Управляет HTML Canvas элементом и его 2D контекстом.
 * Предоставляет методы очистки и изменения размера холста.
 * Используется всеми классами, которым нужна отрисовка.
 */
export class CanvasLayer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _id: string;

  /**
   * @param layerId - HTML id атрибут canvas элемента
   */
  constructor(layerId: string) {
    this._id = layerId;

    const canvas = document.getElementById(layerId) as HTMLCanvasElement | null;
    if (!canvas) {
      throw new Error(`Canvas with id "${layerId}" not found in DOM.`);
    }
    this._canvas = canvas;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(`Failed to get 2D context for canvas "${layerId}".`);
    }
    this._ctx = context;

    this.resize();
  }

  /** HTML Canvas элемент */
  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  /** 2D контекст рендеринга */
  get ctx(): CanvasRenderingContext2D {
    return this._ctx;
  }

  /** HTML id холста */
  get id(): string {
    return this._id;
  }

  /**
   * Очищает всю или часть области холста.
   * @param x - начальная X координата (по умолчанию 0)
   * @param y - начальная Y координата (по умолчанию 0)
   * @param width - ширина очищаемой области (по умолчанию вся ширина)
   * @param height - высота очищаемой области (по умолчанию вся высота)
   */
  clear(
    x: number = 0,
    y: number = 0,
    width: number = this._canvas.width,
    height: number = this._canvas.height,
  ): void {
    this._ctx.clearRect(x, y, width, height);
  }

  /**
   * Подстраивает размер холста под текущую карту уровня.
   * Вызывается при смене уровня или ресайзе окна.
   */
  resize(): void {
    const gameState = GameState.getInstance();
    const currentMap = gameState.levelData?.map || LEVEL_1_MAP;

    setCanvasSize(this._canvas, CFG_CANVAS.tile.size, 0, currentMap);
  }
}