export type AppState = 'IDLE' | 'DRAWING' | 'PAUSED' | 'GENERATING' | 'STREAMING';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}
