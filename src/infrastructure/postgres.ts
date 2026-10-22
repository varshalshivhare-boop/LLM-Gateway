// ─────────────────────────────────────────────
//  src/infrastructure/postgres.ts
//  Shared Postgres pool for the whole app
// ─────────────────────────────────────────────

import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('[Postgres] unexpected pool error', err);
});
