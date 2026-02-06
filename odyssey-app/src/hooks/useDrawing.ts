import { useRef, useCallback, useState } from 'react';
import type { Stroke, Point } from '../types';
import { DEFAULT_COLOR, DEFAULT_BRUSH_SIZE, SMOOTHING_ALPHA, MAX_LOST_FRAMES } from '../constants';
import { redrawStrokes, drawSegment } from '../lib/canvasUtils';
import {
  getIndexTipPosition,
  isIndexFingerExtended,
  smoothPoint,
  isPinching,
} from '../lib/handUtils';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export function useDrawing(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  const currentStrokeRef = useRef<Stroke | null>(null);
  const smoothedPosRef = useRef<Point | null>(null);
  const lostFramesRef = useRef(0);
  const strokesRef = useRef<Stroke[]>([]);

  // Keep ref in sync with state
  const updateStrokes = useCallback((newStrokes: Stroke[]) => {
    strokesRef.current = newStrokes;
    setStrokes(newStrokes);
  }, []);

  /**
   * Process a single frame during drawing mode.
   * Returns true if drawing occurred this frame.
   */
  const processFrame = useCallback(
    (landmarks: NormalizedLandmark[] | null): boolean => {
      const canvas = canvasRef.current;
      if (!canvas) return false;

      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      // If no hand detected or index finger not extended, track lost frames
      if (!landmarks || !isIndexFingerExtended(landmarks) || isPinching(landmarks)) {
        lostFramesRef.current++;
        if (lostFramesRef.current >= MAX_LOST_FRAMES && currentStrokeRef.current) {
          // Finalize the current stroke
          if (currentStrokeRef.current.points.length >= 2) {
            updateStrokes([...strokesRef.current, currentStrokeRef.current]);
          }
          currentStrokeRef.current = null;
          smoothedPosRef.current = null;
        }
        return false;
      }

      lostFramesRef.current = 0;

      // Get fingertip position (mirrored)
      const rawPos = getIndexTipPosition(landmarks, canvas.width, canvas.height);

      // Apply smoothing
      const pos = smoothedPosRef.current
        ? smoothPoint(smoothedPosRef.current, rawPos, SMOOTHING_ALPHA)
        : rawPos;
      smoothedPosRef.current = pos;

      if (!currentStrokeRef.current) {
        // Start a new stroke
        currentStrokeRef.current = {
          points: [pos],
          color,
          width: brushSize,
        };
      } else {
        const prev = currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1];
        currentStrokeRef.current.points.push(pos);
        drawSegment(ctx, prev, pos, currentStrokeRef.current.color, currentStrokeRef.current.width);
      }

      return true;
    },
    [canvasRef, color, brushSize, updateStrokes],
  );

  /**
   * Finalize any in-progress stroke (called when exiting drawing mode).
   */
  const finalizeCurrentStroke = useCallback(() => {
    if (currentStrokeRef.current && currentStrokeRef.current.points.length >= 2) {
      updateStrokes([...strokesRef.current, currentStrokeRef.current]);
    }
    currentStrokeRef.current = null;
    smoothedPosRef.current = null;
    lostFramesRef.current = 0;
  }, [updateStrokes]);

  /**
   * Undo the last completed stroke.
   */
  const undo = useCallback(() => {
    const newStrokes = strokesRef.current.slice(0, -1);
    updateStrokes(newStrokes);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    redrawStrokes(ctx, newStrokes);
  }, [canvasRef, updateStrokes]);

  /**
   * Clear all strokes.
   */
  const clear = useCallback(() => {
    updateStrokes([]);
    currentStrokeRef.current = null;
    smoothedPosRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef, updateStrokes]);

  /**
   * Get all strokes (completed + current in-progress).
   */
  const getAllStrokes = useCallback((): Stroke[] => {
    const all = [...strokesRef.current];
    if (currentStrokeRef.current && currentStrokeRef.current.points.length >= 2) {
      all.push(currentStrokeRef.current);
    }
    return all;
  }, []);

  /**
   * Load strokes from an external source and redraw the canvas.
   */
  const loadStrokes = useCallback(
    (loaded: Stroke[], sourceWidth: number, sourceHeight: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Scale strokes from saved dimensions to current canvas dimensions
      const scaleX = canvas.width / sourceWidth;
      const scaleY = canvas.height / sourceHeight;

      const scaled: Stroke[] = loaded.map((s) => ({
        ...s,
        points: s.points.map((p) => ({
          x: p.x * scaleX,
          y: p.y * scaleY,
        })),
        width: s.width * Math.min(scaleX, scaleY),
      }));

      updateStrokes(scaled);
      currentStrokeRef.current = null;
      smoothedPosRef.current = null;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        redrawStrokes(ctx, scaled);
      }
    },
    [canvasRef, updateStrokes],
  );

  return {
    color,
    setColor,
    brushSize,
    setBrushSize,
    strokes,
    processFrame,
    finalizeCurrentStroke,
    undo,
    clear,
    getAllStrokes,
    loadStrokes,
  };
}
