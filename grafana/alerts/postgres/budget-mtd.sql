-- A5 — Month-to-date spend vs sum of budgets (same currency)
-- Requires rows in `budgets`; if empty, query returns no rows (alert stays OK).
-- Grafana: PostgreSQL datasource, Format = Table.
-- Alert warning: pct_of_budget > 0.9; critical: pct_of_budget > 1.0

WITH mtd AS (
  SELECT
    currency,
    SUM(total_cost) AS mtd_cost
  FROM cost_daily_rollup
  WHERE usage_date >= date_trunc('month', CURRENT_DATE)::date
  GROUP BY currency
),
budget AS (
  SELECT
    currency,
    SUM(monthly_limit) AS budget_usd
  FROM budgets
  GROUP BY currency
)
SELECT
  m.currency,
  m.mtd_cost,
  b.budget_usd,
  m.mtd_cost / NULLIF(b.budget_usd, 0) AS pct_of_budget
FROM mtd m
INNER JOIN budget b ON b.currency = m.currency;
