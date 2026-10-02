import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}

export type Sql = ReturnType<typeof getSql>;

let cached: Sql | null = null;

export function sql(): Sql {
  if (!cached) {
    cached = getSql();
  }
  return cached;
}

export async function pingDatabase(): Promise<boolean> {
  const result = await sql()`SELECT 1 AS ok`;
  return Number(result[0]?.ok) === 1;
}

/** Refresh daily rollup rows for [fromDate, toDate) usage dates (YYYY-MM-DD). */
export async function refreshCostDailyRollup(
  fromDate: string,
  toDate: string,
): Promise<{ deleted: number; upserted: number }> {
  const db = sql();

  const deletedRows = await db`
    DELETE FROM cost_daily_rollup
    WHERE usage_date >= ${fromDate}::date
      AND usage_date < ${toDate}::date
    RETURNING id
  `;

  const inserted = await db`
    INSERT INTO cost_daily_rollup (
      usage_date,
      provider,
      account_id,
      service,
      region,
      total_cost,
      unallocated_cost,
      allocated_cost,
      line_item_count,
      currency,
      refreshed_at
    )
    SELECT
      (charge_period_start AT TIME ZONE 'UTC')::date AS usage_date,
      provider,
      account_id,
      service,
      region,
      SUM(cost_amount) AS total_cost,
      SUM(CASE WHEN allocation_status IN ('unallocated', 'partial') THEN cost_amount ELSE 0 END) AS unallocated_cost,
      SUM(CASE WHEN allocation_status = 'allocated' THEN cost_amount ELSE 0 END) AS allocated_cost,
      COUNT(*)::integer AS line_item_count,
      currency,
      now() AS refreshed_at
    FROM cost_line_items
    WHERE (charge_period_start AT TIME ZONE 'UTC')::date >= ${fromDate}::date
      AND (charge_period_start AT TIME ZONE 'UTC')::date < ${toDate}::date
    GROUP BY
      (charge_period_start AT TIME ZONE 'UTC')::date,
      provider,
      account_id,
      service,
      region,
      currency
    ON CONFLICT (usage_date, provider, account_id, service, region, currency)
    DO UPDATE SET
      total_cost = EXCLUDED.total_cost,
      unallocated_cost = EXCLUDED.unallocated_cost,
      allocated_cost = EXCLUDED.allocated_cost,
      line_item_count = EXCLUDED.line_item_count,
      refreshed_at = EXCLUDED.refreshed_at
    RETURNING id
  `;

  return { deleted: deletedRows.length, upserted: inserted.length };
}

export type DailyRollupRow = {
  usage_date: string;
  provider: string;
  account_id: string;
  service: string;
  region: string | null;
  total_cost: string;
  unallocated_cost: string;
  allocated_cost: string;
  line_item_count: number | null;
  currency: string;
};

export async function fetchDailyRollupLast30Days(): Promise<DailyRollupRow[]> {
  const db = sql();
  const rows = await db`
    SELECT
      usage_date::text,
      provider,
      account_id,
      service,
      region,
      total_cost::text,
      unallocated_cost::text,
      allocated_cost::text,
      line_item_count,
      currency
    FROM cost_daily_rollup
    WHERE usage_date >= (CURRENT_DATE AT TIME ZONE 'UTC')::date - 30
    ORDER BY usage_date DESC, provider, service, region NULLS LAST
  `;
  return rows as DailyRollupRow[];
}
