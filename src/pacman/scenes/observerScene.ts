// scenes/TheObserver.ts
import * as PIXI from "pixi.js";

export function observerScene(
  stage: PIXI.Container,
  w: number,
  h: number,
  duration: number,
  onComplete: () => void,
): void {
  const root = new PIXI.Container();
  stage.addChild(root);
  const cx = w / 2;
  const cy = h / 2;

  // ── Starfield ──────────────────────────────────────────────
  const stars: { g: PIXI.Graphics; vx: number; vy: number }[] = [];
  for (let i = 0; i < 180; i++) {
    const g = new PIXI.Graphics();
    const r = 0.3 + Math.random() * 1.8;
    g.circle(0, 0, r);
    const bright = Math.random() > 0.78;
    g.fill({ color: bright ? 0x8888cc : 0x444466, alpha: bright ? 0.6 : 0.25 });
    g.x = Math.random() * w;
    g.y = Math.random() * h;
    root.addChild(g);
    stars.push({ g, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 });
  }

  // ── Lens container ─────────────────────────────────────────
  const lensContainer = new PIXI.Container();
  lensContainer.x = cx;
  lensContainer.y = cy;
  lensContainer.alpha = 0;
  root.addChild(lensContainer);

  const glowR = w * 0.38;

  // Glow layers — built from multiple overlapping radial zones
  const glowLayers: PIXI.Graphics[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new PIXI.Graphics();
    lensContainer.addChild(g);
    glowLayers.push(g);
  }

  // Wave rings
  const waveRings: { g: PIXI.Graphics; baseR: number; phase: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new PIXI.Graphics();
    lensContainer.addChild(g);
    waveRings.push({ g, baseR: 50 + i * 30, phase: i * 2.1 });
  }

  // ── Text ──────────────────────────────────────────────────
  const title = new PIXI.Text("THE OBSERVER", {
    fontFamily: "Jersey-Regular, Courier New, monospace",
    fontSize: 22,
    fill: 0x9988cc,
    letterSpacing: 8,
  });
  title.anchor.set(0.5);
  title.x = cx;
  title.y = h * 0.9;
  title.alpha = 0;
  root.addChild(title);

  // ── Animation ──────────────────────────────────────────────
  let elapsed = 0, phase = 0, phaseTimer = 0;

  const ticker = new PIXI.Ticker();
  ticker.add(() => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    elapsed += dt;
    phaseTimer += dt;

    if (phase === 0 && phaseTimer > 1.5) { phase = 1; phaseTimer = 0; }
    if (phase === 1 && phaseTimer > 3.0) { phase = 2; phaseTimer = 0; }
    if (phase === 2 && phaseTimer > 4.0) { phase = 3; phaseTimer = 0; }
    if (phase === 3 && phaseTimer > 3.0) {
      ticker.stop();
      ticker.destroy();
      stage.removeChild(root);
      root.destroy({ children: true });
      onComplete();
      return;
    }

    // ── Stars ────────────────────────────────────────────────
    const lensActive = phase >= 2 && phase < 4;
    const lensStrength = lensActive ? (phase === 3 ? 2.5 : 1.4) : (phase === 1 ? 0.3 : 0);
    for (const s of stars) {
      s.g.x += s.vx * dt;
      s.g.y += s.vy * dt;
      if (lensStrength > 0) {
        const dx = cx - s.g.x;
        const dy = cy - s.g.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
        if (dist < glowR * 1.4) {
          const force = lensStrength * (1 - dist / (glowR * 1.4)) * 40;
          s.g.x += (dx / dist) * force * dt;
          s.g.y += (dy / dist) * force * dt;
        }
      }
      if (s.g.x < -10) s.g.x = w + 10;
      if (s.g.x > w + 10) s.g.x = -10;
      if (s.g.y < -10) s.g.y = h + 10;
      if (s.g.y > h + 10) s.g.y = -10;
    }

    // ── Lens emerge ──────────────────────────────────────────
    if (phase === 1) {
      lensContainer.alpha = Math.min(1, phaseTimer / 2.5);
      lensContainer.scale.set(0.3 + (phaseTimer / 3.0) * 0.7);
    }

    // ── Lens breathing ───────────────────────────────────────
    if (phase >= 1 && phase < 4) {
      const breathe = 1 + Math.sin(elapsed * 1.2) * 0.08;
      const gradR = glowR * breathe;

      // Layer 0: Wide outer haze — very soft
      glowLayers[0].clear();
      for (let i = 0; i < 30; i++) {
        const t = i / 30;
        const r = gradR * t;
        const alpha = 0.12 * (1 - t) * (1 - t);
        glowLayers[0].circle(0, 0, r);
        glowLayers[0].fill({ color: 0x332266, alpha: Math.max(0, alpha) });
      }

      // Layer 1: The iris — bright ring with sharp inner edge
      glowLayers[1].clear();
      for (let i = 0; i < 40; i++) {
        const t = i / 40;
        const r = gradR * t;
        let alpha = 0;
        if (t > 0.08 && t < 0.3) {
          // Bright ring between 8% and 30% radius
          const ringPos = (t - 0.08) / 0.22;
          alpha = Math.sin(ringPos * Math.PI) * 0.55;
        }
        glowLayers[1].circle(0, 0, r);
        glowLayers[1].fill({ color: 0x7755cc, alpha: Math.max(0, alpha) });
      }

      // Layer 2: Hot inner edge — thin bright rim just outside the void
      glowLayers[2].clear();
      for (let i = 0; i < 30; i++) {
        const t = i / 30;
        const r = gradR * Math.max(0.06, t * 0.25);
        let alpha = 0;
        if (t > 0.7 && t < 1.0) {
          const edgePos = (t - 0.7) / 0.3;
          alpha = (1 - edgePos) * 0.7;
        }
        glowLayers[2].circle(0, 0, r);
        glowLayers[2].fill({ color: 0xccbbff, alpha: Math.max(0, alpha) });
      }

      // Wave rings
      for (const wr of waveRings) {
        wr.g.clear();
        const waveR = wr.baseR + Math.sin(elapsed * 2 + wr.phase) * 10 * breathe;
        wr.g.circle(0, 0, waveR);
        wr.g.stroke({ width: 0.5, color: 0x8877cc, alpha: 0.18 });
      }
    }

    // ── Blink then fade ──────────────────────────────────────
    if (phase === 3) {
      if (phaseTimer < 1.5) {
        const bp = Math.min(1, phaseTimer / 1.5);
        lensContainer.scale.set(1 - bp * 0.9);
        lensContainer.alpha = 1 - bp * 0.5;
      } else {
        const fadeProgress = Math.min(1, (phaseTimer - 1.5) / 1.5);
        root.alpha = 1 - fadeProgress;
      }
    }

    // ── Title ────────────────────────────────────────────────
    if (phase === 1) title.alpha = Math.min(0.6, phaseTimer / 2.0);
    if (phase >= 3) title.alpha = Math.max(0, title.alpha - dt * 0.3);
  });
  ticker.start();
}