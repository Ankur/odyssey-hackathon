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
 * Draw a single stroke path with bezier smoothing using the given style.
 */
function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  style: string | CanvasGradient,
) {
  if (stroke.points.length < 2) return;

  ctx.strokeStyle = style;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let i = 1; i < stroke.points.length - 1; i++) {
    const mid: Point = {
      x: (stroke.points[i].x + stroke.points[i + 1].x) / 2,
      y: (stroke.points[i].y + stroke.points[i + 1].y) / 2,
    };
    ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, mid.x, mid.y);
  }

  const last = stroke.points[stroke.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Draw rainbow pulse loading animation on strokes.
 * A bright rainbow band sweeps left-to-right across dimmed strokes, looping continuously.
 */
export function drawPulseAnimation(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  startTime: number,
) {
  const { width, height } = ctx.canvas;
  const elapsed = performance.now() - startTime;

  ctx.clearRect(0, 0, width, height);

  // Dark overlay to dim the webcam + draw canvas underneath
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, width, height);

  if (strokes.length === 0) return;

  // Draw dim base strokes
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (const stroke of strokes) {
    drawStrokePath(ctx, stroke, 'rgba(255, 255, 255, 1)');
  }
  ctx.restore();

  // Pulse timing
  const cycleDuration = 3500;
  const t = (elapsed % cycleDuration) / cycleDuration;

  const bandWidth = 0.18;
  const fadeWidth = 0.05;
  const totalTravel = 1 + bandWidth + fadeWidth * 2;
  const center = t * totalTravel - (bandWidth / 2 + fadeWidth);

  const bandStart = center - bandWidth / 2;
  const bandEnd = center + bandWidth / 2;

  // Rainbow colors
  const rainbow = ['#ff0055', '#ff6600', '#ffcc00', '#00ff88', '#00ccff', '#5500ff', '#cc00ff'];
  const firstColor = rainbow[0];
  const lastColor = rainbow[rainbow.length - 1];

  // Build gradient stops
  type GradStop = { pos: number; color: string };
  const stops: GradStop[] = [];

  // Before pulse: transparent (use first rainbow color with alpha 0 to avoid dark fringing)
  stops.push({ pos: 0, color: hexToRgba(firstColor, 0) });
  if (bandStart - fadeWidth > 0.001) {
    stops.push({ pos: bandStart - fadeWidth, color: hexToRgba(firstColor, 0) });
  }

  // Rainbow band
  for (let i = 0; i < rainbow.length; i++) {
    const pos = bandStart + (bandEnd - bandStart) * (i / (rainbow.length - 1));
    stops.push({ pos, color: rainbow[i] });
  }

  // After pulse: transparent (use last rainbow color with alpha 0)
  if (bandEnd + fadeWidth < 0.999) {
    stops.push({ pos: bandEnd + fadeWidth, color: hexToRgba(lastColor, 0) });
  }
  stops.push({ pos: 1, color: hexToRgba(lastColor, 0) });

  // Filter to valid range [0, 1], sort, and deduplicate
  const validStops = stops
    .map(s => ({ pos: Math.max(0, Math.min(1, s.pos)), color: s.color }))
    .sort((a, b) => a.pos - b.pos);

  const finalStops: GradStop[] = [];
  for (const s of validStops) {
    if (finalStops.length === 0 || s.pos > finalStops[finalStops.length - 1].pos + 0.001) {
      finalStops.push(s);
    }
  }

  // Must have at least 2 stops
  if (finalStops.length < 2) {
    finalStops.length = 0;
    finalStops.push({ pos: 0, color: hexToRgba(firstColor, 0) });
    finalStops.push({ pos: 1, color: hexToRgba(lastColor, 0) });
  }

  const grad = ctx.createLinearGradient(0, 0, width, 0);
  for (const s of finalStops) {
    grad.addColorStop(s.pos, s.color);
  }

  // Draw rainbow strokes with glow
  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
  for (const stroke of strokes) {
    drawStrokePath(ctx, stroke, grad);
  }
  ctx.restore();
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
