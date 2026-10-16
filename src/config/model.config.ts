// ─────────────────────────────────────────────
//  src/config/model.config.ts
//  Central place to manage Gemini model settings
// ─────────────────────────────────────────────
//
//  Run availability test anytime:
//  node src/config/test-models.js
// ─────────────────────────────────────────────

// All known Gemini models — update status after running test-models.js
// Status key:  ✅ working  |  ⚠️ overloaded (free tier)  |  ❌ unavailable/deprecated
export const ALL_MODELS = {
  'gemini-3.8-flash':      '⚠️  available but may 503 on free tier',
  'gemini-2.5-pro':        '❌ not tested / may be unavailable',
  'gemini-2.5-flash':      '❌ deprecated on this key',
  'gemini-2.0-flash':      '❌ deprecated on this key',
  'gemini-2.0-flash-lite': '❌ deprecated on this key',
  'gemini-1.5-pro':        '❌ deprecated on this key',
  'gemini-1.5-flash':      '❌ deprecated on this key',
};

// ── Active fallback list ───────────────────────────────────────────────────
// Add working models here in priority order (first = primary, rest = fallback)
// After running test-models.js, move ✅ models to this list.
export const FALLBACK_MODELS: string[] = [
  'gemini-3.8-flash',
];

// ── Gemini API settings ────────────────────────────────────────────────────
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Retry settings for 503 / 429 responses
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 2000; // multiplied by attempt: 2s, 4s, 6s
export const REQUEST_TIMEOUT_MS = 20000;
