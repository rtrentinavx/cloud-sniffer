import { createHash } from "node:crypto";
import type { VercelFocusCharge } from "./focus-types";

export type MappedLineItem = {
  line_item_id: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  charge_period_start: string;
  charge_period_end: string | null;
  provider: string;
  account_id: string;
  sub_account_id: string | null;
  region: string | null;
  service: string;
  sku: string;
  resource_id: string | null;
  resource_name: string | null;
  cost_amount: number;
  currency: string;
  tags: Record<string, string>;
  tag_team: string | null;
  tag_env: string | null;
  tag_project: string | null;
  allocation_status: "allocated" | "partial" | "unallocated";
};

const PROVIDER = "Vercel";

function normalizeTags(raw: VercelFocusCharge["Tags"]): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
            k,
            String(v),
          ]),
        );
      }
    } catch {
      return {};
    }
    return {};
  }
  return { ...raw };
}

function pickTag(tags: Record<string, string>, keys: string[]): string | null {
  const lower = new Map(
    Object.entries(tags).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v) return v;
  }
  return null;
}

/** Stable dedupe key for upsert into cost_line_items.line_item_id */
export function buildVercelLineItemId(
  accountId: string,
  charge: VercelFocusCharge,
): string {
  const region = charge.RegionId ?? charge.RegionName ?? "";
  const payload = [
    PROVIDER,
    accountId,
    charge.ChargePeriodStart,
    charge.ChargePeriodEnd ?? "",
    charge.SkuId,
    charge.ServiceName,
    charge.ChargeCategory,
    region,
  ].join("|");
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return `vercel:${accountId}:${charge.SkuId}:${charge.ChargePeriodStart}:${hash}`;
}

export function resolveAllocationStatus(
  tags: Record<string, string>,
  requiredTagKeys: string[],
): "allocated" | "partial" | "unallocated" {
  if (requiredTagKeys.length === 0) {
    const hasAny = Boolean(
      pickTag(tags, ["team", "env", "project", "Team", "Env", "Project"]),
    );
    return hasAny ? "allocated" : "unallocated";
  }

  const present = requiredTagKeys.filter((key) =>
    Boolean(pickTag(tags, [key])),
  );
  if (present.length === 0) return "unallocated";
  if (present.length === requiredTagKeys.length) return "allocated";
  return "partial";
}

export function mapFocusChargeToLineItem(
  charge: VercelFocusCharge,
  accountId: string,
  requiredTagKeys: string[] = [],
): MappedLineItem {
  const tags = normalizeTags(charge.Tags);
  const tagTeam = pickTag(tags, ["team", "Team"]);
  const tagEnv = pickTag(tags, ["env", "environment", "Env"]);
  const tagProject = pickTag(tags, [
    "project",
    "Project",
    "ProjectName",
    "projectName",
  ]);
  const projectId = pickTag(tags, ["ProjectId", "projectId", "project_id"]);

  const cost =
    typeof charge.BilledCost === "number" && !Number.isNaN(charge.BilledCost)
      ? charge.BilledCost
      : charge.EffectiveCost;

  const chargeStart = charge.ChargePeriodStart;
  const usageDate = chargeStart.slice(0, 10);

  return {
    line_item_id: buildVercelLineItemId(accountId, charge),
    billing_period_start: usageDate,
    billing_period_end: null,
    charge_period_start: chargeStart,
    charge_period_end: charge.ChargePeriodEnd ?? null,
    provider: PROVIDER,
    account_id: accountId,
    sub_account_id: null,
    region: charge.RegionId ?? charge.RegionName ?? null,
    service: charge.ServiceName,
    sku: charge.SkuId,
    resource_id: projectId,
    resource_name: tagProject,
    cost_amount: cost,
    currency: (charge.BillingCurrency ?? "USD").slice(0, 3),
    tags,
    tag_team: tagTeam,
    tag_env: tagEnv,
    tag_project: tagProject,
    allocation_status: resolveAllocationStatus(tags, requiredTagKeys),
  };
}
