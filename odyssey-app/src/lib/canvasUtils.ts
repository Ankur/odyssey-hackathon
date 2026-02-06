import type { Stroke, Point } from '../types';
import { EXPORT_WIDTH, EXPORT_HEIGHT } from '../constants';

/**
 * Redraw all strokes onto a canvas context.
 */
export function redrawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    // Use quadratic bezier curves through midpoints for smoothness
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const mid: Point = {
        x: (stroke.points[i].x + stroke.points[i + 1].x) / 2,
        y: (stroke.points[i].y + stroke.points[i + 1].y) / 2,
      };
      ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, mid.x, mid.y);
    }

    // Draw to the last point
    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

/**
 * Draw a single line segment (for the current in-progress stroke).
 */
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

/**
 * Export the drawing canvas as a PNG File object suitable for Odyssey API.
 * Renders strokes on a white background at the Odyssey landscape resolution.
 */
export async function exportCanvasAsFile(
  strokes: Stroke[],
  sourceWidth: number,
  sourceHeight: number,
): Promise<File> {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = EXPORT_WIDTH;
  exportCanvas.height = EXPORT_HEIGHT;
  const ctx = exportCanvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  // Scale strokes from source dimensions to export dimensions
  const scaleX = EXPORT_WIDTH / sourceWidth;
  const scaleY = EXPORT_HEIGHT / sourceHeight;

  const scaledStrokes: Stroke[] = strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
    })),
    width: s.width * Math.min(scaleX, scaleY),
  }));

  redrawStrokes(ctx, scaledStrokes);

  const blob = await new Promise<Blob>((resolve) =>
    exportCanvas.toBlob((b) => resolve(b!), 'image/png'),
  );
  return new File([blob], 'sketch.png', { type: 'image/png' });
}

/**
 * Export the drawing canvas as a base64 data URL for vision API calls.
 */
export function exportCanvasAsDataUrl(
  strokes: Stroke[],
  sourceWidth: number,
  sourceHeight: number,
): string {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = EXPORT_WIDTH;
  exportCanvas.height = EXPORT_HEIGHT;
  const ctx = exportCanvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  // Scale strokes from source dimensions to export dimensions
  const scaleX = EXPORT_WIDTH / sourceWidth;
  const scaleY = EXPORT_HEIGHT / sourceHeight;

  const scaledStrokes: Stroke[] = strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
    })),
    width: s.width * Math.min(scaleX, scaleY),
  }));

  redrawStrokes(ctx, scaledStrokes);

  return exportCanvas.toDataURL('image/png');
}
