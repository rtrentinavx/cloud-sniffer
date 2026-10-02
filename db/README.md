# Database (Neon Postgres)

Cloud sniffer stores normalized cost line items, daily rollups, and budgets in **Neon Postgres**.

## Apply schema

**Option A — Neon SQL Editor**

1. Open your Neon project → **SQL Editor**.
2. Paste and run the contents of [`schema.sql`](./schema.sql).

**Option B — `psql`**

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/neondb?sslmode=require'
psql "$DATABASE_URL" -f db/schema.sql
```

Use a connection string from the Neon dashboard; copy into `.env.local` (see [`.env.example`](../.env.example)).

## Vercel connection strings

- Use Neon’s **pooled** connection string (often includes `-pooler` in the host) for serverless/Vercel deployments to avoid exhausting connections.
- Use the **direct** string only for migrations or one-off admin tasks if your tooling requires it.

## Tables

| Table | Purpose |
|-------|---------|
| `cost_line_items` | FOCUS-aligned line items; dedupe via unique `line_item_id` |
| `cost_daily_rollup` | Daily aggregates for dashboards and alerts |
| `budgets` | Named monthly limits with JSON `scope` (team, account, tags, etc.) |

Logical model details: Project docs → Option B implementation plan (`cost_line_items`, `cost_daily_rollup`).

## Daily rollup refresh

After line items change, refresh `cost_daily_rollup` for the affected date range.

**From the app (used by Vercel ingest cron):** `refreshCostDailyRollup(fromDate, toDate)` in `lib/db.ts` — deletes rollup rows in `[from, to)` then re-aggregates from `cost_line_items` grouped by day, provider, account, service, region, and currency.

**Standalone SQL:** [`refresh_rollup.sql`](./refresh_rollup.sql) — same logic for ops / `psql`. Defaults to the last 30 UTC days when `from_date` / `to_date` psql variables are empty:

```bash
psql "$DATABASE_URL" -f db/refresh_rollup.sql
# Or explicit range (inclusive from, exclusive to):
psql "$DATABASE_URL" -v from_date="'2026-01-01'" -v to_date="'2026-02-01'" -f db/refresh_rollup.sql
```

Note: the TypeScript path uses parameterized dates; prefer it from application code on Vercel.

## Grafana read-only access

For [Grafana Cloud](../docs/grafana-cloud-setup.md), run [`grafana_ro.sql`](./grafana_ro.sql) in the Neon SQL Editor (replace the password placeholder first). Grafana uses `grafana_ro`; the Vercel app keeps using its own pooled `DATABASE_URL` user.
