// ─────────────────────────────────────────────
//  src/scripts/issueKey.ts
//  One-off CLI: tenant + API key create karo
//  Run: npx ts-node --transpile-only src/scripts/issueKey.ts test@example.com
// ─────────────────────────────────────────────

import 'dotenv/config';
import { pool } from '../infrastructure/postgres';
import { generateApiKey } from '../utils/keyGenerator';

async function main() {
  const email = process.argv[2] || 'test@example.com';
  const { plainKey, keyHash } = generateApiKey();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tenantRes = await client.query(
      `INSERT INTO tenants (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [email]
    );
    const tenantId = tenantRes.rows[0].id;

    await client.query(
      `INSERT INTO api_keys (tenant_id, key_hash, label)
       VALUES ($1, $2, 'dev-key')`,
      [tenantId, keyHash]
    );

    await client.query('COMMIT');
    console.log(`Tenant: ${email} (id ${tenantId})`);
    console.log(`API Key (sirf ek baar dikhegi, save kar lo): ${plainKey}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
