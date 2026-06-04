import type { TileType } from "../shared/types.js";

export function debugMaze(map: TileType[][]): () => void {
  // 1. Create a full-screen top-layer canvas
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.zIndex = "99999"; // Sit on top of absolutely everything
  canvas.style.pointerEvents = "none"; // Clicks pass right through it

  // Handle high-DPI screens properly
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Failed to get Canvas context");
    return () => {};
  }
  ctx.scale(dpr, dpr);

  // 2. Clear to a solid pitch-black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // 3. Grid sizing calculations
  const rows = map.length;
  const cols = map[0].length;
  
  // Find largest tile size that fits without cropping
  const tileSize = Math.min(
    window.innerWidth / cols,
    window.innerHeight / rows
  );
  
  // Center the maze perfectly on the screen
  const offsetX = (window.innerWidth - cols * tileSize) / 2;
  const offsetY = (window.innerHeight - rows * tileSize) / 2;

  // 4. Style setups
  const mazeColor = "#3B5266"; // Calm slate-steel
  ctx.lineWidth = 2;

  // Draw a single tile at grid coordinates
  const drawTile = (r: number, c: number, type: TileType) => {
    const x = offsetX + c * tileSize;
    const y = offsetY + r * tileSize;
    const center = tileSize / 2;

    ctx.strokeStyle = mazeColor;
    ctx.globalAlpha = 0.7; // Softened opacity so it's not harsh

    switch (type) {
      case "WH": // Wall Horizontal
        ctx.beginPath();
        ctx.moveTo(x, y + center);
        ctx.lineTo(x + tileSize, y + center);
        ctx.stroke();
        break;

      case "WV": // Wall Vertical
        ctx.beginPath();
        ctx.moveTo(x + center, y);
        ctx.lineTo(x + center, y + tileSize);
        ctx.stroke();
        break;

      case "TL": // Top Left Corner
        ctx.beginPath();
        ctx.arc(x + tileSize, y + tileSize, center, Math.PI, (3 * Math.PI) / 2);
        ctx.stroke();
        break;

      case "TR": // Top Right Corner
        ctx.beginPath();
        ctx.arc(x, y + tileSize, center, (3 * Math.PI) / 2, 0);
        ctx.stroke();
        break;

      case "BL": // Bottom Left Corner
        ctx.beginPath();
        ctx.arc(x + tileSize, y, center, Math.PI / 2, Math.PI);
        ctx.stroke();
        break;

      case "BR": // Bottom Right Corner
        ctx.beginPath();
        ctx.arc(x, y, center, 0, Math.PI / 2);
        ctx.stroke();
        break;

      case "FD": // Standard Food Pellet
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "#FFB8AE"; // Soft peach
        ctx.beginPath();
        ctx.arc(x + center, y + center, tileSize * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "PP": // Power Pellet
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "#FFB8AE";
        ctx.beginPath();
        ctx.arc(x + center, y + center, tileSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "GL": // Ghost Lair Door
        ctx.strokeStyle = "#FF809B"; // Subtle pink door
        ctx.beginPath();
        ctx.moveTo(x, y + center);
        ctx.lineTo(x + tileSize, y + center);
        ctx.stroke();
        break;
        
      case "PM": // Pac-man Spawn
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "#FFEA00"; // Signature yellow
        ctx.beginPath();
        ctx.arc(x + center, y + center, tileSize * 0.4, 0.2 * Math.PI, 1.8 * Math.PI);
        ctx.lineTo(x + center, y + center);
        ctx.fill();
        break;
    }
  };

  // Run the render loop
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(r, c, map[r][c]);
    }
  }

  // Return a cleanup function so you can remove it on command
  return () => {
    canvas.remove();
  };
}