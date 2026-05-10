import { CFG_CANVAS } from "../config/canvas.js";

class Intermission {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private fontStyle: string;

  private duration: number = 0;
  private elapsedTime: number = 0;
  private onCompleteCallback: (() => void) | null = null;

  private startPacmanX: number = 0;
  private startGhostX: number = 0;

  // У каждого своя точка финиша, чтобы скорость была одинаковой
  private endPacmanX: number = 0;
  private endGhostX: number = 0;

  private pacmanX: number = 0;
  private ghostX: number = 0;
  private animationTime: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    fontStyle: string,
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.fontStyle = fontStyle;
  }

  public start(durationInSeconds: number, onComplete: () => void) {
    this.onCompleteCallback = onComplete;
    this.duration = durationInSeconds;
    this.elapsedTime = 0;

    const scaleFactor = 2.5;
    const size = (CFG_CANVAS.tile.size / 2) * scaleFactor;

    // Пакман стартует впереди, Блинки позади него на расстоянии 2.5 своих размеров
    this.startPacmanX = this.canvas.width + size;
    this.startGhostX = this.startPacmanX + size * 2.5;

    // Смещаем финишные точки на ту же дельту
    this.endPacmanX = -size;
    this.endGhostX = this.endPacmanX + size * 2.5;

    this.pacmanX = this.startPacmanX;
    this.ghostX = this.startGhostX;
  }

  public update(dt: number) {
    if (this.duration <= 0) return;

    const deltaInSeconds = dt / 1000;
    this.elapsedTime += deltaInSeconds;

    const progress = Math.min(1, this.elapsedTime / this.duration);

    // Накапливаем время для плавной анимации
    this.animationTime += dt * 0.005;

    this.pacmanX =
      this.startPacmanX + (this.endPacmanX - this.startPacmanX) * progress;
    this.ghostX =
      this.startGhostX + (this.endGhostX - this.startGhostX) * progress;

    if (this.elapsedTime >= this.duration) {
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
        this.onCompleteCallback = null;
      }
    }
  }

  public draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const s = CFG_CANVAS.tile.size;
    const y = this.canvas.height / 2;

    const scaleFactor = 2.5;
    const size = (s / 2) * scaleFactor;

    this.ctx.fillStyle = "rgb(255, 255, 0)";
    this.ctx.font = "40px " + this.fontStyle;
    this.ctx.fillText("INTERMISSION", this.canvas.width / 2 - 100, y - s * 4);

    this.ctx.save();
    this.drawAnimatedPacman(this.pacmanX, y, size);

    // 🌟 ВОТ ОН: Исправленный вызов. Передаем animationTime четвертым аргументом!
    this.drawAnimatedGhost(this.ghostX, y, size, this.animationTime);

    this.ctx.restore();
  }

  private drawAnimatedPacman(x: number, y: number, r: number): void {
    const ctx = this.ctx;
    const maxMouthAngle = Math.PI / 3;
    const animationSpeed = 0.015;

    // Uses the accumulated animation time for perfect sync
    const currentAperture =
      Math.abs(Math.sin(this.animationTime * 3.0)) * maxMouthAngle;

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(x, y, r, currentAperture, 2 * Math.PI - currentAperture, false);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }

  private drawAnimatedGhost(x: number, y: number, r: number, t: number): void {
    if (!isFinite(x) || !isFinite(y) || !isFinite(r)) return;

    const ctx = this.ctx;
    const time = t || 0;

    const bob = Math.sin(time * 0.8) * (r * 0.1);
    const ghostY = y + bob;

    // Отрисовка слоев для эффекта пламени/свечения
    this.drawGhostLayer(x, ghostY, r, time, "rgba(200, 0, 0, 0.2)", 1.2, 1.1); // Задний блюр
    this.drawGhostLayer(x, ghostY, r, time, "rgba(255, 0, 0, 0.4)", 0.8, 1.0); // Среднее свечение
    this.drawGhostLayer(x, ghostY, r, time, "red", 0.5, 0.9); // Плотное ядро

    this.drawGhostEyes(x, ghostY, r, time);
  }

  private drawGhostLayer(
    x: number,
    y: number,
    r: number,
    time: number,
    color: string,
    waveSpeed: number,
    scale: number,
  ): void {
    const ctx = this.ctx;
    const ghostR = r * scale;

    ctx.save();
    ctx.fillStyle = color;

    if (scale > 0.8) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
    }

    ctx.beginPath();
    ctx.arc(x, y, ghostR, Math.PI, 0, false);
    ctx.lineTo(x + ghostR, y + ghostR);

    const segments = 20;
    const step = (ghostR * 2) / segments;

    for (let i = 0; i <= segments; i++) {
      const curX = x + ghostR - i * step;

      const wave1 = Math.sin(time * waveSpeed + i * 0.5) * (ghostR * 0.2);
      const wave2 = Math.cos(time * 0.5 + i * 0.8) * (ghostR * 0.1);

      const curY = y + ghostR + wave1 + wave2;
      ctx.lineTo(curX, curY);
    }

    ctx.lineTo(x - ghostR, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawGhostEyes(x: number, y: number, r: number, time: number): void {
    const ctx = this.ctx;
    const lookX = Math.cos(time * 0.5) * (r * 0.05);

    const eyeWidth = r * 0.3;
    const eyeHeight = r * 0.4;
    const leftEyeX = x - r * 0.35;
    const rightEyeX = x + r * 0.25;
    const eyeY = y - r * 0.2;

    ctx.fillStyle = "white";
    this.drawOval(leftEyeX, eyeY, eyeWidth, eyeHeight);
    this.drawOval(rightEyeX, eyeY, eyeWidth, eyeHeight);

    ctx.fillStyle = "#000066";
    const pupilR = r * 0.12;
    ctx.beginPath();
    ctx.arc(
      leftEyeX - eyeWidth * 0.3 + lookX,
      eyeY + eyeHeight * 0.1,
      pupilR,
      0,
      Math.PI * 2,
    );
    ctx.arc(
      rightEyeX - eyeWidth * 0.3 + lookX,
      eyeY + eyeHeight * 0.1,
      pupilR,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  private drawOval(x: number, y: number, rw: number, rh: number) {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

export { Intermission };
