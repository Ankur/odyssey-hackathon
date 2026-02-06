import { COLORS, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE } from '../constants';

interface ColorPaletteProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  disabled?: boolean;
}

export function ColorPalette({
  selectedColor,
  onSelectColor,
  brushSize,
  onBrushSizeChange,
  disabled,
}: ColorPaletteProps) {
  return (
    <div className="color-palette">
      <div className="palette-label">Colors</div>
      <div className="palette-swatches">
        {COLORS.map((c) => (
          <button
            key={c.hex}
            className={`swatch ${selectedColor === c.hex ? 'selected' : ''}`}
            style={{
              backgroundColor: c.hex,
              border: c.hex === '#000000' ? '2px solid #444' : undefined,
            }}
            onClick={() => onSelectColor(c.hex)}
            disabled={disabled}
            title={c.name}
            data-color={c.hex}
          />
        ))}
      </div>

      <div className="palette-label">Size</div>
      <input
        type="range"
        min={MIN_BRUSH_SIZE}
        max={MAX_BRUSH_SIZE}
        value={brushSize}
        onChange={(e) => onBrushSizeChange(Number(e.target.value))}
        className="brush-slider"
        disabled={disabled}
      />
      <div className="brush-preview">
        <span
          className="brush-dot"
          style={{
            width: brushSize,
            height: brushSize,
            backgroundColor: selectedColor,
          }}
        />
      </div>
    </div>
  );
}
