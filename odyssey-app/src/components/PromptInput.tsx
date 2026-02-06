import { useState } from 'react';

interface PromptInputProps {
  onGenerate: (prompt: string) => void;
  onBack: () => void;
  isGenerating: boolean;
  generationStatus?: string;
}

export function PromptInput({ onGenerate, onBack, isGenerating, generationStatus }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt.trim());
    }
  };

  return (
    <div className="prompt-overlay">
      <div className="prompt-card">
        <h2>Describe your world</h2>
        <p className="prompt-hint">
          What should this sketch become? Be descriptive — include the environment, style,
          lighting, and mood you want. Claude will optimize the prompt and NanoBanana will
          generate a photorealistic image before Odyssey brings it to life.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "A magical enchanted forest with glowing mushrooms, soft moonlight filtering through ancient trees, fantasy style"'
            rows={3}
            className="prompt-textarea"
            disabled={isGenerating}
            autoFocus
          />
          {isGenerating && generationStatus && (
            <div className="generation-status">
              <span className="generation-spinner" />
              {generationStatus}
            </div>
          )}
          <div className="prompt-actions">
            <button
              type="button"
              className="control-btn"
              onClick={onBack}
              disabled={isGenerating}
            >
              Back to Drawing
            </button>
            <button
              type="submit"
              className="control-btn primary"
              disabled={!prompt.trim() || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate World'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
