/**
 * Edit pipeline: uses GPT-5 mini to analyze before/after scene images
 * and generate an Odyssey interact-style prompt describing the visual diff.
 */

import { EDIT_INTERACT_SYSTEM_PROMPT, EDIT_DIFF_INSTRUCTION } from '../prompts/editPrompts';

const GATEWAY_BASE = '/api/gateway/v1';
const GATEWAY_HEADERS = { 'Content-Type': 'application/json' };

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
          content: EDIT_INTERACT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'BEFORE:' },
            { type: 'image_url', image_url: { url: beforeImageUrl } },
            { type: 'text', text: 'AFTER:' },
            { type: 'image_url', image_url: { url: afterImageUrl } },
            { type: 'text', text: EDIT_DIFF_INSTRUCTION },
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
