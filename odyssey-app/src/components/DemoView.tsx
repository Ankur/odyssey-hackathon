import { useRef, useState, useEffect, useCallback } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';
import { useDrawing } from '../hooks/useDrawing';
import { useOdysseyClient } from '../hooks/useOdysseyClient';
import { runPipeline } from '../lib/pipeline';
import { analyzeEditChanges } from '../lib/editPipeline';
import { exportCanvasAsDataUrl } from '../lib/canvasUtils';
import {
  getIndexTipPosition,
  isIndexFingerExtended,
  INDEX_TIP,
} from '../lib/handUtils';
import { SparkleSystem } from '../lib/sparkle';
import { COLOR_HOVER_COOLDOWN_MS } from '../constants';
import { WebcamCanvas } from './WebcamCanvas';
import { ColorPalette } from './ColorPalette';
import { GeneratingOverlay } from './GeneratingOverlay';
import frameImage from '../assets/frame.png';
import frameMask from '../assets/frame-mask.png';

export type DemoPhase = 'draw' | 'generating' | 'streaming' | 'editing';

interface DemoViewProps {
  isActive: boolean;
  onPhaseChange?: (phase: DemoPhase) => void;
}

export function DemoView({ isActive, onPhaseChange }: DemoViewProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const odysseyVideoRef = useRef<HTMLVideoElement>(null);
  const drawLoopRef = useRef<number>(0);
  const lastColorHoverTimeRef = useRef<number>(0);
  const sparkleRef = useRef(new SparkleSystem());
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // Phase state machine: draw → generating → streaming ⇄ editing
  const [phase, setPhase] = useState<DemoPhase>('draw');
  const phaseRef = useRef<DemoPhase>('draw');
  phaseRef.current = phase;

  // Drawing state (SPACE toggles between idle/active within draw and editing phases)
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const isDrawingActiveRef = useRef(false);
  isDrawingActiveRef.current = isDrawingActive;

  // Generation status
  const [generationStatus, setGenerationStatus] = useState('');

  // Edit phase state
  const [beforeImage, setBeforeImage] = useState<string | null>(null);

  // Loading indicator during re-imagine
  const [isReImagining, setIsReImagining] = useState(false);

  // Hooks (independent instances)
  const handTracking = useHandTracking(videoRef);
  const drawing = useDrawing(drawCanvasRef);
  const odyssey = useOdysseyClient();

  // Keep refs in sync for animation loop
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  // Notify parent of phase changes
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // --- Webcam management ---
  const stopWebcam = useCallback(() => {
    const stream = webcamStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startWebcam = useCallback(async () => {
    if (webcamStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      webcamStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('[Demo] Failed to access webcam:', err);
    }
  }, []);

  // Start/stop webcam based on isActive
  useEffect(() => {
    if (isActive) {
      startWebcam();
    } else {
      stopWebcam();
      handTracking.stopDetection();
    }
    return () => {
      stopWebcam();
    };
  }, [isActive, startWebcam, stopWebcam, handTracking.stopDetection]);

  // Re-attach webcam stream when video element changes (e.g. editing phase mounts new <video>)
  useEffect(() => {
    if (videoRef.current && webcamStreamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = webcamStreamRef.current;
    }
  }, [phase]);

  // Sync canvas dimensions when video metadata loads
  const handleVideoReady = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (drawCanvasRef.current) {
      drawCanvasRef.current.width = w;
      drawCanvasRef.current.height = h;
    }
    if (landmarkCanvasRef.current) {
      landmarkCanvasRef.current.width = w;
      landmarkCanvasRef.current.height = h;
    }
  }, []);

  // Start hand detection when ready
  useEffect(() => {
    if (handTracking.isReady && isActive) {
      handTracking.startDetection();
    }
    return () => handTracking.stopDetection();
  }, [handTracking.isReady, handTracking.startDetection, handTracking.stopDetection, isActive]);

  // Hover-based color selection
  const checkHoverColorSelection = useCallback(
    (landmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[]) => {
      const video = videoRef.current;
      if (!video) return;

      const videoRect = video.getBoundingClientRect();
      const tip = landmarks[INDEX_TIP];
      const tipX = videoRect.left + (1 - tip.x) * videoRect.width;
      const tipY = videoRect.top + tip.y * videoRect.height;

      const now = Date.now();
      const cooldownOk = now - lastColorHoverTimeRef.current >= COLOR_HOVER_COOLDOWN_MS;

      const swatches = document.querySelectorAll('.demo-view .swatch');
      let hoveredSwatch: Element | null = null;

      for (const swatch of swatches) {
        const rect = swatch.getBoundingClientRect();
        const padX = 40;
        const padY = 8;
        if (
          tipX >= rect.left - padX &&
          tipX <= rect.right + padX &&
          tipY >= rect.top - padY &&
          tipY <= rect.bottom + padY
        ) {
          hoveredSwatch = swatch;
          break;
        }
      }

      // Update finger-hover visual on all swatches
      for (const swatch of swatches) {
        swatch.classList.toggle('finger-hover', swatch === hoveredSwatch);
      }

      // Select color on hover
      if (hoveredSwatch && cooldownOk) {
        const color = (hoveredSwatch as HTMLElement).dataset.color;
        if (color && color !== drawingRef.current.color) {
          drawingRef.current.setColor(color);
          lastColorHoverTimeRef.current = now;
          hoveredSwatch.classList.add('hover-selected');
          setTimeout(() => hoveredSwatch!.classList.remove('hover-selected'), 300);
        }
      }
    },
    [],
  );

  // Main animation loop — runs during draw and editing phases
  useEffect(() => {
    function loop() {
      const currentPhase = phaseRef.current;
      const showCursor = currentPhase === 'draw' || currentPhase === 'editing';
      const isActive = isDrawingActiveRef.current;

      const result = handTracking.getLatestResult();
      const lmCanvas = landmarkCanvasRef.current;
      const d = drawingRef.current;
      const sparkle = sparkleRef.current;

      if (lmCanvas && showCursor) {
        const ctx = lmCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, lmCanvas.width, lmCanvas.height);

          if (result.landmarks) {
            const landmarks = result.landmarks;
            const indexTip = getIndexTipPosition(landmarks, lmCanvas.width, lmCanvas.height);
            const extended = isIndexFingerExtended(landmarks);

            sparkle.emit(indexTip.x, indexTip.y);

            // Brush size ring when actively drawing
            if (extended && isActive) {
              ctx.beginPath();
              ctx.arc(indexTip.x, indexTip.y, d.brushSize / 2 + 4, 0, Math.PI * 2);
              ctx.strokeStyle = d.color;
              ctx.lineWidth = 2;
              ctx.globalAlpha = 0.5;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }

            checkHoverColorSelection(landmarks);

            // Only draw strokes when drawing is active
            if (isActive) {
              d.processFrame(landmarks);
            }

            sparkle.drawCursor(ctx, indexTip.x, indexTip.y, d.color, extended);
          } else if (isActive) {
            d.processFrame(null);
          }

          sparkle.update();
          sparkle.draw(ctx, d.color);
        }
      } else {
        sparkle.update();
        if (lmCanvas) {
          const ctx = lmCanvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, lmCanvas.width, lmCanvas.height);
        }
      }

      drawLoopRef.current = requestAnimationFrame(loop);
    }

    drawLoopRef.current = requestAnimationFrame(loop);
    return () => {
      if (drawLoopRef.current) {
        cancelAnimationFrame(drawLoopRef.current);
      }
    };
  }, [handTracking.getLatestResult, checkHoverColorSelection]);

  // Track isActive in a ref for the keydown handler
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Spacebar handler — toggle drawing active/inactive during draw and editing phases
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      if (!isActiveRef.current) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const currentPhase = phaseRef.current;
      if (currentPhase !== 'draw' && currentPhase !== 'editing') return;

      e.preventDefault();
      e.stopImmediatePropagation();

      if (isDrawingActiveRef.current) {
        drawingRef.current.finalizeCurrentStroke();
        setIsDrawingActive(false);
      } else {
        setIsDrawingActive(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- "Imagine" click handler ---
  const handleImagine = useCallback(async () => {
    const d = drawingRef.current;
    d.finalizeCurrentStroke();

    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const allStrokes = d.getAllStrokes();
    if (allStrokes.length === 0) return;

    const sketchDataUrl = exportCanvasAsDataUrl(allStrokes, canvas.width, canvas.height);

    setPhase('generating');
    setIsDrawingActive(false);
    setGenerationStatus('Starting pipeline...');

    try {
      const result = await runPipeline(sketchDataUrl, setGenerationStatus);

      setGenerationStatus('Connecting to Odyssey...');
      const mediaStream = await odyssey.connect();
      if (odysseyVideoRef.current) {
        odysseyVideoRef.current.srcObject = mediaStream;
      }

      setGenerationStatus('Starting world stream...');
      await odyssey.startStream(result.odysseyPrompt, result.image);
      setPhase('streaming');
      setGenerationStatus('');
    } catch (err) {
      console.error('[Demo] Generation failed:', err);
      alert(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setPhase('draw');
      setGenerationStatus('');
    }
  }, [odyssey]);

  // --- "Edit" click handler ---
  const handleEdit = useCallback(() => {
    const video = odysseyVideoRef.current;
    if (!video || video.videoWidth === 0) return;

    // Capture current frame from Odyssey video
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const captured = captureCanvas.toDataURL('image/png');

    setBeforeImage(captured);
    drawing.clear();
    setIsDrawingActive(false);
    setPhase('editing');

    // Ensure canvas dimensions match the before image for proper overlay
    const img = new Image();
    img.onload = () => {
      if (drawCanvasRef.current) {
        drawCanvasRef.current.width = img.width;
        drawCanvasRef.current.height = img.height;
      }
      if (landmarkCanvasRef.current) {
        landmarkCanvasRef.current.width = img.width;
        landmarkCanvasRef.current.height = img.height;
      }
    };
    img.src = captured;
  }, [drawing]);

  // --- "Re-imagine" click handler ---
  const handleReImagine = useCallback(async () => {
    const d = drawingRef.current;
    d.finalizeCurrentStroke();

    if (!beforeImage) return;

    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const allStrokes = d.getAllStrokes();
    if (allStrokes.length === 0) return;

    setIsReImagining(true);

    try {
      // Composite beforeImage + edit strokes onto a single canvas
      const compositeCanvas = document.createElement('canvas');
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = beforeImage;
      });

      compositeCanvas.width = img.width;
      compositeCanvas.height = img.height;
      const ctx = compositeCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // Scale strokes from draw canvas dimensions to composite
      const scaleX = img.width / canvas.width;
      const scaleY = img.height / canvas.height;
      const scaledStrokes = allStrokes.map((s) => ({
        ...s,
        points: s.points.map((p) => ({
          x: p.x * scaleX,
          y: p.y * scaleY,
        })),
        width: s.width * Math.min(scaleX, scaleY),
      }));

      // Draw strokes on top of the before image
      for (const stroke of scaledStrokes) {
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }

      const afterImage = compositeCanvas.toDataURL('image/png');

      // Analyze the diff
      const interactPrompt = await analyzeEditChanges(beforeImage, afterImage);
      console.log('[Demo] Interact prompt:', interactPrompt);

      // Send interact to Odyssey
      await odyssey.interact(interactPrompt);

      drawing.clear();
      setIsDrawingActive(false);
      setPhase('streaming');
    } catch (err) {
      console.error('[Demo] Re-imagine failed:', err);
      alert(`Re-imagine failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsReImagining(false);
    }
  }, [beforeImage, odyssey, drawing]);

  // --- "Cancel" edit handler ---
  const handleCancelEdit = useCallback(() => {
    drawing.clear();
    setIsDrawingActive(false);
    setPhase('streaming');
  }, [drawing]);

  // --- Cancel generation handler ---
  const handleCancelGeneration = useCallback(() => {
    setPhase('draw');
    setGenerationStatus('');
  }, []);

  const hasStrokes = drawing.strokes.length > 0;

  return (
    <div className="demo-view">
      {/* ===== DRAW PHASE ===== */}
      {(phase === 'draw' || phase === 'editing') && (
        <>
          <ColorPalette
            selectedColor={drawing.color}
            onSelectColor={drawing.setColor}
            brushSize={drawing.brushSize}
            onBrushSizeChange={drawing.setBrushSize}
          />
        </>
      )}

      {/* Draw phase: webcam + canvas */}
      {phase === 'draw' && (
        <>
          <WebcamCanvas
            videoRef={videoRef}
            drawCanvasRef={drawCanvasRef}
            landmarkCanvasRef={landmarkCanvasRef}
            onVideoReady={handleVideoReady}
            error={handTracking.error}
          />

          <div className="demo-bottom-bar">
            <p className="demo-status-hint">
              {!isDrawingActive ? 'Press SPACE to draw' : 'Drawing — press SPACE to pause'}
            </p>
            <div className="demo-btn-row">
              {hasStrokes && (
                <>
                  <button className="control-btn" onClick={drawing.undo}>Undo</button>
                  <button className="control-btn" onClick={drawing.clear}>Clear</button>
                </>
              )}
              <button
                className="control-btn primary demo-imagine-btn"
                onClick={handleImagine}
                disabled={!hasStrokes}
              >
                Imagine
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===== GENERATING PHASE ===== */}
      {phase === 'generating' && (
        <GeneratingOverlay
          generationStatus={generationStatus}
          onCancel={handleCancelGeneration}
        />
      )}

      {/* ===== STREAMING PHASE ===== */}
      {/* Odyssey video stays mounted across streaming ⇄ editing to preserve stream */}
      {(phase === 'streaming' || phase === 'editing') && (
        <div className="demo-streaming" style={{ display: phase === 'streaming' ? undefined : 'none' }}>
          <div className="odyssey-frame-container">
            <video
              ref={odysseyVideoRef}
              autoPlay
              playsInline
              muted
              className="odyssey-video"
              style={{
                display: 'block',
                maskImage: `url(${frameMask})`,
                WebkitMaskImage: `url(${frameMask})`,
              }}
            />
            <img src={frameImage} className="odyssey-frame-overlay" alt="" />
          </div>
          <div className="demo-btn-row" style={{ marginTop: 16 }}>
            <button className="control-btn primary demo-edit-btn" onClick={handleEdit}>
              Edit
            </button>
          </div>
        </div>
      )}

      {/* ===== EDITING PHASE ===== */}
      {phase === 'editing' && (
        <>
          {/* Hidden video still feeds MediaPipe */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: 'absolute', visibility: 'hidden', width: 0, height: 0 }}
          />

          <div className="demo-edit-container">
            <div className="webcam-container">
              {/* Before image as background */}
              {beforeImage && (
                <img src={beforeImage} className="demo-before-image" alt="Before" />
              )}

              {/* Drawing overlay canvas */}
              <canvas ref={drawCanvasRef} className="draw-canvas" />

              {/* Landmark overlay canvas */}
              <canvas ref={landmarkCanvasRef} className="landmark-canvas" />
            </div>

            <div className="demo-bottom-bar">
              <p className="demo-status-hint">
                {isReImagining
                  ? 'Analyzing changes...'
                  : !isDrawingActive
                    ? 'Press SPACE to draw edits'
                    : 'Drawing edits — press SPACE to pause'}
              </p>
              <div className="demo-reimagine-row">
                <button className="control-btn" onClick={handleCancelEdit} disabled={isReImagining}>
                  Cancel
                </button>
                {hasStrokes && (
                  <>
                    <button className="control-btn" onClick={drawing.undo} disabled={isReImagining}>
                      Undo
                    </button>
                    <button className="control-btn" onClick={drawing.clear} disabled={isReImagining}>
                      Clear
                    </button>
                  </>
                )}
                <button
                  className="control-btn primary"
                  onClick={handleReImagine}
                  disabled={!hasStrokes || isReImagining}
                >
                  {isReImagining ? 'Re-imagining...' : 'Re-imagine'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
