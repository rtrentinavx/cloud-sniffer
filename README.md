# Cloud sniffer

Multi-cloud cost visibility: ingest FOCUS-aligned billing data, roll up daily spend, and drive allocation and budget alerts.

**Repository:** https://github.com/rtrentinavx/cloud-sniffer

**Phase 1b:** Next.js app on Vercel, Neon Postgres cost lake, daily **Vercel billing ingest** via cron.

## Stack

| Layer | Service |
|-------|---------|
| App | [Vercel](https://vercel.com) — Next.js 15 App Router, cron |
| Cost lake | [Neon](https://neon.tech) — Postgres (`cost_line_items`, `cost_daily_rollup`, `budgets`) |
| Dashboards / alerts (optional) | [Grafana Cloud](https://grafana.com/products/cloud/) — same Neon read-only user |
| Cache / dedup (planned) | [Upstash](https://upstash.com) — Redis |

Billing data is **read** from provider APIs (Vercel first); the app stays on neutral PaaS.

## Local development

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL (and optional Vercel tokens)
psql "$DATABASE_URL" -f db/schema.sql
npm run dev                  # http://127.0.0.1:43123
```

Optional lab data without a Vercel token:

```bash
npm run seed:demo
```

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on port **43123** |
| `npm run build` | Production build |
| `npm run test` | Unit tests (FOCUS → line item mapping) |
| `npm run seed:demo` | Insert sample Vercel costs + refresh rollup |

### Health

- `GET /api/health` — Neon ping (`DATABASE_URL` required)

## Environment variables

**For now**, keep credentials and account scope in **`.env.local`** (see [`.env.example`](./.env.example)). Production on Vercel still needs the same keys in the project dashboard—or run `npm run setup:vercel` to push from `.env.local`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon Postgres (pooled URL on Vercel) |
| `VERCEL_ACCESS_TOKEN` | For live ingest | Bearer token with access to [List FOCUS billing charges](https://vercel.com/docs/rest-api/billing/list-focus-billing-charges) |
| `VERCEL_TEAM_ID` | Team ingest | Vercel team id (`team_…`); stored as `account_id` |
| `CRON_SECRET` | Production cron | Random string; Vercel sends `Authorization: Bearer …` |
| `REQUIRED_TAG_KEYS` | No | e.g. `team,env,project` — all must exist on tags for `allocated` |
| `UPSTASH_*` | Later | Redis for dedup / alerts |

Lab: keep secrets in `.env.local` (gitignored) and Vercel env—see [`docs/lab-next-steps.md`](docs/lab-next-steps.md).

## Grafana Cloud

Optional FinOps dashboards and daily alerts against the same Neon rollup tables as this app (does not replace the Next.js UI).

1. Create read-only role: [`db/grafana_ro.sql`](db/grafana_ro.sql) in Neon SQL Editor.
2. Add a PostgreSQL datasource and import [`grafana/dashboards/cost-overview.json`](grafana/dashboards/cost-overview.json).
3. Wire alert SQL from [`grafana/alerts/postgres/`](grafana/alerts/postgres/).

Full steps: [`docs/grafana-cloud-setup.md`](docs/grafana-cloud-setup.md).

## Vercel billing ingest

- **API:** `GET https://api.vercel.com/v1/billing/charges?from=&to=&teamId=` (JSONL, FOCUS v1.3).
- **Cron route:** `GET /api/cron/ingest-vercel` ingests the **last 3 days** by default (also accepts `POST` with JSON `{ "from", "to" }` ISO ranges for backfill).
- **Schedule:** `vercel.json` — `0 6 * * *` (06:00 UTC daily).
- **Flow:** stream charges → upsert `cost_line_items` (`provider='Vercel'`, stable `line_item_id`) → refresh `cost_daily_rollup` for affected dates.

### API gaps / access

- Endpoint requires a token with permission for the target **team** (Owner, Member, Developer, Security, Billing, or Enterprise Viewer roles per Vercel docs).
- **Personal** accounts may need omitting `teamId`; set `VERCEL_TEAM_ID` empty and ingest uses `account_id='personal'`.
- Invoices and PDF breakdowns are **dashboard-only**; programmatic cost data is this FOCUS charges stream (not legacy usage-only APIs).
- If billing API returns 403/404 in your plan, use `npm run seed:demo` for lab UI and fix token/team scope before production.

## Deploy on Vercel

### One-time (Vercel CLI on your machine)

1. Apply Neon schema if needed: `psql "$DATABASE_URL" -f db/schema.sql`
2. In `.env.local` set:
   - `DATABASE_URL` — Neon **pooled** URL
   - `VERCEL_ACCESS_TOKEN` — [Account token](https://vercel.com/account/tokens) with access to [FOCUS billing charges](https://vercel.com/docs/rest-api/billing/list-focus-billing-charges) for your team/personal account
   - `VERCEL_TEAM_ID` — `team_…` if ingesting **team** billing (omit for personal)
   - `CRON_SECRET` — optional; `scripts/vercel-setup.sh` generates one if missing
3. Log in and link + deploy:

   ```bash
   vercel login
   npm run setup:vercel
   ```

   This runs `vercel link`, pushes env vars to **production / preview / development**, and `vercel deploy --prod`.

### Manual (dashboard)

1. Import the repo and set the same env vars in **Project → Settings → Environment Variables**.
2. Deploy; cron is defined in `vercel.json` (`0 6 * * *` → `/api/cron/ingest-vercel`).

## Repository layout

```
app/
  page.tsx                      # Last 30 days rollup dashboard
  api/health/route.ts           # DB health
  api/cron/ingest-vercel/       # Billing ingest + rollup refresh
db/
  schema.sql
  grafana_ro.sql                  # Read-only role for Grafana Cloud
  refresh_rollup.sql            # Standalone rollup SQL (see db/README.md)
docs/
  grafana-cloud-setup.md          # Grafana Cloud + Neon wiring
grafana/
  dashboards/cost-overview.json
  alerts/postgres/                # Alert rule SQL (Postgres)
lib/
  db.ts                         # Neon client + rollup refresh
  vercel/                       # FOCUS fetch, map, ingest
scripts/seed-demo-costs.ts      # Lab sample data
vercel.json                     # Cron schedule
```

## Related documentation

Project planning docs live in the Cloud Sniffer Project Context store (Option B stack, alerts, multi-cloud ingest).
