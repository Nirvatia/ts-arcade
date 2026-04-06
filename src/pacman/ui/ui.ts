import { CANVAS_CONFIG } from "../config/canvas.js";
import { Entity } from "../entities/entity.js";
import { GameState } from "../game/state.js";
import { Intermission } from "../game/intermission.js"; // 🌟 ИМПОРТ

class UI extends Entity {
  private gameState: GameState;
  private fontSize: string;
  private fontStyle: string;
  private color: string;
  private intermission: Intermission; // 🌟 ДОБАВИЛИ СВОЙСТВО

  constructor() {
    super(CANVAS_CONFIG.canvasIds.ui, false);

    this.gameState = GameState.getInstance();
    this.fontSize = 30 + "px";
    this.fontStyle = "Jersey-Regular";
    this.color = "rgba(250, 240, 98, 0.85)";

    // 🌟 Создаем инстанс сцены внутри UI
    this.intermission = new Intermission(this.canvas, this.ctx, this.fontStyle);
  }

  // 🌟 ГЕТТЕР ДЛЯ ОСТАЛЬНЫХ ФАЙЛОВ
  public getIntermission(): Intermission {
    return this.intermission;
  }

  public update() {}

  public resetForLevel() {
    this.clearCanvas();
    this.update();
  }

  private getCenterPosition() {
    return {
      x: this.tileSize * 12.5,
      y: this.tileSize * 18,
    };
  }

  public draw(animate: boolean) {
    // 🌟 Если включен режим Интермиссии — мы просто рисуем мультик и выходим!
    if (this.gameState.mode === "INTERMISSION") {
      this.intermission.draw();
      return;
    }

    this.drawWords();
    this.drawScoreCount();
    this.drawLivesCount();
  }

  private drawWords() {
    const scoreCoords = { x: this.tileSize / 2, y: this.tileSize * 32 };
    const livesCoords = { x: this.tileSize * 20, y: this.tileSize * 32 };

    // 🌟 Гарантируем отступ при каждом вызове отрисовки слов
    this.ctx.letterSpacing = "1.5px";

    this.ctx.fillStyle = this.color;
    this.ctx.font = this.fontSize + " " + this.fontStyle;
    this.ctx.fillText("SCORE: ", scoreCoords.x, scoreCoords.y);

    this.ctx.fillStyle = this.color;
    this.ctx.font = this.fontSize + " " + this.fontStyle;
    this.ctx.fillText("LIVES: ", livesCoords.x, livesCoords.y);
  }

  public clearReady(): void {
    this.clearCanvas();
    this.drawWords();
    this.drawScoreCount();
    this.drawLivesCount();
  }

  private drawScoreCount() {
    const coords = {
      x: this.tileSize / 2 + this.tileSize * 4,
      y: this.tileSize * 32,
    };

    this.ctx.fillStyle = this.color;
    this.ctx.font = this.fontSize + " " + this.fontStyle;
    this.ctx.fillText(this.gameState.score.toString(), coords.x, coords.y);
  }

  private drawLivesCount() {
    const coords = {
      cx: this.tileSize * 24,
      cy: this.tileSize * 32 - this.tileSize / 2.5,
      r: this.tileSize / 2.5,
      a1: 0.2 * Math.PI,
      a2: 1.8 * Math.PI,
    };

    for (let i = 0; i < this.gameState.lives; i++) {
      this.ctx.fillStyle = this.color;
      this.ctx.beginPath();
      this.ctx.arc(
        coords.cx + this.tileSize * i,
        coords.cy,
        coords.r,
        coords.a1,
        coords.a2,
      );
      this.ctx.lineTo(coords.cx + this.tileSize * i, coords.cy);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  public drawCounter(n: number): void {
    this.clearCanvas();
    this.drawWords();
    this.drawScoreCount();
    this.drawLivesCount();

    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.font = this.tileSize * 3 + "px " + this.fontStyle;
    const coords = this.getCenterPosition();
    this.ctx.fillText(n.toString(), coords.x + this.tileSize, coords.y);
    this.ctx.closePath();
  }

  public drawReady(): void {
    this.clearCanvas();
    this.drawWords();
    this.drawScoreCount();
    this.drawLivesCount();

    this.ctx.fillStyle = "rgb(255, 255, 0)";
    this.ctx.font = "60px " + this.fontStyle;

    const coords = this.getCenterPosition();
    const text = "READY!";
    const metrics = this.ctx.measureText(text);
    const xOffset = (this.tileSize * 28) / 2 - metrics.width / 2;

    this.ctx.fillText(text, xOffset, coords.y);
  }

  public drawDialog(text: string): void {}
}

export { UI };
