# Sketchy World

<p align="center">
  <img src="sketchy-world.gif" alt="Odyssey AR demo" width="600" />
</p>

An experimental playground that turns hand-drawn sketches into live Odyssey-2 Pro video streams. Draw in mid-air using your webcam and hand tracking, then watch an AI pipeline transform your sketch into a photorealistic, interactive video world.

## How It Works

1. **Sketch in mid-air** -- MediaPipe hand-tracking powers an in-browser canvas overlaid on your webcam feed. Pick colors and brush sizes by hovering over the palette.
2. **Run the pipeline** -- Click **Done** to export your drawing. Claude Sonnet analyzes the sketch, Gemini generates a photorealistic frame, and another Claude pass crafts an Odyssey-ready prompt.
3. **Stream with Odyssey** -- The generated frame + optimized prompt seed Odyssey-2 Pro. Streaming controls let you interact with the world, end sessions, or start fresh.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm (comes with Node.js)
- A webcam
- API keys (see below)

### API Keys

You'll need two keys:

| Key | What it's for | Where to get it |
|-----|--------------|-----------------|
| `VITE_ODYSSEY_API_KEY` | Odyssey-2 Pro video streaming | [Odyssey](https://odyssey.ml) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway (routes calls to Claude, Gemini) | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) |

> **Tip:** If you run the app with `vercel dev` instead of `npm run dev`, the AI Gateway authenticates automatically via OIDC -- no `AI_GATEWAY_API_KEY` needed.

### Setup

```bash
# Clone the repo
git clone https://github.com/ankur/odyssey-hackathon.git
cd odyssey-hackathon/odyssey-app

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
```

Open `odyssey-app/.env` and fill in your keys:

```env
VITE_ODYSSEY_API_KEY=ody_your_api_key_here
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key_here
```

### Run

```bash
npm run dev
```

The app starts at [http://localhost:5173](http://localhost:5173). Your browser will ask for webcam permission -- allow it to enable hand tracking.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **AI Orchestration**: Vercel AI Gateway (Claude Sonnet, Gemini, GPT-5 mini)
- **Streaming**: Odyssey SDK + WebRTC
- **Computer Vision**: MediaPipe Tasks Vision (real-time hand landmarks)

## Project Structure

```
odyssey-app/
  src/
    components/   -- Canvas UI, status bar, streaming controls, edit view
    hooks/        -- Hand tracking, drawing state, Odyssey client lifecycle
    lib/          -- Pipeline orchestration, hand/canvas utils, particles
    prompts/      -- Centralized LLM prompt templates
    types.ts      -- Shared type definitions
    constants.ts  -- Tunable parameters (colors, brush sizes, thresholds)
  server/         -- Vite plugin for saving sessions and sketches
```
