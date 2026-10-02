-- A3 — Org-wide unallocated spend % (yesterday)
-- Grafana: PostgreSQL datasource, Format = Table.
-- Alert: WHEN last() of unallocated_pct IS ABOVE 15 for 2d (24h evaluation interval).

SELECT
  usage_date,
  SUM(unallocated_cost) * 100.0 / NULLIF(SUM(total_cost), 0) AS unallocated_pct
FROM cost_daily_rollup
WHERE usage_date = CURRENT_DATE - 1
GROUP BY usage_date;
