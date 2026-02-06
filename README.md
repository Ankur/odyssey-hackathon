# Odyssey Hackathon

An experimental playground that turns hand-drawn sketches into live Odyssey-2 Pro video streams. The app guides you from gestural drawing on a webcam feed, through prompt engineering, to photorealistic generations and interactive streaming.

## How It Works
1. **Sketch in mid-air or with a mouse** – MediaPipe hand-tracking powers the in-browser canvas, while color/brush controls hover over the selfie feed.
2. **Run the pipeline** – The drawing is exported once you click **Done**. Claude Sonnet analyzes the sketch, NanoBanana (Gemini 2.5 image) renders a photorealistic frame, and another Claude pass crafts an Odyssey-ready prompt.
3. **Stream with Odyssey** – The optimized prompt plus generated frame seed Odyssey-2 Pro. Streaming controls let you interact, end sessions, or start fresh sketches.
4. **Edit mode** – Capture a before/after image, draw adjustments, and use GPT-5 mini to produce an interact prompt describing the change.
5. **Imagify** – A quick button on the Draw tab that runs the photorealistic pipeline without starting the Odyssey stream.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, custom hooks (`useDrawing`, `useHandTracking`, `useOdysseyClient`).
- **AI Orchestration**: Vercel AI Gateway for Claude Sonnet, NanoBanana (Gemini 2.5 image), and GPT-5 mini calls.
- **Streaming**: Odyssey SDK + WebRTC for interactive video.
- **Computer Vision**: MediaPipe Tasks Vision for real-time hand landmarks.
- **Tooling**: ESLint, TypeScript project references, custom Vite server plugin for saving sessions.

## Development
```bash
cd odyssey-app
npm install
npm run dev
```
The dev server runs on Vite (defaults to http://localhost:5173). Webcam access requires browser permission.

## Project Structure
- `odyssey-app/src/components` – Canvas UI, status bar, streaming controls, edit view.
- `odyssey-app/src/hooks` – Hand tracking, drawing, Odyssey client lifecycle.
- `odyssey-app/src/lib` – Pipeline orchestration, edit analysis, session plugin helpers.
- `odyssey-app/src/prompts` – Centralized LLM prompt templates.
- `odyssey-docs` – Offline PDFs + Mintlify export for Odyssey API references.

Hack on new gesture interactions, tweak prompt templates in `src/prompts`, or expand the pipeline—everything is wired for quick experimentation.
