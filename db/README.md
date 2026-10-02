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

Use a connection string from the Neon dashboard. Do not commit real credentials; copy values into `.env.local` locally (see [`.env.example`](../.env.example)).

## Vercel connection strings

- Use Neon’s **pooled** connection string (often includes `-pooler` in the host) for serverless/Vercel deployments to avoid exhausting connections.
- Use the **direct** string only for migrations or one-off admin tasks if your tooling requires it.

## Security

- Keep `DATABASE_URL` in `.env` / `.env.local` only (both are gitignored).
- If a database URL or password was exposed in chat, logs, or a commit, **rotate credentials in Neon** and update Vercel env vars before deploying.

## Tables

| Table | Purpose |
|-------|---------|
| `cost_line_items` | FOCUS-aligned line items; dedupe via unique `line_item_id` |
| `cost_daily_rollup` | Daily aggregates for dashboards and alerts |
| `budgets` | Named monthly limits with JSON `scope` (team, account, tags, etc.) |

Logical model details: Project docs → Option B implementation plan (`cost_line_items`, `cost_daily_rollup`).
