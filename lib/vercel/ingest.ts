import { refreshCostDailyRollup, sql } from "@/lib/db";
import { collectVercelBillingCharges } from "./fetch-billing-charges";
import { mapFocusChargeToLineItem } from "./map-focus-charge";

export type IngestVercelResult = {
  fetched: number;
  upserted: number;
  rollupFrom: string;
  rollupTo: string;
  rollup: { deleted: number; upserted: number };
};

function parseRequiredTagKeys(): string[] {
  const raw = process.env.REQUIRED_TAG_KEYS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultIngestWindow(): { from: string; to: string } {
  const now = new Date();
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 32);
  return { from: from.toISOString(), to: to.toISOString() };
}

function usageDateFromIso(iso: string): string {
  return iso.slice(0, 10);
}

export async function ingestVercelBilling(options?: {
  from?: string;
  to?: string;
}): Promise<IngestVercelResult> {
  const token = process.env.VERCEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("VERCEL_ACCESS_TOKEN is not set");
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const accountId = teamId ?? "personal";
  const window = defaultIngestWindow();
  const from = options?.from ?? window.from;
  const to = options?.to ?? window.to;

  const charges = await collectVercelBillingCharges({
    token,
    from,
    to,
    teamId: teamId || undefined,
  });

  const requiredTagKeys = parseRequiredTagKeys();
  const mapped = charges.map((c) =>
    mapFocusChargeToLineItem(c, accountId, requiredTagKeys),
  );

  const db = sql();
  let upserted = 0;

  for (const item of mapped) {
    await db`
      INSERT INTO cost_line_items (
        billing_period_start,
        billing_period_end,
        charge_period_start,
        charge_period_end,
        provider,
        account_id,
        sub_account_id,
        region,
        service,
        sku,
        resource_id,
        resource_name,
        cost_amount,
        currency,
        tags,
        tag_team,
        tag_env,
        tag_project,
        allocation_status,
        line_item_id
      ) VALUES (
        ${item.billing_period_start}::date,
        ${item.billing_period_end}::date,
        ${item.charge_period_start}::timestamptz,
        ${item.charge_period_end}::timestamptz,
        ${item.provider},
        ${item.account_id},
        ${item.sub_account_id},
        ${item.region},
        ${item.service},
        ${item.sku},
        ${item.resource_id},
        ${item.resource_name},
        ${item.cost_amount},
        ${item.currency},
        ${JSON.stringify(item.tags)}::jsonb,
        ${item.tag_team},
        ${item.tag_env},
        ${item.tag_project},
        ${item.allocation_status},
        ${item.line_item_id}
      )
      ON CONFLICT (line_item_id) DO UPDATE SET
        cost_amount = EXCLUDED.cost_amount,
        tags = EXCLUDED.tags,
        tag_team = EXCLUDED.tag_team,
        tag_env = EXCLUDED.tag_env,
        tag_project = EXCLUDED.tag_project,
        allocation_status = EXCLUDED.allocation_status,
        charge_period_end = EXCLUDED.charge_period_end,
        ingested_at = now()
    `;
    upserted += 1;
  }

  const usageDates = mapped.map((m) => usageDateFromIso(m.charge_period_start));
  const rollupFrom =
    usageDates.length > 0
      ? usageDates.reduce((a, b) => (a < b ? a : b))
      : from.slice(0, 10);
  const rollupTo =
    usageDates.length > 0
      ? (() => {
          const maxDate = usageDates.reduce((a, b) => (a > b ? a : b));
          const end = new Date(`${maxDate}T00:00:00.000Z`);
          end.setUTCDate(end.getUTCDate() + 1);
          return end.toISOString().slice(0, 10);
        })()
      : to.slice(0, 10);

  const rollup = await refreshCostDailyRollup(rollupFrom, rollupTo);

  return {
    fetched: charges.length,
    upserted,
    rollupFrom,
    rollupTo,
    rollup,
  };
}
