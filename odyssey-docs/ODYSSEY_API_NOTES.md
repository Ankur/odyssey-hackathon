# Odyssey API Field Notes

Sources to reference whenever you build against Odyssey:
- Live docs: https://documentation.api.odyssey.ml/ (see linked sections below)
- Offline mirror: `odyssey-docs/odyssey-api-llms-full.txt` (Mintlify llms-full export downloaded on 2026-02-05)

## Capabilities to Leverage
- **Real-time interactive streams** ([JavaScript SDK – Odyssey Class](https://documentation.api.odyssey.ml/sdk/javascript/odyssey-class)): connect via WebRTC, then call `startStream`, `interact`, and `endStream` without artificial delays; handlers expose stream IDs, status updates, and fatal errors.
- **Orientation & input control** ([API Quick Start](https://documentation.api.odyssey.ml/api-quick-start)): `startStream`/`simulate` accept `portrait` (704×1280) or landscape (1280×704); you can seed generations with an `image` (File/Blob/base64/PIL/bytes) for image-to-video flows.
- **Image ingestion guardrails** (same Quick Start): max 25 MB; JPEG/PNG/WebP/GIF/BMP/HEIC/HEIF/AVIF accepted; Odyssey auto-resizes to the closest supported aspect.
- **Batch workflows** ([Simulate API](https://documentation.api.odyssey.ml/sdk/javascript/simulations)): submit timestamped scripts that `start`, `interact`, and `end` streams asynchronously, poll with `getSimulateStatus`, and retrieve recordings once `completed`; works with or without an active WebRTC connection.
- **Recording retrieval** ([Recordings guide](https://documentation.api.odyssey.ml/sdk/javascript/recordings)): capturing the `stream_id` lets you fetch MP4, thumbnail, preview, and JSONL event logs via `getRecording` or paginate via `listStreamRecordings` (URLs expire ≈1 hour).
- **SDK coverage** ([JS](https://documentation.api.odyssey.ml/sdk/javascript/introduction) & [Python](https://documentation.api.odyssey.ml/sdk/python/introduction)): mirror feature sets (event handlers, `simulate`, `listSimulations`, `cancelSimulation`), plus a React hook (`useOdyssey`) that manages lifecycle and exposes `status`, `error`, and `mediaStream` helpers.

## What the API Cannot or Should Not Do
- **Fictional IP accuracy is limited** ([Known limitations](https://documentation.api.odyssey.ml/interaction-tips#known-limitations)): prompts about named characters or non-real subjects degrade silhouettes and realism, often overriding style cues.
- **Action verbs loop midstream** ([Tips for prompting midstream](https://documentation.api.odyssey.ml/interaction-tips#tips-for-prompting-midstream)): phrases like “puts on glasses” repeat; use stative descriptions (“is wearing glasses”) to lock in a state.
- **Files outside constraints are rejected**: oversize or unsupported images will fail upload; videos always stream at Odyssey-managed aspect ratios, so do not expect arbitrary resolutions yet.
- **No offline playback without recordings**: you cannot reconstruct a past stream unless you saved its `stream_id` and pulled recording artifacts in time.

## Prompting & Interaction Tips
- **Structure prompts** ([Interaction Tips](https://documentation.api.odyssey.ml/interaction-tips)): cover subject, action, environment, style, camera, composition, lens, and mood to give the world model enough context.
- **Style cues can be colloquial**: Odyssey understands “Minecraft voxels,” “GTA-6 realism,” or “1960s cartoon” without formal art jargon; mix multiple styles to shift palette and blocking in one go.
- **Use cinematic vocabulary**: specify framing (macro, CU, MCU, OTS) and camera position (bird’s-eye, profile, rear) to choreograph shots.
- **Negative prompts**: explicitly exclude elements (“Negative prompt: dark, stormy atmosphere”) to steer lighting or mood.
- **Midstream sequencing**: timestamped `script` entries (Simulate API) or sequential `interact` calls (Interactive API) let you choreograph arcs—just keep actions achievable and time deltas realistic (≥3 s) for stable rollouts.

## Implementation Reminders
- Fetch API keys from https://developer.odyssey.ml/dashboard and accept the API License before shipping ([Introducing the Odyssey API](https://documentation.api.odyssey.ml/index)).
- Always `connect()` before invoking `startStream`; both JS and Python SDKs resolve only when the data channel is ready, so there is no need to `setTimeout` between calls.
- Capture `stream_id` inside `onStreamStarted` (or hook equivalents) as soon as possible; store alongside prompts for auditability.
- Simulations and recording lookups do not require an active WebRTC session—handy for server-side jobs or CRON replays.
- When prompting frequently, debounce UI buttons until `interact` resolves (acknowledged prompts return as strings) to avoid queuing conflicting instructions.

> Always cross-check nuanced behavior or new parameters against the full text in `odyssey-docs/odyssey-api-llms-full.txt` or the live docs before implementing or reviewing Odyssey API changes.
