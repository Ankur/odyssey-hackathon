export const COLORS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink', hex: '#EC4899' },
];

export const DEFAULT_COLOR = '#FFFFFF';
export const DEFAULT_BRUSH_SIZE = 6;
export const MIN_BRUSH_SIZE = 2;
export const MAX_BRUSH_SIZE = 20;

// Smoothing factor for finger position (0-1, higher = less smoothing)
export const SMOOTHING_ALPHA = 0.6;

// Pinch detection threshold (normalized distance between thumb and index tip)
export const PINCH_THRESHOLD = 0.06;

// Cooldown after color selection via hover (ms)
export const COLOR_HOVER_COOLDOWN_MS = 400;

// How many consecutive lost-tracking frames before we break the stroke
export const MAX_LOST_FRAMES = 3;

// Export resolution matching Odyssey landscape
export const EXPORT_WIDTH = 1280;
export const EXPORT_HEIGHT = 704;
