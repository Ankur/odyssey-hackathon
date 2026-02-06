/**
 * Edit pipeline: uses GPT-5 mini to analyze before/after scene images
 * and generate an Odyssey interact-style prompt describing the visual diff.
 */

const GATEWAY_BASE = '/api/gateway/v1';
const GATEWAY_HEADERS = { 'Content-Type': 'application/json' };

const INTERACT_SYSTEM_PROMPT = `You are an expert at writing interact prompts for the Odyssey-2 Pro world model.

An interact prompt describes a change happening in a scene — concise (1-2 sentences), present continuous tense, describing observable changes (weather, lighting, objects, motion). Be vivid and specific. Do not describe loops or repeated actions.

Examples:
- "A warm golden light is spreading across the sky as the sun begins to set, casting long shadows from the house and tree."
- "Heavy rain is starting to fall, with dark storm clouds rolling in from the left and puddles forming on the ground."
- "A bright red bird is landing on the tree branch, its wings outstretched as leaves gently rustle around it."

Output ONLY the interact prompt, nothing else.`;

/**
 * Analyze the visual diff between a before and after scene image,
 * returning an Odyssey interact-style prompt.
 */
export async function analyzeEditChanges(
  beforeImageUrl: string,
  afterImageUrl: string,
): Promise<string> {
  const response = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: 'POST',
    headers: GATEWAY_HEADERS,
    body: JSON.stringify({
      model: 'openai/gpt-5-mini',
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content: INTERACT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'BEFORE:' },
            { type: 'image_url', image_url: { url: beforeImageUrl } },
            { type: 'text', text: 'AFTER:' },
            { type: 'image_url', image_url: { url: afterImageUrl } },
            {
              type: 'text',
              text: 'Compare these two images. The AFTER image has hand-drawn edits on top of the BEFORE scene. Describe what changed as an Odyssey interact prompt — focus on the visual modifications the user drew.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GPT-5 mini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
