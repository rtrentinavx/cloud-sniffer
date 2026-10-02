import { refreshCostDailyRollup, sql } from "@/lib/db";
import { collectVercelBillingCharges } from "./fetch-billing-charges";
import { mapFocusChargeToLineItem } from "./map-focus-charge";
import { upsertCostLineItems } from "./upsert-line-items";

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
  from.setUTCDate(from.getUTCDate() - 3);
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
  const upserted = await upsertCostLineItems(db, mapped);

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
