import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PINCH_THRESHOLD } from '../constants';
import type { Point } from '../types';

// MediaPipe hand landmark indices
export const THUMB_TIP = 4;
export const INDEX_TIP = 8;
export const INDEX_MCP = 5;
export const INDEX_PIP = 6;

/**
 * Check if thumb and index finger are pinching (tips close together).
 */
export function isPinching(landmarks: NormalizedLandmark[]): boolean {
  const thumb = landmarks[THUMB_TIP];
  const index = landmarks[INDEX_TIP];
  const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  return dist < PINCH_THRESHOLD;
}

/**
 * Get the midpoint between thumb and index tips (used as pinch position).
 */
export function getPinchMidpoint(
  landmarks: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
): Point {
  const thumb = landmarks[THUMB_TIP];
  const index = landmarks[INDEX_TIP];
  return {
    x: ((thumb.x + index.x) / 2) * canvasWidth,
    y: ((thumb.y + index.y) / 2) * canvasHeight,
  };
}

/**
 * Get the index fingertip position in canvas coordinates.
 * Mirrors x to match the CSS-mirrored webcam video (selfie mode).
 * The canvases themselves are NOT CSS-mirrored — mirroring is done here in code.
 */
export function getIndexTipPosition(
  landmarks: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
): Point {
  const tip = landmarks[INDEX_TIP];
  return {
    x: (1 - tip.x) * canvasWidth,
    y: tip.y * canvasHeight,
  };
}

/**
 * Check if the index finger is extended (tip is above PIP joint in y).
 * This helps avoid drawing when the hand is in a fist.
 */
export function isIndexFingerExtended(landmarks: NormalizedLandmark[]): boolean {
  const tip = landmarks[INDEX_TIP];
  const pip = landmarks[INDEX_PIP];
  // In normalized coords, lower y = higher on screen.
  // Margin of 0.02 adds hysteresis to prevent flickering during fast movement.
  return tip.y < pip.y + 0.02;
}

/**
 * Smooth a point using exponential moving average.
 */
export function smoothPoint(prev: Point, current: Point, alpha: number): Point {
  return {
    x: prev.x * (1 - alpha) + current.x * alpha,
    y: prev.y * (1 - alpha) + current.y * alpha,
  };
}
