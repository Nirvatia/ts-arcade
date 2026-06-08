// scenes/MazeReconstruction.ts
import * as PIXI from "pixi.js";

export function mazeReconstruction(
  stage: PIXI.Container,
  w: number,
  h: number,
  duration: number,
  onComplete: () => void,
  levelData?: string[][],
): void {
  const root = new PIXI.Container();
  stage.addChild(root);

  const cx = w / 2;
  const cy = h / 2;

  const tileSize = 28;
  const pad = 2;
  const cols = levelData?.[0]?.length ?? 0;
  const rows = levelData?.length ?? 0;

  const mazeBlocks: { x: number; y: number; g: PIXI.Graphics | null }[] = [];

  if (levelData) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = levelData[r]?.[c];
        if (!cell) continue;
        const isWall =
          cell === "1" || cell === "W" ||
          ["WH", "WV", "TL", "TR", "BL", "BR", "GL"].includes(cell);
        if (isWall) {
          // Match PixiGrid: position at top-left + pad
          mazeBlocks.push({
            x: c * tileSize + pad,
            y: r * tileSize + pad,
            g: null,
          });
        }
      }
    }
  }

  // Sort by distance from center
  mazeBlocks.sort((a, b) => {
    const da = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2);
    const db = Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2);
    return da - db;
  });

  // Faint starfield
  for (let i = 0; i < 40; i++) {
    const g = new PIXI.Graphics();
    g.circle(0, 0, 0.5 + Math.random());
    g.fill({ color: 0x444466, alpha: 0.3 });
    g.x = Math.random() * w;
    g.y = Math.random() * h;
    root.addChild(g);
  }

  const wb = tileSize - pad * 2;
  const hb = tileSize - pad * 2;

  let elapsed = 0;
  const ticker = new PIXI.Ticker();
  ticker.add(() => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    elapsed += dt;

    const progress = Math.min(1, elapsed / duration);
    const blocksToSpawn = Math.floor(progress * mazeBlocks.length);

    for (let i = 0; i < blocksToSpawn; i++) {
      const block = mazeBlocks[i];
      if (block.g === null) {
        const g = new PIXI.Graphics();
        // Draw at origin — container will be positioned
        g.rect(0, 0, wb, hb);
        g.fill({ color: 0x141438, alpha: 0.9 });
        g.rect(0, 0, wb, hb);
        g.stroke({ width: 0.5, color: 0x6655aa, alpha: 0.4 });
        g.x = block.x;
        g.y = block.y;
        g.scale.set(0);
        g.alpha = 0;
        root.addChild(g);
        block.g = g;
      }
    }

    for (let i = 0; i < blocksToSpawn; i++) {
      const block = mazeBlocks[i];
      if (block.g && block.g.scale.x < 1) {
        block.g.scale.set(Math.min(1, block.g.scale.x + dt * 2.5));
        block.g.alpha = Math.min(0.85, block.g.alpha + dt * 2);
      }
    }

    if (elapsed >= duration) {
      ticker.stop();
      ticker.destroy();
      stage.removeChild(root);
      root.destroy({ children: true });
      onComplete();
    }
  });
  ticker.start();
}