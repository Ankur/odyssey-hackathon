/**
 * Draws a simple programmatic scene (house, tree, sun) onto a canvas context.
 * Used as the background for the Edit tab.
 */
export function drawDummyScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  // Sky (upper 60%)
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, width, height * 0.6);

  // Ground (lower 40%)
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(0, height * 0.6, width, height * 0.4);

  // Sun (upper-right)
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(width * 0.85, height * 0.15, 60, 0, Math.PI * 2);
  ctx.fill();

  // House body (left-center area)
  const houseX = width * 0.2;
  const houseY = height * 0.35;
  const houseW = 220;
  const houseH = 180;
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(houseX, houseY, houseW, houseH);

  // Roof triangle
  ctx.fillStyle = '#5D2E0C';
  ctx.beginPath();
  ctx.moveTo(houseX - 20, houseY);
  ctx.lineTo(houseX + houseW / 2, houseY - 100);
  ctx.lineTo(houseX + houseW + 20, houseY);
  ctx.closePath();
  ctx.fill();

  // Door
  ctx.fillStyle = '#3E1A00';
  ctx.fillRect(houseX + houseW / 2 - 25, houseY + houseH - 80, 50, 80);

  // Window
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(houseX + 30, houseY + 40, 50, 50);
  ctx.strokeStyle = '#5D2E0C';
  ctx.lineWidth = 3;
  ctx.strokeRect(houseX + 30, houseY + 40, 50, 50);
  // Window cross
  ctx.beginPath();
  ctx.moveTo(houseX + 55, houseY + 40);
  ctx.lineTo(houseX + 55, houseY + 90);
  ctx.moveTo(houseX + 30, houseY + 65);
  ctx.lineTo(houseX + 80, houseY + 65);
  ctx.stroke();

  // Tree trunk (right side)
  const treeX = width * 0.7;
  const treeY = height * 0.6;
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(treeX - 15, treeY - 160, 30, 160);

  // Tree foliage
  ctx.fillStyle = '#228B22';
  ctx.beginPath();
  ctx.arc(treeX, treeY - 200, 80, 0, Math.PI * 2);
  ctx.fill();
}
