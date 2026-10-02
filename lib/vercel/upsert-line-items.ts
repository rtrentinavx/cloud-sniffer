import type { Sql } from "@/lib/db";
import type { MappedLineItem } from "./map-focus-charge";
import { chunkArray } from "./chunk-array";

export const DEFAULT_LINE_ITEM_BATCH_SIZE = 300;

function columnsFromItems(items: MappedLineItem[]) {
  return {
    billing_period_start: items.map((i) => i.billing_period_start),
    billing_period_end: items.map((i) => i.billing_period_end),
    charge_period_start: items.map((i) => i.charge_period_start),
    charge_period_end: items.map((i) => i.charge_period_end),
    provider: items.map((i) => i.provider),
    account_id: items.map((i) => i.account_id),
    sub_account_id: items.map((i) => i.sub_account_id),
    region: items.map((i) => i.region),
    service: items.map((i) => i.service),
    sku: items.map((i) => i.sku),
    resource_id: items.map((i) => i.resource_id),
    resource_name: items.map((i) => i.resource_name),
    cost_amount: items.map((i) => i.cost_amount),
    currency: items.map((i) => i.currency),
    tags: items.map((i) => JSON.stringify(i.tags)),
    tag_team: items.map((i) => i.tag_team),
    tag_env: items.map((i) => i.tag_env),
    tag_project: items.map((i) => i.tag_project),
    allocation_status: items.map((i) => i.allocation_status),
    line_item_id: items.map((i) => i.line_item_id),
  };
}

async function upsertLineItemChunk(
  db: Sql,
  items: MappedLineItem[],
): Promise<number> {
  if (items.length === 0) return 0;

  const c = columnsFromItems(items);

  const rows = await db`
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
    )
    SELECT
      u.billing_period_start,
      u.billing_period_end,
      u.charge_period_start,
      u.charge_period_end,
      u.provider,
      u.account_id,
      u.sub_account_id,
      u.region,
      u.service,
      u.sku,
      u.resource_id,
      u.resource_name,
      u.cost_amount,
      u.currency,
      u.tags,
      u.tag_team,
      u.tag_env,
      u.tag_project,
      u.allocation_status,
      u.line_item_id
    FROM unnest(
      ${c.billing_period_start}::date[],
      ${c.billing_period_end}::date[],
      ${c.charge_period_start}::timestamptz[],
      ${c.charge_period_end}::timestamptz[],
      ${c.provider}::text[],
      ${c.account_id}::text[],
      ${c.sub_account_id}::text[],
      ${c.region}::text[],
      ${c.service}::text[],
      ${c.sku}::text[],
      ${c.resource_id}::text[],
      ${c.resource_name}::text[],
      ${c.cost_amount}::numeric[],
      ${c.currency}::text[],
      ${c.tags}::jsonb[],
      ${c.tag_team}::text[],
      ${c.tag_env}::text[],
      ${c.tag_project}::text[],
      ${c.allocation_status}::text[],
      ${c.line_item_id}::text[]
    ) AS u(
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
    RETURNING id
  `;

  return rows.length;
}

export async function upsertCostLineItems(
  db: Sql,
  items: MappedLineItem[],
  batchSize = DEFAULT_LINE_ITEM_BATCH_SIZE,
): Promise<number> {
  let upserted = 0;
  for (const chunk of chunkArray(items, batchSize)) {
    upserted += await upsertLineItemChunk(db, chunk);
  }
  return upserted;
}
