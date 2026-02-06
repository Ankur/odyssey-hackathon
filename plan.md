# Odyssey AR: Finger-Drawing World Creator

## Concept

Draw sketches in the air with your finger, superimposed on your webcam feed (like the classic Disney Channel wand ad), then feed the drawing into the Odyssey-2 Pro world model to generate a living, interactive world from your sketch. You literally create worlds out of thin air.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **Vite + React + TypeScript** | Fast dev server, simple setup, built-in proxy for API calls |
| Hand Tracking | **@mediapipe/tasks-vision** (HandLandmarker) | Google's latest hand tracking — runs in-browser, 21 landmarks per hand, real-time at 30fps+ |
| Drawing Surface | **HTML Canvas API** | Transparent canvas overlaid on the webcam `<video>` element. Standard, performant, easy to export as PNG |
| AI Gateway | **Vercel AI Gateway** (`ai-gateway.vercel.sh`) | Unified API gateway — single key routes to all AI providers. OpenAI-compatible endpoint for both Claude and Gemini |
| LLM (Prompt Optimization) | **Claude Sonnet 4.5** via Vercel AI Gateway | Generates photorealistic image prompts from sketch descriptions, and optimizes Odyssey prompts using interaction tips. Model: `anthropic/claude-sonnet-4.5` |
| Image Generation | **NanoBanana Pro** (Gemini 3 Pro Image) via Vercel AI Gateway | Generates photorealistic 16:9 images from Claude's optimized prompts. Model: `google/gemini-3-pro-image` with `modalities: ['text', 'image']` |
| World Model | **@odysseyml/odyssey** SDK | Odyssey-2 Pro image-to-video. Accepts the NanoBanana image + optimized prompt, streams interactive video |
| Styling | **Vanilla CSS** | Keep it simple — fullscreen webcam feed with glassmorphism overlays |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Browser Window                     │
│                                                      │
│  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │  Color    │  │                                  │  │
│  │  Palette  │  │   <video> — Webcam Feed          │  │
│  │           │  │   <canvas> — Drawing Overlay      │  │
│  │  ● Red    │  │   <canvas> — Hand Landmarks       │  │
│  │  ● Blue   │  │                                  │  │
│  │  ● Green  │  │   Index fingertip draws lines    │  │
│  │  ● Yellow │  │   on the canvas as you move      │  │
│  │  ● White  │  │                                  │  │
│  │  ● Black  │  │                                  │  │
│  │  ...      │  │                                  │  │
│  └──────────┘  └──────────────────────────────────┘  │
│                                                      │
│  [Status Bar: "Press SPACE to start drawing"]         │
│  [Brush size slider]  [Clear] [Undo]                 │
└──────────────────────────────────────────────────────┘
```

After finishing the sketch:

```
┌──────────────────────────────────────────────────────┐
│  Your sketch (frozen on screen):                     │
│  ┌──────────────────────────────────────────────┐    │
│  │          [Your drawing here]                  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Describe the world you want to create:              │
│  ┌──────────────────────────────────────────────┐    │
│  │ "A magical forest with glowing mushrooms"     │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  [Generate World]   [Back to Drawing]                │
└──────────────────────────────────────────────────────┘
```

After generation starts:

```
┌──────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐    │
│  │                                              │    │
│  │   <video> — Odyssey Stream Output            │    │
│  │   (Generated world playing live)             │    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Interact with your world:                           │
│  ┌──────────────────────────────────────────────┐    │
│  │ "The sun sets and fireflies appear"           │    │
│  └──────────────────────────────────────────────┘    │
│  [Send]  [End Stream]  [New Drawing]                 │
└──────────────────────────────────────────────────────┘
```

---

## App States & Flow

```
[IDLE] → SPACE → [DRAWING] ⇄ SPACE ⇄ [PAUSED] → "Done" btn → [GENERATING]
                                                                      │
                                                               pipeline runs
                                                              (auto, no prompt)
                                                                      │
                                                                      ▼
                                                               [STREAMING]
                                                                      │
                                                           click "End Stream"
                                                                      │
                                                                      ▼
                                                               [IDLE] (loop)
