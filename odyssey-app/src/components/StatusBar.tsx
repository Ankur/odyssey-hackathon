import type { AppState } from '../types';

interface StatusBarProps {
  appState: AppState;
  handTrackingReady: boolean;
  onClear: () => void;
  onUndo: () => void;
  onSaveSketch: () => void;
  onLoadSketch: () => void;
}

const STATUS_MESSAGES: Record<AppState, string> = {
  IDLE: 'Press SPACE to start drawing',
  DRAWING: 'Drawing... Press SPACE to pause',
  PAUSED: 'Paused — Press SPACE to resume drawing',
  GENERATING: 'Creating your world...',
  STREAMING: 'Your world is live! Type to interact',
};

export function StatusBar({
  appState,
  handTrackingReady,
  onClear,
  onUndo,
  onSaveSketch,
  onLoadSketch,
}: StatusBarProps) {
  const inDrawMode = appState === 'DRAWING' || appState === 'PAUSED' || appState === 'IDLE';

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`tracking-indicator ${handTrackingReady ? 'ready' : ''}`} />
        <span className="status-text">
          {!handTrackingReady ? 'Loading hand tracking...' : STATUS_MESSAGES[appState]}
        </span>
      </div>

      {inDrawMode && (
        <div className="status-right">
          <button className="control-btn" onClick={onLoadSketch} title="Load saved sketch">
            Load
          </button>
          <button className="control-btn" onClick={onSaveSketch} title="Save current sketch">
            Save
          </button>
          <button className="control-btn" onClick={onUndo} title="Undo last stroke">
            Undo
          </button>
          <button className="control-btn" onClick={onClear} title="Clear drawing">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
