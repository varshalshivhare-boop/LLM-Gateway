// ─────────────────────────────────────────────
//  src/services/gemini.service.ts
//  All Gemini API calls, retry logic, and fallback
// ─────────────────────────────────────────────

const axios = require('axios');
import {
  FALLBACK_MODELS,
  GEMINI_BASE_URL,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  REQUEST_TIMEOUT_MS,
} from '../config/model.config';

interface GeminiCallOptions {
  contents: object[];
  stream?: boolean;
}

interface GeminiResult {
  response: any;
  modelUsed: string;
}

/**
 * Calls Gemini API with automatic retry (on 503/429) and model fallback.
 * Returns the axios response and the model that finally succeeded.
 */
export async function callGeminiWithFallback({
  contents,
  stream = false,
}: GeminiCallOptions): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing. Add it to your .env file.');
  }

  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    const endpoint = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const url = `${GEMINI_BASE_URL}/${model}:${endpoint}&key=${apiKey}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios({
          method: 'post',
          url,
          headers: { 'Content-Type': 'application/json' },
          data: { contents },
          responseType: stream ? 'stream' : 'json',
          timeout: REQUEST_TIMEOUT_MS,
        });

        return { response, modelUsed: model };
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;

        if (status === 503 || status === 429) {
          const waitMs = RETRY_DELAY_MS * attempt; // 2s, 4s, 6s, 8s, 10s
          console.warn(
            `[Gemini] ${model} attempt ${attempt}/${MAX_RETRIES} → ${status}. Retrying in ${waitMs}ms...`
          );
          await new Promise((r) => setTimeout(r, waitMs));
        } else {
          // 404, 400, 401 — no point retrying this model
          console.warn(`[Gemini] ${model} returned ${status}. Skipping.`);
          break;
        }
      }
    }

    if (FALLBACK_MODELS.indexOf(model) < FALLBACK_MODELS.length - 1) {
      console.warn(`[Gemini] Switching from ${model} to next model in fallback list...`);
    }
  }

  throw lastError;
}
