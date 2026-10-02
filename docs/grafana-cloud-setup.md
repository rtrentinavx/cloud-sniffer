# Grafana Cloud setup (Neon Postgres)

**Lab:** use simple passwords and tokens; no rotation checklist required.

Wire [Grafana Cloud](https://grafana.com/products/cloud/) to the same Neon cost lake as the Next.js app. Grafana complements the Vercel UI for dashboards, FinOps alerting, and Slack notifications.

**Repo artifacts**

| Path | Purpose |
|------|---------|
| [`db/grafana_ro.sql`](../db/grafana_ro.sql) | Read-only DB role for Grafana |
| [`grafana/dashboards/cost-overview.json`](../grafana/dashboards/cost-overview.json) | Importable cost dashboard |
| [`grafana/alerts/postgres/`](../grafana/alerts/postgres/) | SQL for unified alert rules |

---

## 1. Create a Grafana Cloud stack

1. Sign in at [grafana.com](https://grafana.com/) → **My Account** → **My stacks** (or start a free Cloud trial).
2. Open your stack → note the **stack URL** (e.g. `https://YOURORG.grafana.net`).
3. Optional for automation: **Administration** → **Service accounts** → token with **Editor** → add to `.env.local` / Vercel (see [`.env.example`](../.env.example)).

Set the stack timezone to **UTC** for daily cost rules (Alerting → Notification policies / rule groups).

---

## 2. Neon: read-only user

1. Open [Neon](https://console.neon.tech) → your project → **SQL Editor**.
2. Edit [`db/grafana_ro.sql`](../db/grafana_ro.sql): set a strong password and confirm the database name (`neondb` or yours).
3. Run the script as an admin role.
4. Verify:

   ```sql
   SET ROLE grafana_ro;
   SELECT COUNT(*) FROM cost_daily_rollup;
   RESET ROLE;
   ```

Use the **`grafana_ro` login** in Grafana—not your app’s `DATABASE_URL` user—so Grafana cannot mutate cost data.

---

## 3. Neon network access for Grafana Cloud

Grafana Cloud query runners connect from Grafana’s egress IPs, not your laptop.

1. Neon → **Project settings** → **IP Allow** (if enabled on your plan).
2. Allow [Grafana Cloud published IP ranges](https://grafana.com/docs/grafana-cloud/account-management/automatically-exported-dashboards-and-alerts/) for your region, **or** disable allowlisting for the project if your policy permits (less restrictive).
3. Use Neon’s **direct** connection host for the PostgreSQL datasource (not the `-pooler` host). Grafana maintains long-lived connections; direct endpoints are appropriate for BI/alerting.

Connection string shape (placeholder):

```text
postgresql://grafana_ro:PASSWORD@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## 4. Add PostgreSQL datasource in Grafana

1. Stack → **Connections** → **Add new connection** → **PostgreSQL**.
2. **Host** / **URL**: Neon host (port `5432`), database `neondb` (or yours).
3. **User** / **Password**: `grafana_ro` and the password from step 2.
4. **TLS/SSL Mode**: `require` (match Neon).
5. **PostgreSQL version**: 15+ (Neon default).
6. **Save & test** — should succeed if IP allow and credentials are correct.
7. Copy the datasource **UID** (Connections → PostgreSQL → Settings) if you hand-edit dashboards; imports use `${DS_POSTGRES}` via the dashboard `__inputs` prompt.

Recommended: set **Default database** and leave **Timescale** off unless you add it later.

---

## 5. Import the cost dashboard

1. **Dashboards** → **New** → **Import**.
2. Upload [`grafana/dashboards/cost-overview.json`](../grafana/dashboards/cost-overview.json).
3. When prompted, map **PostgreSQL (Neon)** to the datasource you created.
4. Open **Cloud sniffer — Cost overview** and confirm panels show data after ingest or `npm run seed:demo`.

Folder suggestion: create a **Cloud Sniffer** folder and move the dashboard there for team navigation.

---

## 6. Alert rules (overview)

SQL lives under [`grafana/alerts/postgres/`](../grafana/alerts/postgres/). Create rules in **Alerting** → **Alert rules** → **New alert rule** → query type **PostgreSQL**, paste SQL, **Format: Table**.

| File | Concept | Suggested condition |
|------|---------|---------------------|
| [`spend-spike-daily.sql`](../grafana/alerts/postgres/spend-spike-daily.sql) | Yesterday vs 7d median | **Reduce** → **Count** of rows **> 0** |
| [`allocation-gap-daily.sql`](../grafana/alerts/postgres/allocation-gap-daily.sql) | Unallocated % yesterday | **Last** of `unallocated_pct` **> 15** for **2d** |
| [`budget-mtd.sql`](../grafana/alerts/postgres/budget-mtd.sql) | MTD vs `budgets` table | **Last** of `pct_of_budget` **> 0.9** (warning), **> 1.0** (critical) |

**Rule group settings (daily FinOps)**

- **Evaluate every**: `24h`
- **Pending period**: `0m` (spike) or `2d` (allocation gap)
- **Timezone**: UTC

**Contact points**: Alerting → **Contact points** → **Slack** (incoming webhook). Test before attaching to rules.

**Annotations** (example for spike):

```text
Spend spike: {{ $labels.provider }}/{{ $labels.account_id }}/{{ $labels.service }}
```

Adapt label templates to the columns your query returns.

Provisioning alert JSON in Git is optional; Grafana versions differ. Prefer UI-first, then export if you adopt GitOps later.

---

## 7. Optional environment variables (API provisioning)

Not required for manual datasource + import. For scripts or future Terraform/grafana-operator:

| Variable | Description |
|----------|-------------|
| `GRAFANA_CLOUD_STACK_URL` | Stack base URL (`https://YOURORG.grafana.net`) |
| `GRAFANA_CLOUD_SERVICE_ACCOUNT_TOKEN` | Service account token with Editor |
| `GRAFANA_CLOUD_DATASOURCE_UID` | PostgreSQL datasource UID after creation |

See commented entries in [`.env.example`](../.env.example).

---

## 8. Data freshness

Rollups refresh when:

- Vercel cron runs [`/api/cron/ingest-vercel`](../app/api/cron/ingest-vercel/route.ts), or
- You run [`db/refresh_rollup.sql`](../db/refresh_rollup.sql) / `refreshCostDailyRollup` locally.

Grafana reads `cost_daily_rollup`; schedule alerts **after** your ingest cron (e.g. ingest 06:00 UTC, evaluate alerts 07:00 UTC).

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Datasource test fails | Neon IP allow, password, SSL mode, direct host |
| Empty dashboard | Schema applied, seed or ingest run, date range includes `usage_date` |
| Budget alert never fires | Rows in `budgets` with matching `currency` |
| Spike alert noisy | Raise `$50` floor or `2.0` ratio in SQL |

For schema details see [`db/README.md`](../db/README.md).
