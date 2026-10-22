// ─────────────────────────────────────────────
//  src/utils/keyGenerator.ts
//  API key create + hash utilities
// ─────────────────────────────────────────────

import * as crypto from 'crypto';

const KEY_PREFIX = 'gw_live_';

/**
 * Nayi API key banata hai. plainKey user ko SIRF EK BAAR dikhao,
 * DB mein sirf keyHash (SHA-256) store karo.
 */
export function generateApiKey(): { plainKey: string; keyHash: string } {
  const plainKey = `${KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
  return { plainKey, keyHash: hashApiKey(plainKey) };
}

export function hashApiKey(plainKey: string): string {
  return crypto.createHash('sha256').update(plainKey).digest('hex');
}