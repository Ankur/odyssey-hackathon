import { useState } from 'react';

interface StreamingControlsProps {
  onInteract: (prompt: string) => void;
  onEndStream: () => void;
  onNewDrawing: () => void;
  odysseyStatus: string;
}

export function StreamingControls({
  onInteract,
  onNewDrawing,
  odysseyStatus,
}: StreamingControlsProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onInteract(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <>
      <div className="streaming-controls">
        <div className="streaming-status">
          Status: {odysseyStatus}
        </div>
        <form onSubmit={handleSubmit} className="streaming-form">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Interact with your world... (e.g. 'The sun sets and fireflies appear')"
            className="streaming-input"
          />
          <button type="submit" className="control-btn primary" disabled={!prompt.trim()}>
            Send
          </button>
        </form>
      </div>
      <button className="new-drawing-btn" onClick={onNewDrawing}>
        New Drawing
      </button>
    </>
  );
}
