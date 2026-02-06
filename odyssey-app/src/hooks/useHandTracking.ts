import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

export interface HandTrackingResult {
  landmarks: NormalizedLandmark[] | null; // 21 landmarks for first detected hand
}

export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HandTrackingResult>({ landmarks: null });
  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(-1);

  // Initialize MediaPipe
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        );

        if (cancelled) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        handLandmarkerRef.current = landmarker;
        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to initialize hand tracking:', err);
          setError('Failed to initialize hand tracking. Check console for details.');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
    };
  }, []);

  // Detection loop
  const startDetection = useCallback(() => {
    const video = videoRef.current;
    const landmarker = handLandmarkerRef.current;

    if (!video || !landmarker) return;

    function detect() {
      const video = videoRef.current;
      const landmarker = handLandmarkerRef.current;

      if (!video || !landmarker || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const now = performance.now();
      // Avoid sending the same timestamp twice
      if (now <= lastTimestampRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      lastTimestampRef.current = now;

      try {
        const results = landmarker.detectForVideo(video, now);
        if (results.landmarks && results.landmarks.length > 0) {
          resultRef.current = { landmarks: results.landmarks[0] };
        } else {
          resultRef.current = { landmarks: null };
        }
      } catch {
        // Detection can occasionally fail on a frame, just skip
      }

      animFrameRef.current = requestAnimationFrame(detect);
    }

    animFrameRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  const stopDetection = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  // Get the latest detection result (called from the drawing loop)
  const getLatestResult = useCallback((): HandTrackingResult => {
    return resultRef.current;
  }, []);

  return { isReady, error, startDetection, stopDetection, getLatestResult };
}
