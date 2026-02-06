# Repository Guidelines

## Project Structure & Module Organization
- `odyssey-app/`: Vite + React + TypeScript workspace where all development happens.
- `src/components/`: UI widgets (WebcamCanvas, ColorPalette, StatusBar).
- `src/hooks/` & `src/lib/`: handle MediaPipe results, drawing state, Odyssey client calls, and math helpers; keep shared types/constants in `src/types.ts` and `src/constants.ts`.
- Styling sits in `src/App.css` and `src/index.css`. The Vite plugin in `server/save-session.ts` writes artifacts into `sessions/`, and `odyssey-docs/` PDFs are reference-only.

## Build, Test & Development Commands
- `npm install`: install dependencies inside `odyssey-app/`.
- `npm run dev`: start Vite with webcam + Odyssey client wiring; keep hardware connected for gesture testing.
- `npm run build`: run the TypeScript project references followed by the optimized bundle.
- `npm run preview`: serve the `dist/` output to confirm production routing and `/api` proxying.
- `npm run lint`: apply ESLint (`eslint.config.js`). Delete outdated folders in `sessions/` when re-testing the save-session middleware.

## Coding Style & Naming Conventions
Stick to 2-space indentation, TypeScript return types on exported functions, and functional React components. Components are PascalCase, hooks start with `use`, and utilities remain camelCase (`canvasUtils.ts`). Keep JSX declarative; confine DOM/MediaStream work to hooks or `useEffect` blocks as in `App.tsx`. UI belongs in components, gesture logic in libs, networking in hooks. Run ESLint before pushing and comment only on tricky math (smoothing, pinch thresholds).

## Testing Guidelines
A dedicated runner is not configured yet, so pair each change with either a Vitest + React Testing Library spec (co-located as `*.test.tsx`) or precise manual QA notes. Always state how you validated hand tracking, hover-based color selection, and session export flows inside the PR. When Vitest is introduced, wire it through `npm run test` so CI and agents can execute it consistently.

## Commit & Pull Request Guidelines
Use short, present-tense commits (e.g., `Add hover color feedback`) scoped to one behavior, and wrap bodies at 72 characters. PRs must ship a concise summary, testing proof, linked issues, and media for UI or hand-tracking updates. Call out `sessions/`, env, or camera impacts so reviewers can focus their checks.

## Security & Configuration Tips
`vite.config.ts` injects `/api/gateway` credentials from `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`; keep them in `.env` or rely on `vercel dev` OIDC tokens. Because the save-session plugin stores prompts and frames under `sessions/`, clear it before commits and avoid logging payloads. Webcam access works only over `localhost` or HTTPS, so develop on trusted origins to maintain permissions.
