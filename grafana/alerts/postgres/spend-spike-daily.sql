-- A1 — Spend spike vs 7-day median (yesterday)
-- Grafana: PostgreSQL datasource, Format = Table, evaluation every 24h (UTC).
-- Alert: WHEN count of rows > 0 (or threshold on ratio_to_median > 2).

WITH base AS (
  SELECT
    provider,
    account_id,
    service,
    usage_date,
    SUM(total_cost) AS daily_cost
  FROM cost_daily_rollup
  WHERE usage_date >= CURRENT_DATE - 8
  GROUP BY provider, account_id, service, usage_date
),
yesterday AS (
  SELECT *
  FROM base
  WHERE usage_date = CURRENT_DATE - 1
),
hist AS (
  SELECT
    provider,
    account_id,
    service,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY daily_cost) AS median_7d
  FROM base
  WHERE usage_date < CURRENT_DATE - 1
  GROUP BY provider, account_id, service
)
SELECT
  y.provider,
  y.account_id,
  y.service,
  y.daily_cost,
  h.median_7d,
  y.daily_cost / NULLIF(h.median_7d, 0) AS ratio_to_median
FROM yesterday y
INNER JOIN hist h USING (provider, account_id, service)
WHERE y.daily_cost >= 50
  AND h.median_7d > 0
  AND y.daily_cost / h.median_7d > 2.0;
