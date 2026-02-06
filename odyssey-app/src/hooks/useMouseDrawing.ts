import { useRef, useCallback, useState, useEffect } from 'react';
import type { Stroke, Point } from '../types';
import { DEFAULT_COLOR, DEFAULT_BRUSH_SIZE } from '../constants';
import { drawSegment } from '../lib/canvasUtils';

/**
 * Mouse-based drawing hook for the Edit tab.
 * Modeled after useDrawing but uses mouse events instead of hand tracking.
 */
export function useMouseDrawing(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onRedrawNeeded: () => void,
) {
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  // Refs for color/brushSize to avoid recreating event handlers
  const colorRef = useRef(color);
  const brushSizeRef = useRef(brushSize);
  const onRedrawNeededRef = useRef(onRedrawNeeded);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { onRedrawNeededRef.current = onRedrawNeeded; }, [onRedrawNeeded]);

  const updateStrokes = useCallback((newStrokes: Stroke[]) => {
    strokesRef.current = newStrokes;
    setStrokes(newStrokes);
  }, []);

  const getMousePos = useCallback(
    (e: MouseEvent): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    },
    [canvasRef],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleMouseDown(e: MouseEvent) {
      const pos = getMousePos(e);
      if (!pos) return;
      isDrawingRef.current = true;
      currentStrokeRef.current = {
        points: [pos],
        color: colorRef.current,
        width: brushSizeRef.current,
      };
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;
      const pos = getMousePos(e);
      if (!pos) return;

      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      const prev = currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1];
      currentStrokeRef.current.points.push(pos);
      drawSegment(ctx, prev, pos, currentStrokeRef.current.color, currentStrokeRef.current.width);
    }

    function handleMouseUp() {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (currentStrokeRef.current && currentStrokeRef.current.points.length >= 2) {
        const newStrokes = [...strokesRef.current, currentStrokeRef.current];
        strokesRef.current = newStrokes;
        setStrokes(newStrokes);
        onRedrawNeededRef.current();
      }
      currentStrokeRef.current = null;
    }

    function handleMouseLeave() {
      handleMouseUp();
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [canvasRef, getMousePos]);

  const undo = useCallback(() => {
    const newStrokes = strokesRef.current.slice(0, -1);
    updateStrokes(newStrokes);
    onRedrawNeededRef.current();
  }, [updateStrokes]);

  const clear = useCallback(() => {
    updateStrokes([]);
    currentStrokeRef.current = null;
    onRedrawNeededRef.current();
  }, [updateStrokes]);

  const getAllStrokes = useCallback((): Stroke[] => {
    return [...strokesRef.current];
  }, []);

  return {
    color,
    setColor,
    brushSize,
    setBrushSize,
    strokes,
    undo,
    clear,
    getAllStrokes,
  };
}