```

**States:**
1. **IDLE** — Webcam feed visible, hand tracking active (showing fingertip cursor), color palette visible. Status bar shows "Press SPACE to start drawing."
2. **DRAWING** — Index fingertip is tracked and draws lines on the canvas overlay. Press SPACE to pause (creates a new stroke segment). Hover cursor over color swatches to change color.
3. **PAUSED** — Drawing paused. Cursor still visible but doesn't draw. Press SPACE to resume drawing (enables non-continuous segments). Click "Done" button (top-right) to finalize.
4. **GENERATING** — Sketch is exported and sent to Claude (vision) for analysis. Claude writes a photorealistic prompt, NanoBanana renders sketch + prompt into a photorealistic image, Claude writes an Odyssey prompt. No manual text input needed. Loading overlay with status + cancel button shown.
5. **STREAMING** — Odyssey video stream is displayed. User can send midstream interaction prompts. "End Stream" button available.

---

## Implementation Plan

### Phase 1: Project Scaffolding

- Initialize Vite + React + TypeScript project
- Install dependencies:
  - `@mediapipe/tasks-vision` — hand tracking
  - `@odysseyml/odyssey` — world model API
- Set up basic project structure:
  ```
  odyssey-ar/
  ├── odyssey-docs/          (existing)
  ├── src/
  │   ├── main.tsx
  │   ├── App.tsx
  │   ├── components/
  │   │   ├── WebcamCanvas.tsx       — webcam + drawing canvas + hand tracking
  │   │   ├── ColorPalette.tsx       — side panel with color swatches
  │   │   ├── StatusBar.tsx          — bottom bar with state info + controls
  │   │   ├── PromptInput.tsx        — text input for world description
  │   │   └── OdysseyPlayer.tsx      — video player for Odyssey stream output
  │   ├── hooks/
  │   │   ├── useHandTracking.ts     — MediaPipe hand landmark detection logic
  │   │   ├── useDrawing.ts          — canvas drawing state & operations
  │   │   └── useOdysseyClient.ts    — Odyssey SDK connection & stream management
  │   ├── lib/
  │   │   ├── handUtils.ts           — helper functions (finger detection, smoothing)
  │   │   ├── canvasUtils.ts         — canvas export, clear, undo stack
  │   │   └── pipeline.ts            — Claude + NanoBanana + Odyssey generation pipeline
  │   ├── types.ts                   — shared TypeScript types
  │   └── constants.ts               — colors, thresholds, config
  ├── index.html
  ├── package.json
  ├── tsconfig.json
  ├── vite.config.ts
  └── plan.md                (this file)
  ```

### Phase 2: Webcam Feed + Hand Tracking

**Goal:** Get the webcam feed displaying with real-time hand landmark detection overlaid.

1. **Webcam setup** — Use `navigator.mediaDevices.getUserMedia({ video: true })` to get the camera stream. Display in a `<video>` element. Mirror the feed horizontally (CSS `transform: scaleX(-1)`) so it feels natural (selfie mode).

2. **MediaPipe HandLandmarker initialization:**
   ```ts
   import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

   const vision = await FilesetResolver.forVisionTasks(
     'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
   );
   const handLandmarker = await HandLandmarker.createFromOptions(vision, {
     baseOptions: {
       modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
       delegate: 'GPU'
     },
     runningMode: 'VIDEO',
     numHands: 1  // only need one hand for drawing
   });
   ```

3. **Detection loop** — Use `requestAnimationFrame` to call `handLandmarker.detectForVideo(videoElement, timestamp)` each frame. This returns an array of hand landmarks (21 points per hand, each with x/y/z normalized 0-1).

4. **Key landmarks:**
   - **Index finger tip** = landmark `8` — used for drawing
   - **Thumb tip** = landmark `4` — used with index tip for pinch detection
   - **Index finger MCP** = landmark `5` — can help determine if finger is extended

5. **Visual feedback** — Draw small dots on a landmarks canvas at the fingertip positions so the user can see tracking is working.

### Phase 3: Drawing Engine

**Goal:** When in DRAWING state, track the index fingertip and render smooth lines on the canvas.

1. **Canvas overlay** — A `<canvas>` element positioned absolutely on top of the `<video>`, same dimensions. Background is transparent so the webcam shows through.

2. **Coordinate mapping** — MediaPipe returns normalized coordinates (0-1). Multiply by canvas width/height. Since the webcam is mirrored, flip x: `canvasX = (1 - landmark.x) * canvas.width`.

3. **Line drawing logic:**
   - On each frame during DRAWING state, get the index fingertip position
   - If the finger was also detected in the previous frame, draw a line segment from the previous position to the current position using `ctx.lineTo()`
   - Use `ctx.lineWidth`, `ctx.strokeStyle`, `ctx.lineCap = 'round'`, `ctx.lineJoin = 'round'` for smooth, rounded strokes
   - If the finger disappears for a frame or two (tracking lost), don't connect — start a new path segment

4. **Position smoothing** — Apply exponential moving average to reduce jitter:
   ```ts
   smoothedX = smoothedX * (1 - alpha) + rawX * alpha;  // alpha ~0.5-0.7
   smoothedY = smoothedY * (1 - alpha) + rawY * alpha;
   ```

5. **Undo support** — Store drawing operations as an array of strokes (each stroke = array of points + color + width). "Undo" pops the last stroke and redraws.

6. **Brush size** — A small slider or +/- buttons to adjust line width (default ~4-8px).

### Phase 4: Color Palette + Hover-Based Selection

**Goal:** Color palette on the left side. User hovers their fingertip cursor over a color swatch to select it.

1. **Color palette UI** — Vertical strip of colored circles on the left side of the screen. Colors: white, black, red, orange, yellow, green, cyan, blue, purple, pink. Currently selected color has a visible border/ring.

2. **Hover selection logic:**
   - Convert the index fingertip position to viewport (screen) coordinates
   - Check if the fingertip overlaps any color swatch's bounding rect (with padding for easier targeting)
   - If yes and it's a different color, set it as the active brush color
   - Add a brief cooldown (~400ms) after selection to prevent rapid toggling
   - Visual feedback: swatch briefly pulses/scales when selected

3. **Mouse fallback** — Also allow clicking/tapping the swatches directly with the mouse for accessibility.

### Phase 5: Spacebar Toggle + Done Button + State Management

**Goal:** Spacebar toggles drawing on/off for non-continuous segments. "Done" button finalizes the sketch.

1. **Keyboard listener** — `window.addEventListener('keydown', ...)` listening for spacebar.
   - IDLE + SPACE → DRAWING (start drawing)
   - DRAWING + SPACE → PAUSED (pause, finalize current stroke, can change color / reposition)
   - PAUSED + SPACE → DRAWING (resume drawing — creates a new non-continuous segment)

2. **Done button** — Fixed in the top-right corner. Visible in DRAWING and PAUSED states. Clicking it transitions to REVIEW.

3. **State management** — React `useState` for the app state enum:
   ```ts
   type AppState = 'IDLE' | 'DRAWING' | 'PAUSED' | 'REVIEW' | 'GENERATING' | 'STREAMING';
   ```

4. **Status bar** — Shows current state context:
   - IDLE: "Press SPACE to start drawing"
   - DRAWING: "Drawing... Press SPACE to pause"
   - PAUSED: "Paused — Press SPACE to resume drawing"
   - REVIEW: "Describe your world and click Generate"
   - GENERATING: "Creating your world..."
   - STREAMING: "Your world is live! Type to interact"

5. **Controls:**
   - **Clear** button — clears the drawing canvas (available in IDLE/DRAWING/PAUSED)
   - **Undo** button — removes last stroke (available in IDLE/DRAWING/PAUSED)
   - **Back to Drawing** — returns from REVIEW to PAUSED state

### Phase 6: Generation Pipeline (Claude + NanoBanana + Odyssey)

**Goal:** Use a multi-step AI pipeline to transform the sketch into a living world.

The pipeline runs automatically when the user clicks "Done" — no manual text prompt needed. Claude analyzes the sketch visually.

**Step 1 — Claude (vision) analyzes the sketch and writes an image prompt:**
- Sends the exported sketch image to Claude Sonnet 4.5 via the vision/multimodal API
- Claude identifies every element, shape, and scene in the sketch
- Writes a detailed photorealistic image prompt that faithfully follows the sketch's composition
- Includes specifics about lighting, textures, materials, colors, spatial arrangement

**Step 2 — NanoBanana Pro generates a photorealistic version of the sketch:**
- Sends BOTH the original sketch image AND Claude's prompt to NanoBanana Pro (Gemini 3 Pro Image)
- NanoBanana uses the sketch as a visual reference to match composition and layout
- Configured for 16:9 landscape format
- Returns a high-quality photorealistic image as base64, converted to a File object

**Step 3 — Claude generates an optimized Odyssey prompt:**
- Sends the sketch analysis from Step 1 to Claude with Odyssey-specific prompt engineering guidelines
- Claude writes a prompt following Odyssey interaction tips: subject, environment, style, camera position, composition, lighting, stative descriptions (no action loops)
- Designed to make the world feel alive with gentle natural motion

**Step 4 — Odyssey brings it to life:**
- Connects to Odyssey and calls `startStream({ prompt: optimizedPrompt, image: photorealisticImage })`
- The photorealistic image gives Odyssey a high-quality starting frame
- The optimized prompt guides the world animation

**Pipeline implementation** — `src/lib/pipeline.ts`:
All API calls route through the **Vercel AI Gateway** (`ai-gateway.vercel.sh`). Auth is handled server-side by the Vite proxy (injects token from `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`). Both Claude and NanoBanana use the OpenAI-compatible `POST /v1/chat/completions` endpoint:
```ts
export async function runPipeline(
  sketchDataUrl: string,
  onStatus: (status: string) => void,
): Promise<{ image: File; odysseyPrompt: string }> {
  // Step 1: Claude Sonnet (vision) analyzes sketch → image prompt
  const imagePrompt = await analyzeSketchAndGeneratePrompt(sketchDataUrl);
  // Step 2: NanoBanana Pro: sketch image + prompt → photorealistic image
  const image = await generatePhotorealisticImage(sketchDataUrl, imagePrompt);
  // Step 3: Claude Sonnet → optimized Odyssey prompt
  const odysseyPrompt = await generateOdysseyPrompt(imagePrompt);
  return { image, odysseyPrompt, imagePrompt };
}
```

**API key handling** — Store in `.env` file:
```
VITE_ODYSSEY_API_KEY=ody_...
AI_GATEWAY_API_KEY=...     # Server-side only (no VITE_ prefix = not exposed to browser)
```

**CORS handling** — All AI API calls are proxied through Vite dev server (`/api/gateway` → `ai-gateway.vercel.sh`). The proxy injects `Authorization: Bearer <token>` from server-side env vars. Alternatively, use `vercel dev` for automatic OIDC auth.

### Phase 7: Video Output + Midstream Interaction

**Goal:** Display the Odyssey video stream and allow the user to interact with the generated world.

1. **Video display** — When streaming starts, swap the webcam `<video>` source to the Odyssey MediaStream. Or use a second `<video>` element and hide the webcam one.

2. **Interaction UI** — Text input + "Send" button at the bottom. User types midstream prompts (e.g., "zoom into the mountains", "it starts raining"). Following the interaction tips:
   - Use stative descriptions ("the sky is dark") not action verbs ("the sky darkens") to avoid looping

3. **End stream** — "End Stream" button calls `client.endStream()`. Transitions back to IDLE state. "New Drawing" button clears everything and returns to the drawing screen.

4. **Cleanup** — Always call `client.disconnect()` on page unload via `beforeunload` event and React cleanup in `useEffect`. Stale connections block new ones (max 1 concurrent session, 40s server timeout).

---

## Key Technical Considerations

### Finger Tracking Accuracy
- **GPU delegate** — Use `delegate: 'GPU'` in MediaPipe options for better performance
- **Smoothing** — Exponential moving average on fingertip coordinates (alpha 0.5-0.7) to reduce jitter
- **Lost tracking gap** — If the finger isn't detected for >2 consecutive frames, start a new stroke path (don't connect across gaps)
- **Extended finger check** — Optionally check that the index finger is actually extended (compare landmark 8 y-position to landmark 6) to avoid drawing when the hand is in a fist

### Drawing Quality
- Use `ctx.lineCap = 'round'` and `ctx.lineJoin = 'round'` for smooth strokes
- Interpolate between points if frames are far apart (e.g., quadratic Bezier through midpoints)
- Default brush size ~5-8px, adjustable via slider
- The canvas should match the video feed dimensions for proper alignment

### Webcam Mirroring
- The webcam `<video>` is CSS-mirrored (`scaleX(-1)`) for a natural selfie experience
- The drawing and landmark canvases are NOT CSS-mirrored — mirroring is done in code: `canvasX = (1 - normalizedX) * width`
- This avoids double-mirroring issues (CSS + code would cancel out)
- The exported image keeps the code-mirrored coordinates, which matches what the user saw on screen

### Odyssey API Constraints
- **Max 1 concurrent session** — must disconnect before reconnecting
- **Image max 25MB** — PNG export of a canvas drawing will be well under this
- **Supported formats** — PNG works fine
- **Auto-resize** — Images are automatically resized to 1280x704 (landscape), so export at this resolution for best results
- **Prompt tips** — Be descriptive: subject, environment, style, camera, lighting. Use present-continuous for midstream ("is wearing" not "puts on")

### Performance
- MediaPipe hand tracking + webcam + canvas rendering should all run smoothly at 30fps on modern hardware
- Use `requestAnimationFrame` for the detection/drawing loop
- Consider throttling hand detection to every other frame if performance is an issue (still 15fps detection, interpolate positions)

---

## Environment Variables

```
VITE_ODYSSEY_API_KEY=ody_your_api_key_here
VITE_AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key_here
```

- **Odyssey**: Sign up at https://developer.odyssey.ml/dashboard
- **Vercel AI Gateway**: Single key from Vercel dashboard — routes to Claude (Anthropic) and NanoBanana Pro (Google Gemini) with no additional provider keys needed

---

## Future Enhancements (Out of Scope for V1)

- **Two-hand drawing** — use both hands simultaneously
- **Eraser gesture** — flat palm or specific gesture to erase
- **Save/load drawings** — persist sketches to local storage
- **Gallery** — save generated worlds as recordings
- **Voice prompts** — speak the world description instead of typing
- **Real-time AR overlay** — overlay the Odyssey output back onto the webcam feed for true AR
- **Mobile support** — touch fallback for drawing when hand tracking isn't available
