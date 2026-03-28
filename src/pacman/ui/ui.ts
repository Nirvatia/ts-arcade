import { CANVAS_CONFIG } from "../config/canvas.js";
import { Entity } from "../entities/entity.js";
import { GameState } from "../game/state.js";

class UI extends Entity {
  private gameState: GameState;
  private fontSize: string;
  private fontStyle: string;
  private color: string;

  constructor() {
    super(CANVAS_CONFIG.canvasIds.ui, false);

    this.gameState = GameState.getInstance();
    this.fontSize = 30 + "px";
    this.fontStyle = "Jersey-Regular";
    this.color = "rgba(250, 240, 98, 0.85)";
  }

  public update() {}

  public resetForLevel() {
    this.clearCanvas();
    this.update();
  }

  public draw(animate: boolean) {
    this.drawWords();
    this.drawScoreCount();
    this.drawLivesCount();
  }

  private drawWords() {
    const scoreCoords = { x: this.tileSize / 2, y: this.tileSize * 32 };
    const livesCoords = { x: this.tileSize * 20, y: this.tileSize * 32 };

    this.ctx.letterSpacing = "1.5px";
    this.ctx.fillStyle = this.color;
    this.ctx.font = this.fontSize + " " + this.fontStyle;
    this.ctx.fillText("SCORE: ", scoreCoords.x, scoreCoords.y);

    this.ctx.fillStyle = this.color;
    this.ctx.font = this.fontSize + " " + this.fontStyle;
    this.ctx.fillText("LIVES: ", livesCoords.x, livesCoords.y);
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
        coords.a2
      );
      this.ctx.lineTo(coords.cx + this.tileSize * i, coords.cy);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  public drawCounter(n: number): void {
    this.clearCanvas();
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.font = this.tileSize * 3 + "px" + " " + this.fontStyle;
    this.ctx.fillText(n.toString(), this.tileSize * 13.5, this.tileSize * 15);
    this.ctx.closePath();
  }

  public drawDialog(text: string): void {}
}

export { UI };
