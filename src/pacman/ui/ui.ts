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

  private getCenterPosition() {
    return {
      x: this.tileSize * 12.5,
      y: this.tileSize * 18,
    };
  }

  public draw(animate: boolean) {
    this.ctx.save();
    this.ctx.letterSpacing = "1.5px";

    this.drawWords();
    this.drawScoreCount();
    this.drawLivesCount();

    this.ctx.restore();
  }
  private drawWords() {
    const scoreCoords = { x: this.tileSize / 2, y: this.tileSize * 32 };
    const livesCoords = { x: this.tileSize * 20, y: this.tileSize * 32 };

    this.ctx.fillStyle = this.color;
    this.ctx.font = this.fontSize + " " + this.fontStyle;
    this.ctx.fillText("SCORE: ", scoreCoords.x, scoreCoords.y);

    this.ctx.fillStyle = this.color;
    this.ctx.font = this.fontSize + " " + this.fontStyle;
    this.ctx.fillText("LIVES: ", livesCoords.x, livesCoords.y);
  }

  public clearReady(): void {
    this.clearCanvas();
    // Redraw just the default HUD
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

    // 🔥 SCALED UP: Using a massive font size for the countdown numbers
    this.ctx.font = this.tileSize * 3 + "px " + this.fontStyle;

    const coords = this.getCenterPosition();

    // We adjust the centering since the font is much bigger now
    this.ctx.fillText(n.toString(), coords.x + this.tileSize, coords.y);
    this.ctx.closePath();
  }

  public drawReady(): void {
    this.clearCanvas(); // Redraw normal score and lives so they don't vanish

    this.drawWords();
    this.drawScoreCount();
    this.drawLivesCount(); // Draw the READY! text dead-center

    this.ctx.fillStyle = "rgb(255, 255, 0)"; // Solid yellow

    // 🔥 SCALED UP: Setting font size to 60px or roughly double your standard HUD size!
    this.ctx.font = "60px " + this.fontStyle;

    const coords = this.getCenterPosition();

    // Since 60px is larger, we grab the width of the string to calculate a perfect visual center
    const text = "READY!";
    const metrics = this.ctx.measureText(text);
    const xOffset = (this.tileSize * 28) / 2 - metrics.width / 2; // Assuming 28 columns for canvas width

    this.ctx.fillText(text, xOffset, coords.y);
  }

  public drawDialog(text: string): void {}
}

export { UI };
