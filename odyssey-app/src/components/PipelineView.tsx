import type { AppState, PipelineResults } from '../types';

interface PipelineViewProps {
  appState: AppState;
  generationStatus: string;
  results: PipelineResults;
  onCancel: () => void;
  onRunAnalysis: () => void;
  onRunImageGen: () => void;
  onRunOdysseyPrompt: () => void;
}

export function PipelineView({
  appState,
  generationStatus,
  results,
  onCancel,
  onRunAnalysis,
  onRunImageGen,
  onRunOdysseyPrompt,
}: PipelineViewProps) {
  const isGenerating = appState === 'GENERATING';
  const hasAnyResult =
    results.sketchDataUrl || results.imagePrompt || results.imageDataUrl || results.odysseyPrompt;

  return (
    <div className="pipeline-view">
      {/* Active generation status bar */}
      {isGenerating && generationStatus && (
        <div className="pipeline-status-bar">
          <span className="generation-spinner" />
          <span>{generationStatus}</span>
          <button type="button" className="control-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}

      {/* Empty state */}
      {!hasAnyResult && !isGenerating && (
        <div className="pipeline-empty">
          <p>No pipeline results yet. Draw something and click Done to generate.</p>
        </div>
      )}

      {/* Progressive pipeline steps */}
      {hasAnyResult && (
        <div className="pipeline-steps">
          {/* Step 1: Sketch */}
          {results.sketchDataUrl && (
            <div className="pipeline-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Your Sketch</h3>
                <img
                  src={results.sketchDataUrl}
                  alt="Sketch"
                  className="pipeline-image"
                />
                {/* Button to run Claude analysis */}
                {!results.imagePrompt && !isGenerating && (
                  <button
                    type="button"
                    className="control-btn primary"
                    style={{ marginTop: 12 }}
                    onClick={onRunAnalysis}
                  >
                    Run Claude Analysis
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Claude analysis */}
          {results.imagePrompt && (
            <div className="pipeline-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Claude Analysis</h3>
                <div className="pipeline-text-card">{results.imagePrompt}</div>
                {/* Button to generate image */}
                {!results.imageDataUrl && !isGenerating && (
                  <button
                    type="button"
                    className="control-btn primary"
                    style={{ marginTop: 12 }}
                    onClick={onRunImageGen}
                  >
                    Generate Image
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Generated image */}
          {results.imageDataUrl && (
            <div className="pipeline-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>NanoBanana Image</h3>
                <img
                  src={results.imageDataUrl}
                  alt="Generated"
                  className="pipeline-image"
                />
                {/* Button to generate Odyssey prompt */}
                {!results.odysseyPrompt && !isGenerating && (
                  <button
                    type="button"
                    className="control-btn primary"
                    style={{ marginTop: 12 }}
                    onClick={onRunOdysseyPrompt}
                  >
                    Generate Odyssey Prompt
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Odyssey prompt */}
          {results.odysseyPrompt && (
            <div className="pipeline-step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Odyssey Prompt</h3>
                <div className="pipeline-text-card">{results.odysseyPrompt}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
