import { CANVAS_CONFIG } from "../config/canvas.js";
import { Entity } from "../entities/entity.js";
import { GameState } from "../game/state.js";

class Map extends Entity {
  private gameState: GameState;
  private lineWidth: number;
  private lineColor: string;
  public isFlashing: boolean = false;

  constructor() {
    super(CANVAS_CONFIG.canvasIds.map, false);

    this.gameState = GameState.getInstance();
    this.lineWidth = Math.floor((CANVAS_CONFIG.tile.size * 20) / 100);
    this.lineColor = this.gameState.levelData.mapColor;
  }

  // 🌟 ПЕРЕОПРЕДЕЛЯЕМ МЕТОД ДЛЯ НОВОГО УРОВНЯ
  public override resetForLevel() {
    super.resetForLevel(); // Вызовет ресайз и очистку холста из Entity

    // Обновляем цвет лабиринта под новый уровень!
    this.lineColor = this.gameState.levelData.mapColor;
    this.needsRedraw = true;
  }

  public update() {}

  public override init() {
    this.needsRedraw = true;
  }

  public draw(animate: boolean) {
    const map = this.gameState.levelData.map;

    this.lineColor = this.gameState.levelData.mapColor;
    this.ctx.strokeStyle = this.lineColor; // Всегда используем основной цвет
    this.ctx.lineWidth = this.lineWidth;

    this.ctx.save(); // Сохраняем стейт контекста

    // 🌟 БЕЗОПАСНЫЙ ЭФФЕКТ: Если включено мигание, делаем лабиринт полупрозрачным
    if (this.isFlashing) {
      // Вместо белого цвета просто делаем лабиринт пульсирующим по прозрачности
      const time = Date.now() / 150;
      this.ctx.globalAlpha = 0.3 + Math.sin(time) * 0.3; // Прозрачность будет мягко ходить от 0.0 до 0.6
    } else {
      this.ctx.globalAlpha = 1.0;
    }

    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const tile = map[i][j];

        const drawActions: Record<string, (i: number, j: number) => void> = {
          WH: this.drawHorizontalLine,
          WV: this.drawVerticalLine,
          TL: this.drawTopLeftCurve,
          TR: this.drawTopRightCurve,
          BR: this.drawBottomRightCurve,
          BL: this.drawBottomLeftCurve,
        };

        const drawMethod = drawActions[tile];
        if (drawMethod) drawMethod.call(this, i, j);
      }
    }

    this.ctx.restore(); // Возвращаем прозрачность обратно в 1.0
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  private drawCurve(
    x1: number,
    y1: number,
    cx: number,
    cy: number,
    x2: number,
    y2: number,
  ) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.quadraticCurveTo(cx, cy, x2, y2);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  private drawHorizontalLine(i: number, j: number) {
    const x = this.tileSize * j;
    const y = this.tileSize * i + this.tileSize / 2;
    this.drawLine(x, y, x + this.tileSize, y);
  }

  private drawVerticalLine(i: number, j: number) {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i;
    this.drawLine(x, y, x, y + this.tileSize);
  }

  private drawTopRightCurve(i: number, j: number) {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i + this.tileSize;
    this.drawCurve(
      x,
      y,
      x,
      y - this.tileSize / 2,
      x - this.tileSize / 2,
      y - this.tileSize / 2,
    );
  }

  private drawTopLeftCurve(i: number, j: number) {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i + this.tileSize;
    this.drawCurve(
      x,
      y,
      x,
      y - this.tileSize / 2,
      x + this.tileSize / 2,
      y - this.tileSize / 2,
    );
  }

  private drawBottomLeftCurve(i: number, j: number) {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i;
    this.drawCurve(
      x,
      y,
      x,
      y + this.tileSize / 2,
      x + this.tileSize / 2,
      y + this.tileSize / 2,
    );
  }

  private drawBottomRightCurve(i: number, j: number) {
    const x = this.tileSize * j + this.tileSize / 2;
    const y = this.tileSize * i;
    this.drawCurve(
      x,
      y,
      x,
      y + this.tileSize / 2,
      x - this.tileSize / 2,
      y + this.tileSize / 2,
    );
  }
}

export { Map };
