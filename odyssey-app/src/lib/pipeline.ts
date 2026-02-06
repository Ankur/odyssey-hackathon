import {
  PHOTOREALISTIC_IMAGE_PROMPT,
  SKETCH_ANALYSIS_PROMPT,
  buildOdysseyPromptMessage,
} from '../prompts/pipelinePrompts';

/**
 * Generation pipeline (via Vercel AI Gateway):
 * 1. Claude Sonnet (vision): analyzes sketch → writes photorealistic image prompt
 * 2. NanoBanana Pro (Gemini 3 Pro Image): sketch image + prompt → photorealistic image
 * 3. Claude Sonnet: analysis → optimized Odyssey prompt
 * 4. Odyssey: photorealistic image + prompt → interactive video stream
 *
 * Auth is handled server-side by the Vite proxy.
 */

const GATEWAY_BASE = '/api/gateway/v1';

const GATEWAY_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Call Claude Sonnet with the sketch image to analyze it and write a
 * detailed photorealistic image prompt for NanoBanana.
 */
export async function analyzeSketchAndGeneratePrompt(
  sketchDataUrl: string,
): Promise<string> {
  const response = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: 'POST',
    headers: GATEWAY_HEADERS,
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: sketchDataUrl },
            },
            {
              type: 'text',
              text: SKETCH_ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call NanoBanana Pro with the sketch image AND Claude's prompt to generate
 * a photorealistic version of the sketch.
 * Returns a File object ready to pass to Odyssey.
 */
export interface ImageResult {
  file: File;
  dataUrl: string;
}

export async function generatePhotorealisticImage(
  sketchDataUrl: string,
  prompt: string,
): Promise<ImageResult> {
  const response = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: 'POST',
    headers: GATEWAY_HEADERS,
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: sketchDataUrl },
            },
            {
              type: 'text',
              text: `${PHOTOREALISTIC_IMAGE_PROMPT}\n\n${prompt}`,
            },
          ],
        },
      ],
      modalities: ['text', 'image'],
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NanoBanana API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('No message in NanoBanana response');

  // Images are returned in a separate array on the message
  const images = message.images;
  if (!images || !Array.isArray(images) || images.length === 0) {
    throw new Error('No image generated in NanoBanana response');
  }

  const imageData = images[0];
  if (imageData.type !== 'image_url' || !imageData.image_url?.url) {
    throw new Error('Unexpected image format in NanoBanana response');
  }

  // Parse the data URI: "data:image/png;base64,..."
  const dataUri = imageData.image_url.url;
  const match = dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data URI from NanoBanana');

  const mimeType = match[1];
  const base64 = match[2];

  // Convert base64 to File
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const file = new File([blob], `photorealistic.${ext}`, { type: mimeType });
  return { file, dataUrl: dataUri };
}

/**
 * Call Claude Sonnet to generate an optimized Odyssey-2 Pro prompt
 * based on the sketch analysis.
 */
export async function generateOdysseyPrompt(
  sketchAnalysis: string,
): Promise<string> {
  const response = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: 'POST',
    headers: GATEWAY_HEADERS,
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: buildOdysseyPromptMessage(sketchAnalysis),
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export interface PipelineResult {
  image: File;
  imageDataUrl: string;
  odysseyPrompt: string;
  imagePrompt: string;
}

export interface PipelineProgress {
  step: 'imagePrompt' | 'image' | 'odysseyPrompt';
  imagePrompt?: string;
  imageDataUrl?: string;
  odysseyPrompt?: string;
}

/**
 * Run the full generation pipeline:
 * sketch image → Claude analyzes → NanoBanana renders → Claude optimizes Odyssey prompt
 */
export async function runPipeline(
  sketchDataUrl: string,
  onStatus: (status: string) => void,
  onProgress?: (progress: PipelineProgress) => void,
): Promise<PipelineResult> {
  // Step 1: Claude analyzes the sketch and writes a photorealistic prompt
  onStatus('Analyzing sketch with Claude...');
  const imagePrompt = await analyzeSketchAndGeneratePrompt(sketchDataUrl);
  console.log('[Pipeline] Image prompt:', imagePrompt);
  onProgress?.({ step: 'imagePrompt', imagePrompt });

  // Step 2: NanoBanana renders sketch + prompt into photorealistic image
  onStatus('Generating photorealistic image with NanoBanana...');
  const imageResult = await generatePhotorealisticImage(sketchDataUrl, imagePrompt);
  console.log('[Pipeline] Image generated:', imageResult.file.name, imageResult.file.size, 'bytes');
  onProgress?.({ step: 'image', imageDataUrl: imageResult.dataUrl });

  // Step 3: Claude writes optimized Odyssey prompt from the analysis
  onStatus('Optimizing world prompt with Claude...');
  const odysseyPrompt = await generateOdysseyPrompt(imagePrompt);
  console.log('[Pipeline] Odyssey prompt:', odysseyPrompt);
  onProgress?.({ step: 'odysseyPrompt', odysseyPrompt });

  return { image: imageResult.file, imageDataUrl: imageResult.dataUrl, odysseyPrompt, imagePrompt };
}
