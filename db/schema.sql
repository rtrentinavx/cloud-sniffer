-- Cloud sniffer — Neon Postgres schema (FOCUS-aligned cost lake)
-- Apply via Neon SQL Editor or: psql "$DATABASE_URL" -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- cost_line_items — normalized line items from all providers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_line_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period_start DATE,
  billing_period_end   DATE,
  charge_period_start  TIMESTAMPTZ NOT NULL,
  provider             TEXT NOT NULL,
  account_id           TEXT NOT NULL,
  sub_account_id       TEXT,
  region               TEXT,
  service              TEXT NOT NULL,
  sku                  TEXT,
  resource_id          TEXT,
  resource_name        TEXT,
  cost_amount          NUMERIC(18, 6) NOT NULL,
  currency             CHAR(3) NOT NULL,
  tags                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  tag_team             TEXT,
  tag_env              TEXT,
  tag_project          TEXT,
  allocation_status    TEXT NOT NULL DEFAULT 'unallocated'
    CHECK (allocation_status IN ('allocated', 'partial', 'unallocated')),
  line_item_id         TEXT NOT NULL,
  ingested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cost_line_items_line_item_id_key UNIQUE (line_item_id)
);

CREATE INDEX IF NOT EXISTS idx_cost_line_items_charge_period
  ON cost_line_items (charge_period_start DESC);

CREATE INDEX IF NOT EXISTS idx_cost_line_items_provider_account_service
  ON cost_line_items (provider, account_id, service);

CREATE INDEX IF NOT EXISTS idx_cost_line_items_allocation
  ON cost_line_items (allocation_status)
  WHERE allocation_status <> 'allocated';

CREATE INDEX IF NOT EXISTS idx_cost_line_items_tags
  ON cost_line_items USING gin (tags);

-- ---------------------------------------------------------------------------
-- cost_daily_rollup — primary dashboard and alert source (daily refresh)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_daily_rollup (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date         DATE NOT NULL,
  provider           TEXT NOT NULL,
  account_id         TEXT NOT NULL,
  service            TEXT NOT NULL,
  region             TEXT,
  total_cost         NUMERIC(18, 6) NOT NULL DEFAULT 0,
  unallocated_cost   NUMERIC(18, 6) NOT NULL DEFAULT 0,
  allocated_cost     NUMERIC(18, 6) NOT NULL DEFAULT 0,
  line_item_count    INTEGER,
  currency           CHAR(3) NOT NULL,
  refreshed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cost_daily_rollup_dims_key
    UNIQUE (usage_date, provider, account_id, service, region, currency)
);

CREATE INDEX IF NOT EXISTS idx_cost_daily_rollup_usage_date
  ON cost_daily_rollup (usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_cost_daily_rollup_provider_date
  ON cost_daily_rollup (provider, usage_date DESC);

-- ---------------------------------------------------------------------------
-- budgets — monthly limits scoped by team, account, or tag filters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  scope          JSONB NOT NULL DEFAULT '{}'::jsonb,
  monthly_limit  NUMERIC(18, 6) NOT NULL,
  currency       CHAR(3) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_scope
  ON budgets USING gin (scope);
