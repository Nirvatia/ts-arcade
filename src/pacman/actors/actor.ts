// src/core/Actor.ts
import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import { Collision } from "../core/collision.js";
import { GameState } from "../game/gameState.js";
import type { Updatable } from "../interfaces.js";

/**
 * Абстрактный базовый класс для всех движущихся игровых сущностей.
 * Пакман и призраки наследуются от Actor.
 * Предоставляет общий функционал: позицию, направление, скорость, холст.
 */
export abstract class Actor implements Updatable {
  protected gameState: GameState;
  protected canvasLayer: CanvasLayer;

  /** Размер одной плитки в пикселях */
  protected tileSize: number;

  /** Флаг необходимости перерисовки (для статических сущностей) */
  private _needsRedraw: boolean = true;

  /** Позиция X в пикселях (центр сущности) */
  public x: number = 0;

  /** Позиция Y в пикселях (центр сущности) */
  public y: number = 0;

  /** Радиус коллизии / отрисовки */
  public r: number;

  /** Текущее направление движения */
  public direction: { dx: number; dy: number } = { dx: 0, dy: 0 };

  /** Скорость движения в пикселях за кадр */
  protected speed: number;

  /** Последняя точка выхода из телепорта (защита от двойного срабатывания) */
  protected lastTeleportExit: { x: number; y: number } | null = null;

  /**
   * @param layerId - id canvas элемента для этого актора
   */
  constructor(layerId: string) {
    this.gameState = GameState.getInstance();
    this.canvasLayer = new CanvasLayer(layerId);
    this.tileSize = CFG_CANVAS.tile.size;
    this.r = this.tileSize / 2;
    this.speed = this.tileSize / 8;
  }

  /** HTML Canvas элемент */
  get canvas(): HTMLCanvasElement {
    return this.canvasLayer.canvas;
  }

  /** 2D контекст рендеринга для отрисовки */
  get ctx(): CanvasRenderingContext2D {
    return this.canvasLayer.ctx;
  }

  /** Нужна ли перерисовка (для статических объектов) */
  get needsRedraw(): boolean {
    return this._needsRedraw;
  }

  /** Установить флаг перерисовки */
  set needsRedraw(value: boolean) {
    this._needsRedraw = value;
  }

  /** Запросить перерисовку на следующем кадре */
  requestRedraw(): void {
    this._needsRedraw = true;
  }

  /** Очистить весь холст этого актора */
  clearCanvas(): void {
    this.canvasLayer.clear();
  }

  /** Подготовка к новому уровню: очистка и ресайз холста */
  resetForLevel(): void {
    this.clearCanvas();
    this.canvasLayer.resize();
    this._needsRedraw = true;
  }

  /**
   * Проверка и выполнение телепортации при входе на телепорт.
   * Должна вызываться в update() движущихся сущностей.
   */
  protected teleport(): void {
    const { tileX, tileY } = Collision.getTile(this.x, this.y);

    // Защита от повторного входа
    if (this.lastTeleportExit) {
      if (
        tileX === this.lastTeleportExit.x &&
        tileY === this.lastTeleportExit.y
      ) {
        return;
      } else {
        this.lastTeleportExit = null;
      }
    }

    if (Collision.isTeleport(tileX, tileY)) {
      const exit = Collision.getTeleportExit(tileX, tileY);
      if (exit) {
        this.x = exit.x * this.tileSize + this.tileSize / 2;
        this.y = exit.y * this.tileSize + this.tileSize / 2;
        this.lastTeleportExit = exit;
      }
    }
  }

  /** Инициализация актора */
  abstract init(): void;

  /** Сброс состояния */
  abstract reset(): void;

  /** Установка начальной позиции (спавн) */
  abstract spawn(): void;

  /** Обновление логики (движение, коллизии) */
  abstract update(dt: number): void;

  /** Отрисовка актора */
  abstract draw(): void;
}