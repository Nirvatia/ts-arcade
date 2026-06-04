import type { Ghost } from "../ghost.js";

export interface IGhostRenderer {
  draw(ctx: CanvasRenderingContext2D, ghost: Ghost, tileSize: number): void;
  clear(): void; 
}

interface CosmicParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  maxLife: number;
  life: number;
  color: string;
  type: "SPARK" | "JET";
}

export class ClassicVectorGhostRenderer implements IGhostRenderer {
  private particles: CosmicParticle[] = [];
  private vortexRotation = 0;

  public clear(): void {
    this.particles = [];
    this.vortexRotation = 0;
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    ghost: Ghost,
    tileSize: number,
  ): void {
    const r = tileSize * 0.36;
    let themeColor = ghost.color || ghost.defaultColor;
    let isFrightened = false;
    let isEaten = false;
    const timestamp = Date.now();

    // Evaluate Cosmic States
    if (ghost.state === "FRIGHTENED") {
      isFrightened = true;
      if (ghost["isFlashing"]) {
        const isWhite = Math.floor(timestamp / ghost["flashSpeed"]) % 2 === 0;
        themeColor = isWhite ? "#ffffff" : "#ff00bb";
      } else {
        themeColor = "#4d00ff";
      }
    } else if (ghost.state === "EATEN") {
      isEaten = true;
      themeColor = "rgba(0, 240, 255, 0.85)";
    }

    this.vortexRotation += isFrightened ? 0.12 : 0.05;

    // Process existing particle streams cleanly
    this.updateParticles(ctx);

    // Stop emitting new propulsion trails if the ghost has no directional vector
    if (!isEaten && (ghost.direction.dx !== 0 || ghost.direction.dy !== 0)) {
      this.emitPropulsionJets(ghost, r, themeColor, isFrightened);
    }

    // Render Core Assembly
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.translate(ghost.x, ghost.y);

    if (!isEaten) {
      this.drawGravitationalVortex(ctx, r, themeColor, isFrightened, timestamp);
    } else {
      this.drawSingularityRemnant(ctx, r, themeColor, timestamp);
    }

    ctx.restore();
  }

  private emitPropulsionJets(
    ghost: Ghost,
    r: number,
    color: string,
    isFrightened: boolean,
  ): void {
    const spawnRate = isFrightened ? 2 : 1;
    for (let i = 0; i < spawnRate; i++) {
      const ox = ghost.x - ghost.direction.dx * (r * 0.4);
      const oy = ghost.y - ghost.direction.dy * (r * 0.4);

      const jetPower = isFrightened ? 50 : 95;
      const vx = -ghost.direction.dx * jetPower + (Math.random() - 0.5) * 35;
      const vy = -ghost.direction.dy * jetPower + (Math.random() - 0.5) * 35;

      this.particles.push({
        x: ox + (Math.random() - 0.5) * (r * 0.4),
        y: oy + (Math.random() - 0.5) * (r * 0.4),
        vx,
        vy,
        alpha: 0.85,
        size: Math.random() * (isFrightened ? 1.5 : 3.0) + 1,
        maxLife: isFrightened ? 0.18 : 0.32,
        life: isFrightened ? 0.18 : 0.32,
        color,
        type: Math.random() > 0.5 ? "SPARK" : "JET",
      });
    }
  }

  private updateParticles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const dt = 1 / 60;
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.91;
      p.vy *= 0.91;

      const alphaProgress = p.life / p.maxLife;

      ctx.save();
      ctx.globalAlpha = p.alpha * alphaProgress;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.type === "JET" ? 10 : 3;
      ctx.fillStyle = p.color;

