export type AppState = 'IDLE' | 'DRAWING' | 'PAUSED' | 'GENERATING' | 'STREAMING';

export type TabId = 'webcam' | 'pipeline' | 'odyssey' | 'edit' | 'demo';

export interface PipelineResults {
  sketchDataUrl: string | null;
  imagePrompt: string | null;
  imageDataUrl: string | null;
  odysseyPrompt: string | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}
