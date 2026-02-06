import { useRef, useState, useEffect, useCallback } from 'react';
import type { AppState, TabId, PipelineResults } from './types';
import { COLOR_HOVER_COOLDOWN_MS } from './constants';
import { useHandTracking } from './hooks/useHandTracking';
import { useDrawing } from './hooks/useDrawing';
import { useOdysseyClient } from './hooks/useOdysseyClient';
import { runPipeline } from './lib/pipeline';
import { exportCanvasAsDataUrl } from './lib/canvasUtils';
import {
  getIndexTipPosition,
  isIndexFingerExtended,
  INDEX_TIP,
} from './lib/handUtils';
import { SparkleSystem } from './lib/sparkle';
import { WebcamCanvas } from './components/WebcamCanvas';
import { ColorPalette } from './components/ColorPalette';
import { StatusBar } from './components/StatusBar';
import { TabBar } from './components/TabBar';
import { PipelineView } from './components/PipelineView';
import { StreamingControls } from './components/StreamingControls';
import './App.css';

const EMPTY_PIPELINE_RESULTS: PipelineResults = {
  sketchDataUrl: null,
  imagePrompt: null,
  imageDataUrl: null,
  odysseyPrompt: null,
};

export default function App() {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const odysseyVideoRef = useRef<HTMLVideoElement>(null);
  const drawLoopRef = useRef<number>(0);
  const lastColorHoverTimeRef = useRef<number>(0);
  const sparkleRef = useRef(new SparkleSystem());

  // App state
  const [appState, setAppState] = useState<AppState>('IDLE');
  const appStateRef = useRef<AppState>('IDLE');
  appStateRef.current = appState;

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('webcam');

  // Pipeline results for progressive display
  const [pipelineResults, setPipelineResults] = useState<PipelineResults>(EMPTY_PIPELINE_RESULTS);

  // Generation status for the pipeline steps
  const [generationStatus, setGenerationStatus] = useState('');

  // Hooks
  const handTracking = useHandTracking(videoRef);
  const drawing = useDrawing(drawCanvasRef);
  const odyssey = useOdysseyClient();

  // Keep a ref to drawing to avoid stale closures in animation loop
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  // Start webcam
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to access webcam:', err);
      }
    }

    startWebcam();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

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
    if (handTracking.isReady) {
      handTracking.startDetection();
    }
    return () => handTracking.stopDetection();
  }, [handTracking.isReady, handTracking.startDetection, handTracking.stopDetection]);

  // Hover-based color selection
  const checkHoverColorSelection = useCallback(
    (landmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[]) => {
      const now = Date.now();
      if (now - lastColorHoverTimeRef.current < COLOR_HOVER_COOLDOWN_MS) return;

      const video = videoRef.current;
      if (!video) return;

      const videoRect = video.getBoundingClientRect();
      const tip = landmarks[INDEX_TIP];

      // Fingertip position in viewport coordinates (mirrored to match selfie view)
      const tipX = videoRect.left + (1 - tip.x) * videoRect.width;
      const tipY = videoRect.top + tip.y * videoRect.height;

      const swatches = document.querySelectorAll('.swatch');
      for (const swatch of swatches) {
        const rect = swatch.getBoundingClientRect();
        const pad = 8;
        if (
          tipX >= rect.left - pad &&
          tipX <= rect.right + pad &&
          tipY >= rect.top - pad &&
          tipY <= rect.bottom + pad
        ) {
          const color = (swatch as HTMLElement).dataset.color;
          if (color && color !== drawingRef.current.color) {
            drawingRef.current.setColor(color);
            lastColorHoverTimeRef.current = now;
            swatch.classList.add('hover-selected');
            setTimeout(() => swatch.classList.remove('hover-selected'), 300);
          }
          break;
        }
      }
    },
    [],
  );

  // Main animation loop
  useEffect(() => {
    function loop() {
      const result = handTracking.getLatestResult();
      const lmCanvas = landmarkCanvasRef.current;
      const state = appStateRef.current;
      const d = drawingRef.current;

      const showCursor = state === 'IDLE' || state === 'DRAWING' || state === 'PAUSED';

      const sparkle = sparkleRef.current;

      if (lmCanvas && showCursor) {
        const ctx = lmCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, lmCanvas.width, lmCanvas.height);

          if (result.landmarks) {
            const landmarks = result.landmarks;
            const indexTip = getIndexTipPosition(landmarks, lmCanvas.width, lmCanvas.height);
            const extended = isIndexFingerExtended(landmarks);

            // Emit trail points from fingertip
            sparkle.emit(indexTip.x, indexTip.y);

            // Brush size ring when actively drawing
            if (extended && state === 'DRAWING') {
              ctx.beginPath();
              ctx.arc(indexTip.x, indexTip.y, d.brushSize / 2 + 4, 0, Math.PI * 2);
              ctx.strokeStyle = d.color;
              ctx.lineWidth = 2;
              ctx.globalAlpha = 0.5;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }

            // Hover color selection
            if (showCursor) {
              checkHoverColorSelection(landmarks);
            }

            // Only draw strokes when in DRAWING state
            if (state === 'DRAWING') {
              d.processFrame(landmarks);
            }

            // Draw sparkle cursor on top
            sparkle.drawCursor(ctx, indexTip.x, indexTip.y, d.color, extended);
          } else if (state === 'DRAWING') {
            d.processFrame(null);
          }

          // Update and draw trail every frame (even without hand)
          sparkle.update();
          sparkle.draw(ctx, d.color);
        }
      } else {
        // Not showing cursor — clear particles
        sparkle.update();
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

  // Spacebar handler — toggles drawing on/off
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      e.preventDefault();

      const state = appStateRef.current;
      if (state === 'IDLE') {
        setAppState('DRAWING');
      } else if (state === 'DRAWING') {
        drawingRef.current.finalizeCurrentStroke();
        setAppState('PAUSED');
      } else if (state === 'PAUSED') {
        setAppState('DRAWING');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Done — finalize sketch, export, and start generation pipeline
  const handleDone = useCallback(async () => {
    const d = drawingRef.current;
    d.finalizeCurrentStroke();

    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    // Export sketch as base64 data URL for the pipeline
    const allStrokes = d.getAllStrokes();
    if (allStrokes.length === 0) return;

    const sketchDataUrl = exportCanvasAsDataUrl(allStrokes, canvas.width, canvas.height);

    // Reset pipeline results and store sketch immediately
    setPipelineResults({ ...EMPTY_PIPELINE_RESULTS, sketchDataUrl });
    setActiveTab('pipeline');
    setAppState('GENERATING');
    setGenerationStatus('Starting pipeline...');

    try {
      // Run the Claude + NanoBanana pipeline with progress callback
      const result = await runPipeline(sketchDataUrl, setGenerationStatus, (progress) => {
        setPipelineResults((prev) => ({
          ...prev,
          ...(progress.imagePrompt !== undefined && { imagePrompt: progress.imagePrompt }),
          ...(progress.imageDataUrl !== undefined && { imageDataUrl: progress.imageDataUrl }),
          ...(progress.odysseyPrompt !== undefined && { odysseyPrompt: progress.odysseyPrompt }),
        }));
      });

      // Connect to Odyssey and stream the photorealistic image
      setGenerationStatus('Connecting to Odyssey...');
      const mediaStream = await odyssey.connect();
      if (odysseyVideoRef.current) {
        odysseyVideoRef.current.srcObject = mediaStream;
      }

      setGenerationStatus('Starting world stream...');
      await odyssey.startStream(result.odysseyPrompt, result.image);
      setAppState('STREAMING');
      setGenerationStatus('');
      setActiveTab('odyssey');

      // Save session artifacts in the background
      fetch('/api/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sketchDataUrl,
          imagePrompt: result.imagePrompt,
          photorealisticDataUrl: result.imageDataUrl,
          odysseyPrompt: result.odysseyPrompt,
        }),
      }).catch((err) => console.warn('[Session] Save failed:', err));
    } catch (err) {
      console.error('Generation failed:', err);
      alert(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setAppState('PAUSED');
      setGenerationStatus('');
      setActiveTab('webcam');
    }
  }, [odyssey]);

  const handleInteract = useCallback(
    async (prompt: string) => {
      try {
        await odyssey.interact(prompt);
      } catch (err) {
        console.error('Interaction failed:', err);
      }
    },
    [odyssey],
  );

  const handleEndStream = useCallback(async () => {
    try {
      await odyssey.endStream();
    } catch (err) {
      console.error('End stream failed:', err);
    }
    odyssey.disconnect();
    setAppState('IDLE');
  }, [odyssey]);

  const handleNewDrawing = useCallback(async () => {
    try {
      await odyssey.endStream();
    } catch {
      // ignore
    }
    odyssey.disconnect();
    drawing.clear();
    setPipelineResults(EMPTY_PIPELINE_RESULTS);
    setAppState('IDLE');
    setActiveTab('webcam');
  }, [odyssey, drawing]);

  const handleCancelGeneration = useCallback(() => {
    setAppState('PAUSED');
    setGenerationStatus('');
    setActiveTab('webcam');
  }, []);

  // Save current sketch strokes to disk
  const handleSaveSketch = useCallback(async () => {
    const d = drawingRef.current;
    d.finalizeCurrentStroke();
    const allStrokes = d.getAllStrokes();
    if (allStrokes.length === 0) return;

    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    try {
      await fetch('/api/save-sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strokes: allStrokes,
          width: canvas.width,
          height: canvas.height,
        }),
      });
      console.log('[Sketch] Saved');
    } catch (err) {
      console.error('[Sketch] Save failed:', err);
    }
  }, []);

  // Load saved sketch strokes from disk
  const handleLoadSketch = useCallback(async () => {
    try {
      const res = await fetch('/api/load-sketch');
      if (!res.ok) {
        if (res.status === 404) alert('No saved sketch found');
        return;
      }
      const data = await res.json();
      drawingRef.current.loadStrokes(data.strokes, data.width, data.height);
      if (appStateRef.current === 'IDLE') {
        setAppState('PAUSED');
      }
      console.log('[Sketch] Loaded', data.strokes.length, 'strokes');
    } catch (err) {
      console.error('[Sketch] Load failed:', err);
    }
  }, []);

  const inDrawMode = appState === 'IDLE' || appState === 'DRAWING' || appState === 'PAUSED';
  const showOdysseyStream = appState === 'STREAMING';

  return (
    <div className="app">
      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} appState={appState} />

      <div className="tab-content">
        {/* Draw tab */}
        <div className="tab-pane" style={{ display: activeTab === 'webcam' ? 'block' : 'none' }}>
          {/* Color palette */}
          {inDrawMode && (
            <ColorPalette
              selectedColor={drawing.color}
              onSelectColor={drawing.setColor}
              brushSize={drawing.brushSize}
              onBrushSizeChange={drawing.setBrushSize}
            />
          )}

          {/* Done button — top right */}
          {(appState === 'DRAWING' || appState === 'PAUSED') && (
            <button className="done-btn" onClick={handleDone}>
              Done
            </button>
          )}

          {/* Webcam + drawing canvas */}
          <WebcamCanvas
            videoRef={videoRef}
            drawCanvasRef={drawCanvasRef}
            landmarkCanvasRef={landmarkCanvasRef}
            onVideoReady={handleVideoReady}
            error={handTracking.error}
          />

          {/* Status bar */}
          <StatusBar
            appState={appState}
            handTrackingReady={handTracking.isReady}
            onClear={drawing.clear}
            onUndo={drawing.undo}
            onSaveSketch={handleSaveSketch}
            onLoadSketch={handleLoadSketch}
          />
        </div>

        {/* Pipeline tab */}
        <div className="tab-pane" style={{ display: activeTab === 'pipeline' ? 'block' : 'none' }}>
          <PipelineView
            appState={appState}
            generationStatus={generationStatus}
            results={pipelineResults}
            onCancel={handleCancelGeneration}
          />
        </div>

        {/* Odyssey tab */}
        <div className="tab-pane" style={{ display: activeTab === 'odyssey' ? 'block' : 'none' }}>
          <div className="odyssey-pane-content">
            {/* Odyssey stream video */}
            <video
              ref={odysseyVideoRef}
              autoPlay
              playsInline
              muted
              className="odyssey-video"
              style={{ display: showOdysseyStream ? 'block' : 'none' }}
            />

            {!showOdysseyStream && (
              <div className="odyssey-placeholder">
                <p>No active stream. Draw something and run the pipeline first.</p>
              </div>
            )}

            {/* Streaming controls */}
            {appState === 'STREAMING' && (
              <StreamingControls
                onInteract={handleInteract}
                onEndStream={handleEndStream}
                onNewDrawing={handleNewDrawing}
                odysseyStatus={odyssey.status}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
