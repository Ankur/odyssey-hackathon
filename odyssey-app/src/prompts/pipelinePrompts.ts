export const SKETCH_ANALYSIS_PROMPT = `Analyze this hand-drawn sketch carefully. Identify every element, shape, object, and scene depicted.

Then write a detailed prompt for an AI image generator to create a photorealistic, high-quality version of this exact scene. The photorealistic image must faithfully follow the composition, layout, and content of the sketch. Include specific details about:
- What objects/elements are in the sketch and their spatial arrangement
- Lighting and atmosphere that would suit the scene
- Textures, materials, and surfaces
- Colors and color palette (interpret the sketch colors as intended)
- Composition and perspective
- Environmental details

Be vivid and specific. The output should look like a photograph or a high-end digital painting, not a sketch, but must match the sketch's composition. Output ONLY the image generation prompt, nothing else.`;

export const PHOTOREALISTIC_IMAGE_PROMPT = `Transform this sketch into a photorealistic, high-quality image in 16:9 landscape format. Follow the sketch's composition, layout, and spatial arrangement exactly. Make it look like a real photograph or high-end digital art, not a drawing.`;

export const ODYSSEY_PROMPT_GUIDELINES = `You are an expert at writing prompts for the Odyssey-2 Pro world model.
Odyssey-2 Pro is an action-conditioned world model that generates interactive streaming video.

Write an optimized prompt following these principles:
1. Include subject, environment, style, camera position, composition, focus/lens, and ambiance/mood/lighting
2. Use stative present-continuous descriptions ("is wearing glasses" not "puts on glasses") to avoid action loops
3. Be specific about camera angle and movement (e.g. "the camera slowly pans right", "wide shot, eye-level")
4. Include lighting details (soft light, harsh, neon, sunset, warm tones, etc.)
5. Describe the mood/atmosphere
6. Keep it 1-3 sentences, dense with detail

Output ONLY the Odyssey prompt, nothing else.`;

export function buildOdysseyPromptMessage(sketchAnalysis: string): string {
  return `${ODYSSEY_PROMPT_GUIDELINES}

A photorealistic image has been generated from a hand-drawn sketch. Here is the detailed description of the scene:

"${sketchAnalysis}"

Now write an optimized Odyssey-2 Pro prompt to bring this scene to life as an interactive video. The prompt should describe the scene in a way that creates gentle, natural motion and atmosphere — things like wind, light shifts, ambient movement, etc.`;
}

export function buildImageAnalysisOdysseyMessage(): string {
  return `${ODYSSEY_PROMPT_GUIDELINES}

You are being shown a photorealistic image. Analyze the image carefully — identify the subject, environment, lighting, mood, composition, and all visual details.

Then write an optimized Odyssey-2 Pro prompt to bring this scene to life as an interactive video. The prompt should describe the scene in a way that creates gentle, natural motion and atmosphere — things like wind, water movement, light shifts, ambient movement, etc.

Output ONLY the Odyssey prompt, nothing else.`;
}
