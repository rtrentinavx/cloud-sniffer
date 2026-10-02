-- Refresh cost_daily_rollup for a date range from cost_line_items.
-- Usage (psql): \set from_date '2025-01-01' \set to_date '2025-02-01'
--   psql "$DATABASE_URL" -v from_date="'2025-01-01'" -v to_date="'2025-02-01'" -f db/refresh_rollup.sql
--
-- Parameters (optional, via psql -v):
--   from_date — inclusive usage date (DATE), default: 30 days ago
--   to_date   — exclusive usage date (DATE), default: tomorrow (UTC)

DELETE FROM cost_daily_rollup
WHERE usage_date >= COALESCE(NULLIF(:'from_date', '')::date, (CURRENT_DATE AT TIME ZONE 'UTC')::date - 30)
  AND usage_date <  COALESCE(NULLIF(:'to_date', '')::date, (CURRENT_DATE AT TIME ZONE 'UTC')::date + 1);

INSERT INTO cost_daily_rollup (
  usage_date,
  provider,
  account_id,
  service,
  region,
  total_cost,
  unallocated_cost,
  allocated_cost,
  line_item_count,
  currency,
  refreshed_at
)
SELECT
  (charge_period_start AT TIME ZONE 'UTC')::date AS usage_date,
  provider,
  account_id,
  service,
  region,
  SUM(cost_amount) AS total_cost,
  SUM(CASE WHEN allocation_status IN ('unallocated', 'partial') THEN cost_amount ELSE 0 END) AS unallocated_cost,
  SUM(CASE WHEN allocation_status = 'allocated' THEN cost_amount ELSE 0 END) AS allocated_cost,
  COUNT(*)::integer AS line_item_count,
  currency,
  now() AS refreshed_at
FROM cost_line_items
WHERE (charge_period_start AT TIME ZONE 'UTC')::date >= COALESCE(NULLIF(:'from_date', '')::date, (CURRENT_DATE AT TIME ZONE 'UTC')::date - 30)
  AND (charge_period_start AT TIME ZONE 'UTC')::date <  COALESCE(NULLIF(:'to_date', '')::date, (CURRENT_DATE AT TIME ZONE 'UTC')::date + 1)
GROUP BY
  (charge_period_start AT TIME ZONE 'UTC')::date,
  provider,
  account_id,
  service,
  region,
  currency
ON CONFLICT (usage_date, provider, account_id, service, region, currency)
DO UPDATE SET
  total_cost = EXCLUDED.total_cost,
  unallocated_cost = EXCLUDED.unallocated_cost,
  allocated_cost = EXCLUDED.allocated_cost,
  line_item_count = EXCLUDED.line_item_count,
  refreshed_at = EXCLUDED.refreshed_at;
