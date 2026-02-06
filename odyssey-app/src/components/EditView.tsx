import { useRef, useCallback, useEffect } from 'react';
import { EXPORT_WIDTH, EXPORT_HEIGHT } from '../constants';
import { useMouseDrawing } from '../hooks/useMouseDrawing';
import { ColorPalette } from './ColorPalette';
import type { Point } from '../types';

interface EditViewProps {
  interactPrompt: string | null;
  isAnalyzing: boolean;
  beforeImage: string | null;
  onAnalyze: (beforeUrl: string, afterUrl: string) => void;
  onPromptClear: () => void;
}

export function EditView({
  interactPrompt,
  isAnalyzing,
  beforeImage,
  onAnalyze,
  onPromptClear,
}: EditViewProps) {
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);

  // Composites background + strokes onto the main canvas
  const redrawCanvas = useCallback(() => {
    const canvas = editCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (backgroundRef.current) {
      ctx.drawImage(backgroundRef.current, 0, 0);
    }

    // Draw all strokes using bezier smoothing (same as canvasUtils.redrawStrokes but without clearRect)
    const allStrokes = mouseDrawing.getAllStrokes();
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;

      ctx.strokeStyle = stroke.color;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mouseDrawing = useMouseDrawing(editCanvasRef, redrawCanvas);

  // Initialize canvas dimensions once
  useEffect(() => {
    const canvas = editCanvasRef.current;
    if (!canvas) return;
    canvas.width = EXPORT_WIDTH;
    canvas.height = EXPORT_HEIGHT;
  }, []);

  // Load the captured before image whenever it changes
  useEffect(() => {
    const canvas = editCanvasRef.current;
    if (!canvas) return;

    if (!beforeImage) {
      backgroundRef.current = null;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      mouseDrawing.clear();
      return;
    }

    const img = new Image();
    img.onload = () => {
      const bg = document.createElement('canvas');
      bg.width = EXPORT_WIDTH;
      bg.height = EXPORT_HEIGHT;
      const bgCtx = bg.getContext('2d');
      if (!bgCtx) return;
      bgCtx.drawImage(img, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
      backgroundRef.current = bg;
      mouseDrawing.clear();
    };
    img.src = beforeImage;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beforeImage]);

  const handleAnalyze = useCallback(() => {
    if (!beforeImage) return;

    // Ensure the composite canvas is up to date
    redrawCanvas();

    // After image: current canvas state (scene + drawings)
    const canvas = editCanvasRef.current;
    if (!canvas) return;
    const afterUrl = canvas.toDataURL('image/png');

    onAnalyze(beforeImage, afterUrl);
  }, [beforeImage, onAnalyze, redrawCanvas]);

  const handleClear = useCallback(() => {
    mouseDrawing.clear();
    onPromptClear();
  }, [mouseDrawing, onPromptClear]);

  const hasBeforeImage = Boolean(beforeImage);
  const hasStrokes = mouseDrawing.strokes.length > 0;
  const canAnalyze = hasBeforeImage && hasStrokes;

  return (
    <div className="edit-view">
      <ColorPalette
        selectedColor={mouseDrawing.color}
        onSelectColor={mouseDrawing.setColor}
        brushSize={mouseDrawing.brushSize}
        onBrushSizeChange={mouseDrawing.setBrushSize}
      />

      <div className="edit-content">
        <div className="edit-canvas-container">
          <canvas
            ref={editCanvasRef}
            className="edit-canvas"
            style={{ pointerEvents: hasBeforeImage ? 'auto' : 'none', opacity: hasBeforeImage ? 1 : 0.5 }}
          />
          <div className="edit-canvas-controls">
            <button className="control-btn" onClick={handleClear} disabled={!hasBeforeImage || isAnalyzing}>
              Clear
            </button>
            <button
              className="control-btn"
              onClick={mouseDrawing.undo}
              disabled={!hasBeforeImage || !hasStrokes || isAnalyzing}
            >
              Undo
            </button>
            <button
              className="control-btn primary"
              onClick={handleAnalyze}
              disabled={!canAnalyze || isAnalyzing}
            >
              Analyze Changes
            </button>
          </div>
          {!hasBeforeImage && (
            <p className="edit-output-placeholder" style={{ marginTop: '0.5rem' }}>
              Click &quot;Start Editing&quot; in the Draw tab to capture a scene before drawing.
            </p>
          )}
        </div>

        <div className="edit-output-container">
          <h3 className="edit-output-title">Generated Interact Prompt</h3>
          <div className="edit-output-box">
            {isAnalyzing ? (
              <div className="edit-output-loading">
                <div className="generation-spinner" />
                <span>Analyzing changes...</span>
              </div>
            ) : interactPrompt ? (
              <p className="edit-output-text">{interactPrompt}</p>
            ) : (
              <p className="edit-output-placeholder">
                Draw changes on the captured scene, then click "Analyze Changes" to generate an interact prompt.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
