-- Grafana Cloud read-only role for Neon Postgres (cloud-sniffer)
-- Run in Neon → SQL Editor as the project owner (or another admin role).
-- Do NOT commit real passwords; replace the placeholder before running.

-- 1) Choose a strong password and set it below (or create the role in Neon UI and skip CREATE).
CREATE ROLE grafana_ro WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD' NOINHERIT;

-- 2) Database connect (Neon default database name is often `neondb` — adjust if yours differs)
GRANT CONNECT ON DATABASE neondb TO grafana_ro;

-- 3) Schema + table SELECT (rollup is primary; line items + budgets for drill-down / budget alerts)
GRANT USAGE ON SCHEMA public TO grafana_ro;

GRANT SELECT ON TABLE
  cost_daily_rollup,
  cost_line_items,
  budgets
TO grafana_ro;

-- Optional: allow Grafana to read sequences if you add serial columns later
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO grafana_ro;

-- Verify (as admin):
-- SET ROLE grafana_ro; SELECT COUNT(*) FROM cost_daily_rollup; RESET ROLE;
