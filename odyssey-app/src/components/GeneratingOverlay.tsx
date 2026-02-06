interface GeneratingOverlayProps {
  generationStatus: string;
  onCancel: () => void;
}

export function GeneratingOverlay({ generationStatus, onCancel }: GeneratingOverlayProps) {
  return (
    <div className="prompt-overlay">
      <div className="prompt-card">
        <h2>Creating your world</h2>
        <p className="prompt-hint">
          Claude is analyzing your sketch and generating a photorealistic version
          with NanoBanana before Odyssey brings it to life.
        </p>
        {generationStatus && (
          <div className="generation-status">
            <span className="generation-spinner" />
            {generationStatus}
          </div>
        )}
        <div className="prompt-actions">
          <button type="button" className="control-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
