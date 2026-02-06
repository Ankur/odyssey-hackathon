import { useState } from 'react';

interface StreamingControlsProps {
  onInteract: (prompt: string) => void;
  onEndStream: () => void;
  onNewDrawing: () => void;
  onEdit?: () => void;
  odysseyStatus: string;
}

export function StreamingControls({
  onInteract,
  onNewDrawing,
  onEdit,
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <form onSubmit={handleSubmit} className="streaming-form" style={{ flex: 1, marginBottom: 0 }}>
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
          {onEdit && (
            <button className="control-btn primary" onClick={onEdit} style={{ padding: '7px 18px', fontSize: 14, whiteSpace: 'nowrap' }}>
              Edit
            </button>
          )}
        </div>
      </div>
      <button className="new-drawing-btn" onClick={onNewDrawing}>
        New Drawing
      </button>
    </>
  );
}
