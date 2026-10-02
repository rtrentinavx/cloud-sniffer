/**
 * Lab demo: insert sample Vercel line items and refresh rollup (no Vercel token).
 * Usage: DATABASE_URL=... npx tsx scripts/seed-demo-costs.ts
 */
import { refreshCostDailyRollup, sql } from "../lib/db";
import { mapFocusChargeToLineItem } from "../lib/vercel/map-focus-charge";
import type { VercelFocusCharge } from "../lib/vercel/focus-types";

const accountId = process.env.VERCEL_TEAM_ID ?? "demo-team";

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

const demoCharges: VercelFocusCharge[] = [
  {
    BilledCost: 4.2,
    BillingCurrency: "USD",
    ChargeCategory: "Usage",
    ChargePeriodStart: daysAgo(3),
    ChargePeriodEnd: daysAgo(2),
    EffectiveCost: 4.2,
    ServiceName: "Serverless Functions",
    SkuId: "demo_fn",
    RegionId: "iad1",
    Tags: { team: "platform", env: "prod", project: "cloud-sniffer" },
  },
  {
    BilledCost: 18.75,
    BillingCurrency: "USD",
    ChargeCategory: "Usage",
    ChargePeriodStart: daysAgo(1),
    ChargePeriodEnd: daysAgo(0),
    EffectiveCost: 18.75,
    ServiceName: "Edge Network",
    SkuId: "demo_edge",
    RegionId: "global",
    Tags: {},
  },
];

async function main() {
  const db = sql();
  for (const charge of demoCharges) {
    const item = mapFocusChargeToLineItem(charge, accountId, []);
    await db`
      INSERT INTO cost_line_items (
        billing_period_start,
        charge_period_start,
        provider,
        account_id,
        region,
        service,
        sku,
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
        ${item.charge_period_start}::timestamptz,
        ${item.provider},
        ${item.account_id},
        ${item.region},
        ${item.service},
        ${item.sku},
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
        ingested_at = now()
    `;
  }

  const from = daysAgo(7).slice(0, 10);
  const to = daysAgo(-1).slice(0, 10);
  const rollup = await refreshCostDailyRollup(from, to);
  console.log(JSON.stringify({ seeded: demoCharges.length, rollup }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
