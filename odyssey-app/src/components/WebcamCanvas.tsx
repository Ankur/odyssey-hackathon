import type { RefObject } from 'react';

interface WebcamCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  drawCanvasRef: RefObject<HTMLCanvasElement | null>;
  landmarkCanvasRef: RefObject<HTMLCanvasElement | null>;
  onVideoReady: () => void;
  error?: string | null;
}

export function WebcamCanvas({
  videoRef,
  drawCanvasRef,
  landmarkCanvasRef,
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
      />

      {/* Drawing overlay canvas */}
      <canvas
        ref={drawCanvasRef}
        className="draw-canvas"
      />

      {/* Hand landmark overlay canvas */}
      <canvas
        ref={landmarkCanvasRef}
        className="landmark-canvas"
      />

      {error && <div className="tracking-error">{error}</div>}
    </div>
  );
}
