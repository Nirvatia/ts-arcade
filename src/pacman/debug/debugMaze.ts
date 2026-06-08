import type { TileType } from "../shared/types.js";

const debugMaze = (maze: TileType[][]): HTMLCanvasElement => {
  const rows: number = maze.length;
  const cols: number = maze[0].length;
  
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '999999';
  canvas.style.backgroundColor = '#060618'; // Cosmic void
  
  const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  const maxTileWidth: number = (canvas.width * 0.8) / cols;
  const maxTileHeight: number = (canvas.height * 0.8) / rows;
  const tileSize: number = Math.min(maxTileWidth, maxTileHeight, 100);
  
  const offsetX: number = (canvas.width - cols * tileSize) / 2;
  const offsetY: number = (canvas.height - rows * tileSize) / 2;
  
  // Fill background
  ctx.fillStyle = '#060618';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw subtle dot grid (matching PixiGrid stars)
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * tileSize;
      const y = offsetY + r * tileSize;
      const bright = Math.random() > 0.85;
      ctx.fillStyle = bright ? '#444488' : '#222250';
      ctx.beginPath();
      ctx.arc(x, y, bright ? 1.5 : 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Helper: is this a wall tile?
  const isWall = (r: number, c: number): boolean => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const tile = maze[r][c];
    return tile === "WL" || tile === "LE";
  };
  
  // Helper: is this a lair interior tile? (open inside, no borders)
  const isLairInterior = (r: number, c: number): boolean => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const tile = maze[r][c];
    return (
      tile === "LT" ||
      tile === "BY" ||
      tile === "PY" ||
      tile === "IY" ||
      tile === "CE"
    );
  };
  
  // Helper: should we draw a border from this wall toward this neighbor?
  const shouldDrawBorder = (
    _wallR: number,
    _wallC: number,
    neighborR: number,
    neighborC: number,
  ): boolean => {
    // Boundary of maze always draws border
    if (neighborR < 0 || neighborR >= rows || neighborC < 0 || neighborC >= cols) {
      return true;
    }
    // If neighbor is a wall, no border between walls
    if (isWall(neighborR, neighborC)) return false;
    // If neighbor is lair interior, no border (open inside)
    if (isLairInterior(neighborR, neighborC)) return false;
    // Everything else (DT, PP, ES, PM, teleports) — draw border
    return true;
  };
  
  // Draw wall borders (cosmic wireframe)
  ctx.strokeStyle = '#6655aa';
  ctx.lineWidth = 2;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isWall(r, c)) continue;
      
      const x = offsetX + c * tileSize;
      const y = offsetY + r * tileSize;
      
      if (shouldDrawBorder(r, c, r - 1, c)) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + tileSize, y);
        ctx.stroke();
      }
      if (shouldDrawBorder(r, c, r + 1, c)) {
        ctx.beginPath();
        ctx.moveTo(x, y + tileSize);
        ctx.lineTo(x + tileSize, y + tileSize);
        ctx.stroke();
      }
      if (shouldDrawBorder(r, c, r, c - 1)) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + tileSize);
        ctx.stroke();
      }
      if (shouldDrawBorder(r, c, r, c + 1)) {
        ctx.beginPath();
        ctx.moveTo(x + tileSize, y);
        ctx.lineTo(x + tileSize, y + tileSize);
        ctx.stroke();
      }
    }
  }
  
  // Optionally label spawn tiles for debugging
  ctx.font = `${Math.max(10, tileSize / 4)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const spawnLabels: Record<string, { label: string; color: string }> = {
    "PM": { label: "P", color: "#ffff00" },
    "BY": { label: "B", color: "#ff0000" },
    "PY": { label: "P", color: "#ffb8ff" },
    "IY": { label: "I", color: "#00ffff" },
    "CE": { label: "C", color: "#ffb852" },
  };
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = maze[r][c];
      const info = spawnLabels[tile];
      if (info) {
        const x = offsetX + c * tileSize + tileSize / 2;
        const y = offsetY + r * tileSize + tileSize / 2;
        ctx.fillStyle = info.color;
        ctx.fillText(info.label, x, y);
      }
    }
  }
  
  document.body.appendChild(canvas);
  return canvas;
};

export { debugMaze };