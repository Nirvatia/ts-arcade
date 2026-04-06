import { CANVAS_CONFIG } from "../config/canvas.js";
import { setCanvasSize } from "../utils.js";
import { GameState } from "../game/state.js"; // 🌟 Импортируем стейт
import { LEVEL_1_MAP } from "../config/maps.js";

abstract class Entity {
  layer: string;
  tileSize: number;
  isDynamic: boolean;
  needsRedraw: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor(layer: string, isDynamic: boolean = false) {
    this.layer = layer;
    this.tileSize = CANVAS_CONFIG.tile.size;
    this.isDynamic = isDynamic;
    this.needsRedraw = true;

    const canvas = document.getElementById(this.layer) as HTMLCanvasElement | null;
    if (!canvas) throw new Error(`Canvas ${this.layer} not found.`);
    this.canvas = canvas;

    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Failed to get 2D context.");
    this.ctx = context;

    // 🌟 ТЕПЕРЬ РАЗМЕР ЗАДАЕТСЯ ДИНАМИЧЕСКИ
    this.resizeCanvas();
  }

  // 🌟 НОВЫЙ МЕТОД: подстраивает холст под текущую карту
  public resizeCanvas() {
    const gameState = GameState.getInstance();
    
    // Если игра только запустилась и стейт ещё пустой — страхуемся картой 1
    const currentMap = gameState.levelData?.map || LEVEL_1_MAP;

    setCanvasSize(
      this.canvas,
      CANVAS_CONFIG.tile.size,
      CANVAS_CONFIG.tile.extraHeightFactor,
      currentMap // 🌟 Динамическая карта вместо хардкода!
    );
  }

  clearCanvas(
    x: number = 0,
    y: number = 0,
    width: number = this.canvas.width,
    height: number = this.canvas.height
  ) {
    this.ctx.clearRect(x, y, width, height);
  }

  requestRedraw(): void {
    if (!this.isDynamic) {
      this.needsRedraw = true;
    }
  }

  init(): void {}
  reset(): void {}
  
  // 🌟 Метод очистки и подготовки для нового уровня
  resetForLevel(): void {
    this.clearCanvas();
    this.resizeCanvas(); // Пересчитываем сетку, если уровень другого размера
    this.needsRedraw = true;
  }

  abstract draw(animate: boolean, dt?: number): void;
  abstract update(dt?: number): void;
}

export { Entity };