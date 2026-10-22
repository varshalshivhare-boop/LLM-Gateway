-- Phase 3 schema: tenants, api_keys, monthly_spend
CREATE TABLE IF NOT EXISTS tenants (
  id                 SERIAL PRIMARY KEY,
  email              TEXT UNIQUE NOT NULL,
  monthly_budget_usd NUMERIC(12,6) NOT NULL DEFAULT 10.00,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash   TEXT UNIQUE NOT NULL,           -- SHA-256 hash; plain key kabhi store nahi
  label      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  rpm_limit  INT NOT NULL DEFAULT 60,
  tpm_limit  INT NOT NULL DEFAULT 100000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cost engine (Part 3) har mahine ka spend yahan upsert karega;
-- auth middleware budget check isi table se karta hai (O(1) read)
CREATE TABLE IF NOT EXISTS monthly_spend (
  tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month     TIMESTAMPTZ NOT NULL,            -- date_trunc('month', now())
  spend_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, month)
);
