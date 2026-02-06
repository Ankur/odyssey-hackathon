# Odyssey AR

A web app for creating interactive worlds by drawing with your finger via webcam. Draw on a canvas overlay using hand tracking, then an AI pipeline transforms your sketch into a photorealistic image and streams it as an interactive video world via the Odyssey-2 Pro API.

## Prerequisites

- Node.js 18+
- npm
- A webcam
- API keys (see [Environment Setup](#environment-setup))

## Getting Started

```bash
cd odyssey-app
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env with your API keys (see below)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Setup

Copy `.env.example` to `.env` and set the following:

| Variable | Description | Scope |
|---|---|---|
| `VITE_ODYSSEY_API_KEY` | Odyssey API key | Browser (exposed via `VITE_` prefix) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key | Server-side only (injected by Vite proxy) |

Alternatively, run with `vercel dev` for automatic OIDC auth (no gateway key needed).

## Available Commands

All commands run from the `odyssey-app/` directory:

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (localhost:5173) with AI Gateway proxy |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run lint` | ESLint with TypeScript rules |
| `npm run preview` | Preview production build locally |

## How to Use

1. **Draw tab** — Press SPACE to start drawing with your index finger via webcam. Use the color palette on the left to change colors. Hover your finger over a swatch to select it.
2. Click **Done** when your sketch is ready. The app auto-switches to the Pipeline tab.
3. **Pipeline tab** — Watch the AI pipeline run step by step:
   - Claude analyzes your sketch and writes an image prompt
   - NanoBanana (Gemini) generates a photorealistic version
   - Claude writes an optimized Odyssey world prompt
4. **Odyssey tab** — Once the pipeline finishes, the stream starts automatically. Type prompts to interact with your world in real time.
5. Click **New Drawing** to start over.

## Architecture

### App State Machine

```
IDLE → DRAWING ⇄ PAUSED → "Done" → GENERATING → STREAMING → IDLE
```

### AI Pipeline

1. **Claude** (Sonnet) analyzes sketch via vision API → detailed image prompt
2. **NanoBanana / Gemini** generates photorealistic 16:9 image from sketch + prompt
3. **Claude** optimizes the prompt for Odyssey's world model
4. **Odyssey-2 Pro** streams interactive video from image + optimized prompt

All LLM calls go through the Vite proxy at `/api/gateway` → `ai-gateway.vercel.sh`, which injects auth server-side.

### Source Layout (`src/`)

- **`App.tsx`** — Main orchestrator. Manages state machine, tab navigation, hand tracking loop, and generation pipeline.
- **`components/`** — React UI: `WebcamCanvas`, `TabBar`, `PipelineView`, `ColorPalette`, `StatusBar`, `StreamingControls`
- **`hooks/`** — Custom hooks: `useHandTracking`, `useDrawing`, `useOdysseyClient`
- **`lib/`** — Utilities: `pipeline.ts` (AI generation), `handUtils.ts`, `canvasUtils.ts`, `sparkle.ts`
- **`types.ts`** — TypeScript type definitions
- **`constants.ts`** — Tunable parameters
