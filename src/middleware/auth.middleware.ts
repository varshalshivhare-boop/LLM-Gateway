// ─────────────────────────────────────────────
//  src/middleware/auth.middleware.ts
//  Step 3.1 — API Key verify + monthly budget check
// ─────────────────────────────────────────────

import * as crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../infrastructure/postgres';

export interface ApiKeyData {
  keyId: number;
  tenantId: number;
  rpmLimit: number;
  tpmLimit: number;
  monthlyBudgetUsd: number;
  spentUsd: number;
}

// Rate limiter (Step 3.2) req.apiKeyData padhega
declare global {
  namespace Express {
    interface Request {
      apiKeyData?: ApiKeyData;
    }
  }
}

// Security rule: plain key kabhi DB mein nahi jaati — sirf SHA-256 hash
const sha256 = (rawKey: string): string =>
  crypto.createHash('sha256').update(rawKey).digest('hex');

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  // 1. Header se key extract karo
  const header = req.headers.authorization;
  const rawKey = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!rawKey) {
    return res.status(401).json({ error: 'Missing API Key' });
  }

  // 2. SHA-256 hash nikaalo
  const keyHash = sha256(rawKey);

  try {
    // 3. key_hash exist karta hai aur is_active hai?
    //    (TODO Part 2: Redis cache-aside, TTL ~60s — abhi direct DB lookup)
    const keyRes = await pool.query(
      `SELECT ak.id, ak.tenant_id, ak.rpm_limit, ak.tpm_limit, t.monthly_budget_usd
         FROM api_keys ak
         JOIN tenants t ON t.id = ak.tenant_id
        WHERE ak.key_hash = $1 AND ak.is_active = true`,
      [keyHash]
    );

    if (keyRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }
    const row = keyRes.rows[0];

    // 4. Is mahine ka total kharcha monthly budget se compare karo
    const spendRes = await pool.query(
      `SELECT spend_usd FROM monthly_spend
        WHERE tenant_id = $1 AND month = date_trunc('month', now())`,
      [row.tenant_id]
    );
    const spentUsd = Number(spendRes.rows[0]?.spend_usd ?? 0);

    if (spentUsd >= Number(row.monthly_budget_usd)) {
      return res.status(402).json({ error: 'Payment Required — monthly budget exceeded' });
    }

    // 5. Key info attach karo taaki agla middleware (rate limiter) use kar sake
    req.apiKeyData = {
      keyId: row.id,
      tenantId: row.tenant_id,
      rpmLimit: row.rpm_limit,
      tpmLimit: row.tpm_limit,
      monthlyBudgetUsd: Number(row.monthly_budget_usd),
      spentUsd,
    };
    return next();
  } catch (err) {
    console.error('[Auth] key lookup failed', err);
    return res.status(500).json({ error: 'Auth service unavailable' });
  }
}
