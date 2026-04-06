import { CANVAS_CONFIG } from "../config/canvas.js";
import { Entity } from "../entities/entity.js";
import { GameState } from "../game/state.js";

class Pill extends Entity {
  private gameState: GameState;
  private pillColor: string;
  public positions: { i: number; j: number }[] = [];
  private animationSpeed: number = 0.05;
  private animationCounter: number = 0;

  constructor() {
    super(CANVAS_CONFIG.canvasIds.pill, true);

    this.gameState = GameState.getInstance();
    this.pillColor = "#F0F4FF";
  }

  // 1. Map scanning happens here so game can draw pulsing pills on loadLevel()
  public spawn() {
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

  // 2. Kept empty to prevent duplicate map scans during initAll()
  public override init() {
    // Keep empty or add future event listeners here
  }

  public override reset() {
    this.positions = [];
    this.animationCounter = 0;
  }

  public override resetForLevel() {
    this.animationCounter = 0;
  }

  public update() {
    // Animation updates are handled inside the draw method with `animate()`
  }

  public eat(i: number, j: number) {
    this.positions = this.positions.filter((p) => !(p.i === i && p.j === j));
    this.clearCanvas();
  }

  public animate() {
    this.animationCounter += this.animationSpeed;
  }

public draw(animate: boolean) {
    if (animate) this.animate();
    
    // 🌟 Очищаем холст энерджайзеров перед каждым кадром пульсации!
    this.clearCanvas();

    this.positions.forEach(({ i, j }) => {
      const baseSize = this.tileSize / 6;
      const pulseSize = Math.sin(this.animationCounter * 3) * (this.tileSize / 15);
      const finalSize = baseSize + pulseSize;

      this.ctx.fillStyle = this.pillColor;
      this.ctx.beginPath();
      this.ctx.arc(
        this.tileSize * j + this.tileSize / 2,
        this.tileSize * i + this.tileSize / 2,
        finalSize,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
      this.ctx.closePath();
    });
  }
}

export { Pill };