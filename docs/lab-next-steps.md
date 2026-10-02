# Lab next steps (cloud-sniffer)

This deployment is a **lab**: use `.env.local` and Vercel env vars with whatever keys you have. No rotation or secret-hygiene checklist—just get data flowing.

**Stack:** [Vercel cloud-sniffer](https://vercel.com/rtrentins-projects/cloud-sniffer) · [Grafana](https://jollysandpiper580.grafana.net) · Neon Postgres · GitHub [rtrentinavx/cloud-sniffer](https://github.com/rtrentinavx/cloud-sniffer)

---

## 1. Config (done or quick check)

- [ ] `.env.local` — `DATABASE_URL`, `VERCEL_ACCESS_TOKEN`, `VERCEL_TEAM_ID`, `CRON_SECRET`, optional `GRAFANA_CLOUD_*`
- [ ] Same vars on Vercel: [Environment Variables](https://vercel.com/rtrentins-projects/cloud-sniffer/settings/environment-variables) — or `npm run setup:vercel` from a machine with `.env.local`
- [ ] Git connected: pushes to `main` deploy production

---

## 2. Database

- [ ] Neon: run [`db/schema.sql`](../db/schema.sql) if not already applied
- [ ] Optional demo UI: `npm run seed:demo`
- [ ] Grafana read-only user: run [`db/grafana_ro.sql`](../db/grafana_ro.sql) (any password is fine for lab)

---

## 3. Vercel app + ingest

- [ ] Health: `GET /api/health` on production URL → `"database": true`
- [ ] Manual ingest (replace URL and secret):

  ```bash
  curl -sS -H "Authorization: Bearer $CRON_SECRET" \
    "https://YOUR_PRODUCTION_URL/api/cron/ingest-vercel"
  ```

- [ ] Or wait for daily cron (`06:00 UTC`, see `vercel.json`)
- [ ] Home page shows rollup rows (demo or live Vercel billing)
- [ ] If ingest times out: raise `maxDuration` on the cron route; allow cron URL in Deployment Protection if enabled

---

## 4. Grafana Cloud

- [ ] [New PostgreSQL datasource](https://jollysandpiper580.grafana.net/connections/datasources/new) → Neon **direct** host, SSL `require`, user `grafana_ro`
- [ ] [Import dashboard](https://jollysandpiper580.grafana.net/dashboard/import) → [`grafana/dashboards/cost-overview.json`](../grafana/dashboards/cost-overview.json)
- [ ] Optional: alert rules from [`grafana/alerts/postgres/`](../grafana/alerts/postgres/)

Details: [`grafana-cloud-setup.md`](./grafana-cloud-setup.md)

---

## 5. After the lab works

- **Phase 2:** Slack alerts (Grafana or app cron + webhook)
- **Phase 3:** AWS → same Neon schema, then GCP / Azure
- **Utilization:** parked