      if (p.type === "JET") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alphaProgress, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const sz = p.size * alphaProgress;
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawGravitationalVortex(
    ctx: CanvasRenderingContext2D,
    r: number,
    themeColor: string,
    isFrightened: boolean,
    timestamp: number,
  ): void {
    // --- 1. THE GALAXY ACCRETION FIELD (SOFTENED BRIGHTNESS) ---
    ctx.save();
    ctx.rotate(this.vortexRotation);

    if (isFrightened) {
      // Retained your exact preferred frightened vector line style completely
      ctx.shadowBlur = 16;
      ctx.shadowColor = themeColor;
      const arms = 5;
      const maxRadius = r * 1.3;

      for (let j = 0; j < arms; j++) {
        ctx.save();
        ctx.rotate((j * Math.PI * 2) / arms);
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 3.0;
        ctx.globalAlpha = 0.75;

        ctx.beginPath();
        ctx.moveTo(maxRadius, 0);
        ctx.quadraticCurveTo(r * 0.6, r * 0.6, r * 0.25, 0);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r * 0.85, 0);
        ctx.quadraticCurveTo(r * 0.4, r * 0.4, r * 0.3, 0);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // NORMAL STATE: Denser mathematical strands but dropped thickness/opacity for smooth gas glow
      const totalStrands = 20;
      const pointsPerStrand = 18;
      const maxRadius = r * 1.35;

      ctx.shadowBlur = 6;
      ctx.shadowColor = themeColor;

      for (let i = 0; i < totalStrands; i++) {
        ctx.save();
        const startAngle = (i * Math.PI * 2) / 6;
        ctx.rotate(startAngle);

        ctx.beginPath();
        // Toned down to avoid thick blinding vector lines
        ctx.lineWidth = i % 4 === 0 ? 1.5 : 0.8;
        ctx.strokeStyle =
          i % 4 === 0 ? "rgba(255, 255, 255, 0.85)" : themeColor;
        ctx.globalAlpha = i % 4 === 0 ? 0.4 : 0.22;

        for (let j = 0; j < pointsPerStrand; j++) {
          const ratio = j / pointsPerStrand;
          const currentRadius = maxRadius * (1.0 - ratio);
          const spiralArc = ratio * Math.PI * 1.4;

          const x = Math.cos(spiralArc) * currentRadius;
          const y = Math.sin(spiralArc) * currentRadius;

          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    // --- 2. THE EVENT HORIZON LENS ---
    ctx.save();
    const pulseRadius = r * (0.82 + Math.sin(timestamp * 0.012) * 0.04);
    const lensGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, pulseRadius);

    if (isFrightened) {
      lensGrad.addColorStop(0, "#0d0033");
      lensGrad.addColorStop(0.4, "rgba(77, 0, 255, 0.6)");
      lensGrad.addColorStop(0.8, "rgba(255, 0, 187, 0.15)");
    } else {
      lensGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
      lensGrad.addColorStop(0.35, themeColor);
      lensGrad.addColorStop(0.7, `${themeColor}1A`);
    }
    lensGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = lensGrad;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- 3. THE 3D GRAVITATIONAL SINGULARITY CORE ---
    // Layers a reverse light falloff so the center pulls inward visually instead of sitting flat
    ctx.save();
    const singularitySize = isFrightened ? r * 0.38 : r * 0.44;

    // Use a complex radial gradient directly inside the horizon lip to fake spatial distortion
    const coreSphericalGrad = ctx.createRadialGradient(
      0,
      0,
      singularitySize * 0.4,
      0,
      0,
      singularitySize,
    );
    coreSphericalGrad.addColorStop(0, "#000000"); // Dark absolute pit center
    coreSphericalGrad.addColorStop(0.7, "rgba(5, 5, 10, 1)");
    coreSphericalGrad.addColorStop(0.9, `${themeColor}4D`); // Light grazing the edge of space
    coreSphericalGrad.addColorStop(1, "#000000");

    ctx.fillStyle = coreSphericalGrad;
    ctx.beginPath();
    ctx.arc(0, 0, singularitySize, 0, Math.PI * 2);
    ctx.fill();

    // High-frequency rim border
    ctx.strokeStyle = isFrightened ? "#ffffff" : `${themeColor}BB`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, singularitySize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawSingularityRemnant(
    ctx: CanvasRenderingContext2D,
    r: number,
    themeColor: string,
    timestamp: number,
  ): void {
    // --- COMPLETED FLEEING STATE ---
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = themeColor;

    // 1. High-Intensity particle vector stream
    const beamLength = r * 2.4;
    const beamThickness = 3.5;

    const beamGradient = ctx.createLinearGradient(
      -beamLength / 2,
      0,
      beamLength / 2,
      0,
    );
    beamGradient.addColorStop(0, "rgba(0, 240, 255, 0)");
    beamGradient.addColorStop(0.5, "#ffffff");
    beamGradient.addColorStop(1, "rgba(0, 240, 255, 0)");

    ctx.fillStyle = beamGradient;
    ctx.fillRect(
      -beamLength / 2,
      -beamThickness / 2,
      beamLength,
      beamThickness,
    );

    // 2. High-frequency bracket scanner lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.65)";
    ctx.lineWidth = 1.2;

    const waveOffset = Math.sin(timestamp * 0.02) * 2.5;
    ctx.beginPath();
    // Left Wing Bracket
    ctx.moveTo(-r * 0.6, -5 + waveOffset);
    ctx.lineTo(-r * 0.75, 0);
    ctx.lineTo(-r * 0.6, 5 - waveOffset);
    // Right Wing Bracket
    ctx.moveTo(r * 0.6, -5 - waveOffset);
    ctx.lineTo(r * 0.75, 0);
    ctx.lineTo(r * 0.6, 5 + waveOffset);
    ctx.stroke();

    // 3. Point Singularity Core
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
