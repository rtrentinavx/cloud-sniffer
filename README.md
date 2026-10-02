# Cloud sniffer

Multi-cloud cost visibility: ingest FOCUS-aligned billing data, roll up daily spend, and drive allocation and budget alerts.

**Phase 1a (this repo):** Postgres schema and runbook for the cost lake on **Neon**. App ingest and UI come in later phases.

## Stack

| Layer | Service |
|-------|---------|
| App (planned) | [Vercel](https://vercel.com) — Next.js API, cron |
| Cost lake | [Neon](https://neon.tech) — Postgres |
| Cache / dedup (planned) | [Upstash](https://upstash.com) — Redis |

Billing data is **read** from AWS, GCP, Azure, and SaaS APIs; the application platform stays on neutral PaaS (not CSP-hosted).

## Local setup

1. Clone the repo and copy env placeholders:

   ```bash
   cp .env.example .env.local
   ```

2. Create a Neon project and set `DATABASE_URL` in `.env.local` (pooled URL is fine for local dev).

3. Apply the database schema:

   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```

   See [`db/README.md`](./db/README.md) for Neon SQL Editor steps and Vercel connection guidance.

4. **Never commit** real `DATABASE_URL` values or passwords. Rotate Neon credentials if they were ever exposed.

## Repository layout

```
db/
  schema.sql    # cost_line_items, cost_daily_rollup, budgets
  README.md     # apply schema, pooled vs direct URLs
.env.example    # placeholder env vars only
```

## Related documentation

Project planning docs (architecture, ingest, alerts) live in the Cloud Sniffer Project Context store — start with the Option B PaaS stack and implementation plan.
