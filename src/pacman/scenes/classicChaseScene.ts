// src/game/scenes/classicChaseScene.ts
import { CFG_CANVAS } from "../config/canvas.js";
import { CanvasLayer } from "../core/canvasLayer.js";
import type { IGameScene } from "../interfaces.js";

export class ClassicChaseScene implements IGameScene {
  public readonly id = "classic_chase";
  private layer: CanvasLayer;
  private fontStyle: string;

  private duration: number = 0;
  private elapsedTime: number = 0;
  private onCompleteCallback: (() => void) | null = null;

  private startPacmanX: number = 0;
  private startGhostX: number = 0;
  private endPacmanX: number = 0;
  private endGhostX: number = 0;

  private pacmanX: number = 0;
  private ghostX: number = 0;
  private animationTime: number = 0;

  constructor() {
    this.layer = new CanvasLayer(CFG_CANVAS.canvasIds.scene);
    this.fontStyle = "Jersey-Regular";
  }

  public start(durationInSeconds: number, onComplete: () => void): void {
    this.onCompleteCallback = onComplete;
    this.duration = durationInSeconds;
    this.elapsedTime = 0;
    this.animationTime = 0;

    const scaleFactor = 2.5;
    const size = (CFG_CANVAS.tile.size / 2) * scaleFactor;
    const canvasWidth = this.layer.canvas.width;

    this.startPacmanX = canvasWidth + size;
    this.startGhostX = this.startPacmanX + size * 2.5;

    this.endPacmanX = -size;
    this.endGhostX = this.endPacmanX + size * 2.5;

    this.pacmanX = this.startPacmanX;
    this.ghostX = this.startGhostX;
  }

  public update(dt: number): void {
    if (this.duration <= 0) return;

    this.elapsedTime += dt;
    this.animationTime += dt;

    const progress = Math.min(1, this.elapsedTime / this.duration);

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

  public draw(): void {
    this.layer.clear();

    const ctx = this.layer.ctx;
    const canvas = this.layer.canvas;

    const s = CFG_CANVAS.tile.size;
    const y = canvas.height / 2;
    const scaleFactor = 2.5;
    const size = (s / 2) * scaleFactor;

    ctx.fillStyle = "rgb(255, 255, 0)";
    ctx.font = `40px ${this.fontStyle}`;
    ctx.fillText("INTERMISSION", canvas.width / 2 - 100, y - s * 4);

    ctx.save();
    this.drawAnimatedPacman(ctx, this.pacmanX, y, size);
    this.drawAnimatedGhost(ctx, this.ghostX, y, size, this.animationTime);
    ctx.restore();
  }

  private drawAnimatedPacman(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
  ): void {
    const maxMouthAngle = Math.PI / 3;
    const currentAperture =
      Math.abs(Math.sin(this.animationTime * 10.0)) * maxMouthAngle;

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(x, y, r, currentAperture, 2 * Math.PI - currentAperture, false);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }

  private drawAnimatedGhost(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    time: number,
  ): void {
    if (!isFinite(x) || !isFinite(y) || !isFinite(r)) return;

    const bob = Math.sin(time * 5.0) * (r * 0.1);
    const ghostY = y + bob;

    this.drawGhostLayer(
      ctx,
      x,
      ghostY,
      r,
      time,
      "rgba(200, 0, 0, 0.2)",
      6.0,
      1.2,
    );
    this.drawGhostLayer(
      ctx,
      x,
      ghostY,
      r,
      time,
      "rgba(255, 0, 0, 0.4)",
      9.0,
      1.0,
    );
    this.drawGhostLayer(ctx, x, ghostY, r, time, "red", 12.0, 0.9);

    this.drawGhostEyes(ctx, x, ghostY, r, time);
  }

  private drawGhostLayer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    time: number,
    color: string,
    waveSpeed: number,
    scale: number,
  ): void {
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
      const wave1 = Math.sin(time * waveSpeed + i * 0.5) * (ghostR * 0.15);
      const wave2 =
        Math.cos(time * (waveSpeed * 0.5) + i * 0.8) * (ghostR * 0.05);

      const curY = y + ghostR + wave1 + wave2;
      ctx.lineTo(curX, curY);
    }

    ctx.lineTo(x - ghostR, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawGhostEyes(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    time: number,
  ): void {
    const lookX = Math.cos(time * 3.0) * (r * 0.05);

    const eyeWidth = r * 0.3;
    const eyeHeight = r * 0.4;
    const leftEyeX = x - r * 0.35;
    const rightEyeX = x + r * 0.25;
    const eyeY = y - r * 0.2;

    ctx.fillStyle = "white";
    this.drawOval(ctx, leftEyeX, eyeY, eyeWidth, eyeHeight);
    this.drawOval(ctx, rightEyeX, eyeY, eyeWidth, eyeHeight);

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

  private drawOval(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rw: number,
    rh: number,
  ): void {
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
