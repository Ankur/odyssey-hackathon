/**
 * Vite plugin that adds server endpoints for:
 * - POST /api/save-session — saves generation artifacts to sessions/{timestamp}/
 * - POST /api/save-sketch — saves current sketch strokes to saved-sketch.json
 * - GET  /api/load-sketch — loads saved sketch strokes
 */

import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

interface SessionPayload {
  sketchDataUrl: string;
  imagePrompt: string;
  photorealisticDataUrl: string;
  odysseyPrompt: string;
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; ext: string } {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL');
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { buffer, ext };
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

const SKETCH_FILE = 'saved-sketch.json';

export function saveSessionPlugin(): Plugin {
  return {
    name: 'save-session',
    configureServer(server) {
      // Save generation session artifacts
      server.middlewares.use('/api/save-session', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const body = await readBody(req);
          const payload: SessionPayload = JSON.parse(body);

          const now = new Date();
          const timestamp = now.toISOString()
            .replace(/T/, '_')
            .replace(/:/g, '-')
            .replace(/\..+/, '');
          const sessionsDir = path.resolve(process.cwd(), 'sessions');
          const sessionDir = path.join(sessionsDir, timestamp);

          fs.mkdirSync(sessionDir, { recursive: true });

          const sketch = dataUrlToBuffer(payload.sketchDataUrl);
          fs.writeFileSync(path.join(sessionDir, `sketch.${sketch.ext}`), sketch.buffer);
          fs.writeFileSync(path.join(sessionDir, 'image-prompt.txt'), payload.imagePrompt);

          const photo = dataUrlToBuffer(payload.photorealisticDataUrl);
          fs.writeFileSync(path.join(sessionDir, `photorealistic.${photo.ext}`), photo.buffer);
          fs.writeFileSync(path.join(sessionDir, 'odyssey-prompt.txt'), payload.odysseyPrompt);

          console.log(`[Session] Saved to ${sessionDir}`);

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ path: sessionDir }));
        } catch (err) {
          console.error('[Session] Save failed:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // Save sketch strokes to disk
      server.middlewares.use('/api/save-sketch', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const body = await readBody(req);
          const filePath = path.resolve(process.cwd(), SKETCH_FILE);
          fs.writeFileSync(filePath, body);

          console.log(`[Sketch] Saved to ${filePath}`);

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error('[Sketch] Save failed:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // Load saved sketch strokes
      server.middlewares.use('/api/load-sketch', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const filePath = path.resolve(process.cwd(), SKETCH_FILE);

          if (!fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'No saved sketch found' }));
            return;
          }

          const data = fs.readFileSync(filePath, 'utf-8');

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(data);
        } catch (err) {
          console.error('[Sketch] Load failed:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}
