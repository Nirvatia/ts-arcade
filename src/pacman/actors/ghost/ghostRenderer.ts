import type { Ghost } from "../ghost.js";

export interface IGhostRenderer {
  draw(ctx: CanvasRenderingContext2D, ghost: Ghost, tileSize: number): void;
}

export class ClassicVectorGhostRenderer implements IGhostRenderer {
  private particleTimer = 0;
  private trailParticles: Array<{
    x: number;
    y: number;
    alpha: number;
    width: number;
    height: number;
    drift: number;
  }> = [];

  public draw(
    ctx: CanvasRenderingContext2D,
    ghost: Ghost,
    tileSize: number,
  ): void {
    const r = tileSize / 2;
    let vectorColor = ghost.color || ghost.defaultColor;
    let isFrightened = false;
    let isEaten = false;

    // Evaluate state purely using state indicators from the entity
    if (ghost.state === "FRIGHTENED") {
      isFrightened = true;
      if (ghost["isFlashing"]) {
        // Accessing private property safely, or make it public/protected
        const isWhite = Math.floor(Date.now() / ghost["flashSpeed"]) % 2 === 0;
        vectorColor = isWhite ? "#ffffff" : "#1144bb";
      } else {
        vectorColor = "#1144bb";
      }
    } else if (ghost.state === "EATEN") {
      isEaten = true;
      vectorColor = "rgba(0, 240, 255, 0.9)";
    }

    // Particle Trail Engine
    if (ghost.direction.dx !== 0 || ghost.direction.dy !== 0) {
      this.particleTimer++;
      if (this.particleTimer >= 3) {
        this.trailParticles.push({
          x: Math.round(ghost.x) + (Math.random() - 0.5) * (r * 0.7),
          y: Math.round(ghost.y) + (Math.random() - 0.5) * r,
          alpha: 0.85,
          width: Math.random() > 0.5 ? r * 0.8 : r * 0.4,
          height: 1.5,
          drift: (Math.random() - 0.5) * 3,
        });
        this.particleTimer = 0;
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    // Draw Tail Particles
    if (this.trailParticles.length > 0) {
      ctx.save();
      for (let i = this.trailParticles.length - 1; i >= 0; i--) {
        const p = this.trailParticles[i];
        ctx.fillStyle = vectorColor;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(
          p.x - p.width / 2 + p.drift,
          p.y - p.height / 2,
          p.width,
          p.height,
        );

        p.alpha -= 0.14;
        if (p.alpha <= 0) this.trailParticles.splice(i, 1);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(Math.round(ghost.x), Math.round(ghost.y));
    ctx.rotate(this.getOrientationAngle(ghost.direction));

    if (!isEaten) {
      this.drawVectorCore(ctx, r, vectorColor, isFrightened);
    } else {
      this.drawFleeingCore(ctx, r, vectorColor);
    }

    ctx.restore();
  }

  private getOrientationAngle(direction: { dx: number; dy: number }): number {
    if (direction.dx === 1) return Math.PI / 2;
    if (direction.dx === -1) return -Math.PI / 2;
    if (direction.dy === -1) return 0;
    if (direction.dy === 1) return Math.PI;
    return 0;
  }

  private drawVectorCore(
    ctx: CanvasRenderingContext2D,
    r: number,
    themeColor: string,
    isFrightened: boolean,
  ): void {
    ctx.save();
    const scaleFactor = (r * 2.2) / 100;
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-50, -50);

    ctx.shadowBlur = isFrightened ? 6 : 15;
    ctx.shadowColor = themeColor;
    ctx.strokeStyle = themeColor;
    ctx.lineJoin = "miter";
    ctx.miterLimit = 4;

    ctx.beginPath();
    ctx.moveTo(50, 8);
    ctx.lineTo(72, 78);
    ctx.lineTo(50, 62);
    ctx.lineTo(28, 78);
    ctx.closePath();
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Secondary vector detail lines
    ctx.beginPath();
    ctx.lineWidth = 2.0;
    ctx.moveTo(37, 69);
    ctx.lineTo(16, 75);
    ctx.lineTo(31, 62);
    ctx.moveTo(63, 69);
    ctx.lineTo(84, 75);
    ctx.lineTo(69, 62);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = 0.55;
    ctx.moveTo(50, 24);
    ctx.lineTo(66, 67);
    ctx.lineTo(50, 56);
    ctx.lineTo(34, 67);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.moveTo(50, 8);
    ctx.lineTo(50, 56);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private drawFleeingCore(
    ctx: CanvasRenderingContext2D,
    r: number,
    themeColor: string,
  ): void {
    ctx.save();
    const scaleFactor = (r * 1.8) / 100;
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-50, -50);

    ctx.shadowBlur = 12;
    ctx.shadowColor = themeColor;
    ctx.strokeStyle = themeColor;
    ctx.lineJoin = "miter";

    ctx.beginPath();
    ctx.moveTo(50, 12);
    ctx.lineTo(68, 75);
    ctx.lineTo(50, 60);
    ctx.lineTo(32, 75);
    ctx.closePath();
    ctx.fillStyle = "#000000";
    ctx.fill();

    const rapidBlink = Math.floor(Date.now() / 45) % 2 === 0;
    ctx.lineWidth = rapidBlink ? 3.5 : 1.5;
    ctx.stroke();

    ctx.restore();
  }
}
