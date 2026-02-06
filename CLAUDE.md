# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Odyssey AR is a web app for creating interactive worlds by drawing with your finger via webcam. The user draws on a canvas overlay using hand tracking, then an AI pipeline transforms the sketch into a photorealistic image and streams it as an interactive video world via the Odyssey-2 Pro API.

## Commands

All commands run from the `odyssey-app/` directory:

```bash
npm run dev       # Start Vite dev server (localhost:5173) with AI Gateway proxy
npm run build     # TypeScript compile + Vite production build
npm run lint      # ESLint with TypeScript rules
npm run preview   # Preview production build locally
```

There are no tests configured in this project.

## Environment Setup

Copy `odyssey-app/.env.example` to `odyssey-app/.env` and set:
- `VITE_ODYSSEY_API_KEY` - Odyssey API key (exposed to browser via `VITE_` prefix)
- `AI_GATEWAY_API_KEY` - Vercel AI Gateway key (server-side only, injected by Vite proxy)

Alternatively, running with `vercel dev` provides automatic OIDC auth (no gateway key needed).

## Architecture

### App State Machine

```
IDLE → DRAWING ⇄ PAUSED → "Done" → GENERATING → STREAMING → IDLE
```

- **IDLE**: Webcam feed with hand tracking active
- **DRAWING**: Index fingertip draws on canvas overlay
- **PAUSED**: Cursor visible but not drawing (spacebar toggles)
- **GENERATING**: AI pipeline running (Claude → Gemini → Claude → Odyssey)
- **STREAMING**: Odyssey video stream displayed

### Source Layout (`odyssey-app/src/`)

- **`App.tsx`** - Main orchestrator (~440 lines). Manages state machine, hand tracking loop via `requestAnimationFrame`, color selection via hover, and generation pipeline trigger.
- **`components/`** - React UI: `WebcamCanvas`, `ColorPalette`, `StatusBar`, `PromptInput`, `GeneratingOverlay`, `StreamingControls`
- **`hooks/`** - Three custom hooks:
  - `useHandTracking` - MediaPipe HandLandmarker initialization and detection loop
  - `useDrawing` - Canvas stroke state with undo/redo, smoothing, save/load
  - `useOdysseyClient` - Odyssey SDK connection lifecycle and streaming
- **`lib/`** - Utilities:
  - `pipeline.ts` - Four-step AI generation pipeline (all calls through `/api/gateway`)
  - `handUtils.ts` - Finger position extraction, extension/pinch detection, EMA smoothing
  - `canvasUtils.ts` - Stroke rendering with quadratic bezier, canvas export at 1280x704
  - `sparkle.ts` - Cursor trail particle system
- **`types.ts`** - `AppState`, `Point`, `Stroke` type definitions
- **`constants.ts`** - Tunable parameters (colors, brush sizes, thresholds, export dimensions)

### Server-Side (`odyssey-app/server/`)

`save-session.ts` is a Vite plugin that adds three dev-server endpoints:
- `POST /api/save-session` - Saves generation artifacts to `sessions/{timestamp}/`
- `POST /api/save-sketch` / `GET /api/load-sketch` - Persists sketch strokes to `saved-sketch.json`

### AI Pipeline (`lib/pipeline.ts`)

1. **Claude** (anthropic/claude-sonnet-4.5) analyzes the sketch via vision API → detailed image prompt
2. **Gemini** (google/gemini-3-pro-image) generates photorealistic 16:9 image from sketch + prompt
3. **Claude** optimizes the prompt for Odyssey's world model
4. **Odyssey-2 Pro** streams interactive video from image + optimized prompt

All LLM calls go through the Vite proxy at `/api/gateway` → `ai-gateway.vercel.sh`, which injects auth server-side.

### Key Technical Details

- **Mirroring**: Webcam video is CSS-mirrored (`scaleX(-1)`) for selfie feel. Drawing canvas is NOT CSS-mirrored; mirroring is applied in code (`canvasX = (1 - normalizedX) * width`) to avoid double-mirroring. Export preserves code-mirrored coordinates.
- **React.StrictMode omitted**: Intentionally excluded because double-invoked effects break webcam streams and MediaPipe initialization.
- **MediaPipe hand tracking**: 21 landmarks per hand in normalized 0-1 coordinates, GPU delegate, video mode. Key indices: THUMB_TIP=4, INDEX_TIP=8, INDEX_MCP=5, INDEX_PIP=6.
- **Export resolution**: Fixed at 1280x704 to match Odyssey landscape format.
- **Stroke smoothing**: Exponential moving average (alpha 0.6) on finger position, quadratic bezier interpolation on render.
