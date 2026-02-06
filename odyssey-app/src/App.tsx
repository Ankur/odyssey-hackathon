import { useRef, useState, useEffect, useCallback } from 'react';
import type { AppState, TabId, PipelineResults } from './types';
import { COLOR_HOVER_COOLDOWN_MS } from './constants';
import { useHandTracking } from './hooks/useHandTracking';
import { useDrawing } from './hooks/useDrawing';
import { useOdysseyClient } from './hooks/useOdysseyClient';
import {
  runPipeline,
  analyzeSketchAndGeneratePrompt,
  generatePhotorealisticImage,
  generateOdysseyPrompt,
  analyzeImageForOdyssey,
} from './lib/pipeline';
import { analyzeEditChanges } from './lib/editPipeline';
import { exportCanvasAsDataUrl, drawPulseAnimation } from './lib/canvasUtils';
import { EDIT_SEED_IMAGE_DATA_URL } from './assets/editSeedImage';
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
import { EditView } from './components/EditView';
import frameImage from './assets/frame.png';
import frameMask from './assets/frame-mask.png';
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
  const generatingStartTimeRef = useRef<number>(0);

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

  // Edit tab state
  const [editPrompt, setEditPrompt] = useState<string | null>(null);
  const [isAnalyzingEdit, setIsAnalyzingEdit] = useState(false);
  const [editBeforeImage, setEditBeforeImage] = useState<string | null>(null);

  // Webcam state
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);

  // Hooks
  const handTracking = useHandTracking(videoRef);
  const drawing = useDrawing(drawCanvasRef);
  const odyssey = useOdysseyClient();

  // Keep a ref to drawing to avoid stale closures in animation loop
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  const stopWebcam = useCallback(() => {
    const stream = webcamStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  }, []);

  const startWebcam = useCallback(async () => {
    if (webcamStreamRef.current) {
      setIsCameraOn(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      webcamStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
    } catch (err) {
      console.error('Failed to access webcam:', err);
      alert('Unable to access the camera. Please check permissions and try again.');
    }
  }, []);

  // Start webcam
  useEffect(() => {
    startWebcam();
    return () => {
      stopWebcam();
    };
  }, [startWebcam, stopWebcam]);

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
      } else if (lmCanvas && state === 'GENERATING') {
        // Rainbow pulse animation on the draw tab during generation
        const ctx = lmCanvas.getContext('2d');
        if (ctx) {
          const allStrokes = d.getAllStrokes();
          drawPulseAnimation(ctx, allStrokes, generatingStartTimeRef.current);
        }
      } else {
        // Not showing cursor — clear landmark canvas and particles
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
    generatingStartTimeRef.current = performance.now();
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

  // Default World — use pre-existing image directly with Odyssey
  const handleDefaultWorld = useCallback(async () => {
    setAppState('GENERATING');
    setGenerationStatus('Loading default world image...');
    setPipelineResults(EMPTY_PIPELINE_RESULTS);

    try {
      // Fetch the default image and convert to data URL + File
      const res = await fetch('/default-world.png');
      const blob = await res.blob();
      const file = new File([blob], 'default-world.png', { type: blob.type });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      setPipelineResults((prev) => ({ ...prev, imageDataUrl: dataUrl }));

      // Analyze the image with Claude to generate an Odyssey prompt
      setGenerationStatus('Analyzing image with Claude...');
      const odysseyPrompt = await analyzeImageForOdyssey(dataUrl);
      console.log('[DefaultWorld] Odyssey prompt:', odysseyPrompt);
      setPipelineResults((prev) => ({ ...prev, odysseyPrompt }));

      // Connect to Odyssey and start streaming
      setGenerationStatus('Connecting to Odyssey...');
      const mediaStream = await odyssey.connect();
      if (odysseyVideoRef.current) {
        odysseyVideoRef.current.srcObject = mediaStream;
      }

      setGenerationStatus('Starting world stream...');
      await odyssey.startStream(odysseyPrompt, file);
      setAppState('STREAMING');
      setGenerationStatus('');
      setActiveTab('odyssey');
    } catch (err) {
      console.error('Default world failed:', err);
      alert(`Default world failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setAppState('IDLE');
      setGenerationStatus('');
      setActiveTab('webcam');
    }
  }, [odyssey]);

  const handleImagify = useCallback(async () => {
    const d = drawingRef.current;
    d.finalizeCurrentStroke();

    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const allStrokes = d.getAllStrokes();
    if (allStrokes.length === 0) return;

    const sketchDataUrl = exportCanvasAsDataUrl(allStrokes, canvas.width, canvas.height);

    setPipelineResults({ ...EMPTY_PIPELINE_RESULTS, sketchDataUrl });
    setActiveTab('pipeline');
    setAppState('GENERATING');
    setGenerationStatus('Imagifying sketch...');

    try {
      await runPipeline(sketchDataUrl, setGenerationStatus, (progress) => {
        setPipelineResults((prev) => ({
          ...prev,
          ...(progress.imagePrompt !== undefined && { imagePrompt: progress.imagePrompt }),
          ...(progress.imageDataUrl !== undefined && { imageDataUrl: progress.imageDataUrl }),
          ...(progress.odysseyPrompt !== undefined && { odysseyPrompt: progress.odysseyPrompt }),
        }));
      });
    } catch (err) {
      console.error('Imagify failed:', err);
      alert(`Imagify failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAppState('PAUSED');
      setGenerationStatus('');
    }
  }, [setActiveTab]);

  // Unload drawing to pipeline tab without running anything
  const handleUnloadDrawing = useCallback(() => {
    const d = drawingRef.current;
    d.finalizeCurrentStroke();

    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const allStrokes = d.getAllStrokes();
    if (allStrokes.length === 0) return;

    const sketchDataUrl = exportCanvasAsDataUrl(allStrokes, canvas.width, canvas.height);
    setPipelineResults({ ...EMPTY_PIPELINE_RESULTS, sketchDataUrl });
    setActiveTab('pipeline');
  }, [setActiveTab]);

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
    setEditBeforeImage(null);
    setEditPrompt(null);
  }, [odyssey, drawing]);

  const handleCancelGeneration = useCallback(() => {
    setAppState('PAUSED');
    setGenerationStatus('');
    setActiveTab('webcam');
  }, []);

  // Individual pipeline step handlers for manual triggering from PipelineView
  const handleRunAnalysis = useCallback(async () => {
    const sketchUrl = pipelineResults.sketchDataUrl;
    if (!sketchUrl) return;
    setGenerationStatus('Analyzing sketch with Claude...');
    setAppState('GENERATING');
    try {
      const imagePrompt = await analyzeSketchAndGeneratePrompt(sketchUrl);
      setPipelineResults((prev) => ({ ...prev, imagePrompt }));
    } catch (err) {
      alert(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGenerationStatus('');
      setAppState('PAUSED');
    }
  }, [pipelineResults.sketchDataUrl]);

  const handleRunImageGen = useCallback(async () => {
    const sketchUrl = pipelineResults.sketchDataUrl;
    const prompt = pipelineResults.imagePrompt;
    if (!sketchUrl || !prompt) return;
    setGenerationStatus('Generating photorealistic image...');
    setAppState('GENERATING');
    try {
      const result = await generatePhotorealisticImage(sketchUrl, prompt);
      setPipelineResults((prev) => ({ ...prev, imageDataUrl: result.dataUrl }));
    } catch (err) {
      alert(`Image generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGenerationStatus('');
      setAppState('PAUSED');
    }
  }, [pipelineResults.sketchDataUrl, pipelineResults.imagePrompt]);

  const handleRunOdysseyPrompt = useCallback(async () => {
    const prompt = pipelineResults.imagePrompt;
    if (!prompt) return;
    setGenerationStatus('Optimizing Odyssey prompt...');
    setAppState('GENERATING');
    try {
      const odysseyPrompt = await generateOdysseyPrompt(prompt);
      setPipelineResults((prev) => ({ ...prev, odysseyPrompt }));
    } catch (err) {
      alert(`Prompt generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGenerationStatus('');
      setAppState('PAUSED');
    }
  }, [pipelineResults.imagePrompt]);

  const handleEditAnalyze = useCallback(async (beforeUrl: string, afterUrl: string) => {
    setEditPrompt(null);
    setIsAnalyzingEdit(true);
    try {
      const prompt = await analyzeEditChanges(beforeUrl, afterUrl);
      setEditPrompt(prompt);
    } catch (err) {
      alert(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzingEdit(false);
    }
  }, []);

  const captureBeforeImage = useCallback((): string | null => {
    if (pipelineResults.imageDataUrl) return pipelineResults.imageDataUrl;
    if (pipelineResults.sketchDataUrl) return pipelineResults.sketchDataUrl;

    const video = videoRef.current;
    const drawCanvas = drawCanvasRef.current;

    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      const ctx = captureCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        if (drawCanvas) {
          ctx.drawImage(drawCanvas, 0, 0, captureCanvas.width, captureCanvas.height);
        }
        return captureCanvas.toDataURL('image/png');
      }
    }

    if (drawCanvas && drawCanvas.width > 0 && drawCanvas.height > 0) {
      return drawCanvas.toDataURL('image/png');
    }

    return EDIT_SEED_IMAGE_DATA_URL;
  }, [pipelineResults]);

  const handleStartEditing = useCallback(() => {
    const baseImage = captureBeforeImage();
    if (!baseImage) {
      alert('Unable to capture the current scene yet. Wait for the camera, sketch, or pipeline output to finish.');
      return;
    }
    setEditBeforeImage(baseImage);
    setEditPrompt(null);
    setIsAnalyzingEdit(false);
    setActiveTab('edit');
  }, [captureBeforeImage, setActiveTab]);

  const handleToggleCamera = useCallback(() => {
    if (isCameraOn) {
      stopWebcam();
    } else {
      startWebcam();
    }
  }, [isCameraOn, startWebcam, stopWebcam]);

  // Auto-capture before image when Edit tab is opened directly
  useEffect(() => {
    if (activeTab === 'edit' && !editBeforeImage) {
      const img = captureBeforeImage();
      if (img) {
        setEditBeforeImage(img);
      }
    }
  }, [activeTab, editBeforeImage, captureBeforeImage]);

  // Auto-load saved sketch into pipeline when pipeline tab is opened
  useEffect(() => {
    if (activeTab !== 'pipeline' || pipelineResults.sketchDataUrl) return;

    fetch('/api/load-sketch')
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data?.strokes?.length) return;
        const dataUrl = exportCanvasAsDataUrl(data.strokes, data.width, data.height);
        setPipelineResults((prev) => ({ ...prev, sketchDataUrl: dataUrl }));
      })
      .catch(() => {});
  }, [activeTab, pipelineResults.sketchDataUrl]);

  const canStartEditing = true;

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
            <div className="done-btn-row">
              <button className="done-btn" onClick={handleDone}>
                Done
              </button>
              <button className="done-btn imagify-btn" onClick={handleImagify}>
                Imagify
              </button>
            </div>
          )}

          {/* Default World button — visible in IDLE state */}
          {appState === 'IDLE' && (
            <div className="done-btn-row">
              <button className="done-btn" onClick={handleDefaultWorld}>
                Default World
              </button>
            </div>
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
            onUnloadDrawing={handleUnloadDrawing}
            onStartEditing={handleStartEditing}
            canStartEditing={canStartEditing}
            onToggleCamera={handleToggleCamera}
            isCameraOn={isCameraOn}
          />
        </div>

        {/* Pipeline tab */}
        <div className="tab-pane" style={{ display: activeTab === 'pipeline' ? 'block' : 'none' }}>
          <PipelineView
            appState={appState}
            generationStatus={generationStatus}
            results={pipelineResults}
            onCancel={handleCancelGeneration}
            onRunAnalysis={handleRunAnalysis}
            onRunImageGen={handleRunImageGen}
            onRunOdysseyPrompt={handleRunOdysseyPrompt}
          />
        </div>

        {/* Odyssey tab */}
        <div className="tab-pane odyssey-tab" style={{ display: activeTab === 'odyssey' ? 'block' : 'none' }}>
          <div className="odyssey-pane-content">
            <div className="odyssey-frame-container">
              {/* Video masked to frame interior */}
              <video
                ref={odysseyVideoRef}
                autoPlay
                playsInline
                muted
                className="odyssey-video"
                style={{
                  display: showOdysseyStream ? 'block' : 'none',
                  maskImage: `url(${frameMask})`,
                  WebkitMaskImage: `url(${frameMask})`,
                }}
              />

              {!showOdysseyStream && (
                <div className="odyssey-placeholder">
                  <p>No active stream. Draw something and run the pipeline first.</p>
                </div>
              )}

              {/* Frame overlay */}
              <img src={frameImage} className="odyssey-frame-overlay" alt="" />
            </div>

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

        {/* Edit tab */}
        <div className="tab-pane" style={{ display: activeTab === 'edit' ? 'block' : 'none' }}>
          <EditView
            interactPrompt={editPrompt}
            isAnalyzing={isAnalyzingEdit}
            beforeImage={editBeforeImage}
            onAnalyze={handleEditAnalyze}
            onPromptClear={() => setEditPrompt(null)}
          />
        </div>
      </div>
    </div>
  );
}
