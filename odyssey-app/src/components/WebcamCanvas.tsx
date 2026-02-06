import type { RefObject } from 'react';

interface WebcamCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  drawCanvasRef: RefObject<HTMLCanvasElement | null>;
  landmarkCanvasRef: RefObject<HTMLCanvasElement | null>;
  odysseyVideoRef: RefObject<HTMLVideoElement | null>;
  showWebcam: boolean;
  showOdyssey: boolean;
  onVideoReady: () => void;
  error?: string | null;
}

export function WebcamCanvas({
  videoRef,
  drawCanvasRef,
  landmarkCanvasRef,
  odysseyVideoRef,
  showWebcam,
  showOdyssey,
  onVideoReady,
  error,
}: WebcamCanvasProps) {
  return (
    <div className="webcam-container">
      {/* Webcam feed (mirrored via CSS) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="webcam-video"
        onLoadedData={onVideoReady}
        style={{ display: showWebcam ? 'block' : 'none' }}
      />

      {/* Drawing overlay canvas */}
      <canvas
        ref={drawCanvasRef}
        className="draw-canvas"
        style={{ display: showWebcam ? 'block' : 'none' }}
      />

      {/* Hand landmark overlay canvas */}
      <canvas
        ref={landmarkCanvasRef}
        className="landmark-canvas"
        style={{ display: showWebcam ? 'block' : 'none' }}
      />

      {/* Odyssey stream output */}
      <video
        ref={odysseyVideoRef}
        autoPlay
        playsInline
        muted
        className="odyssey-video"
        style={{ display: showOdyssey ? 'block' : 'none' }}
      />

      {error && <div className="tracking-error">{error}</div>}
    </div>
  );
}
