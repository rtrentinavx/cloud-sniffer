import { describe, expect, it } from "vitest";
import {
  buildVercelLineItemId,
  mapFocusChargeToLineItem,
  resolveAllocationStatus,
} from "./map-focus-charge";
import type { VercelFocusCharge } from "./focus-types";

const sampleCharge: VercelFocusCharge = {
  BilledCost: 12.5,
  BillingCurrency: "USD",
  ChargeCategory: "Usage",
  ChargePeriodStart: "2026-02-01T00:00:00.000Z",
  ChargePeriodEnd: "2026-02-02T00:00:00.000Z",
  EffectiveCost: 12.5,
  ServiceName: "Serverless Functions",
  SkuId: "sku_fn_invocations",
  RegionId: "iad1",
  Tags: { ProjectName: "cloud-sniffer", team: "platform" },
};

describe("buildVercelLineItemId", () => {
  it("is stable for the same charge dimensions", () => {
    const a = buildVercelLineItemId("team_abc", sampleCharge);
    const b = buildVercelLineItemId("team_abc", sampleCharge);
    expect(a).toBe(b);
    expect(a.startsWith("vercel:team_abc:sku_fn_invocations:")).toBe(true);
  });

  it("changes when account or sku changes", () => {
    const base = buildVercelLineItemId("team_abc", sampleCharge);
    const otherTeam = buildVercelLineItemId("team_xyz", sampleCharge);
    expect(base).not.toBe(otherTeam);
  });
});

describe("resolveAllocationStatus", () => {
  it("defaults to unallocated without allocation tags", () => {
    expect(resolveAllocationStatus({}, [])).toBe("unallocated");
  });

  it("marks allocated when required keys are present", () => {
    const tags = { team: "a", env: "prod", project: "sniffer" };
    expect(resolveAllocationStatus(tags, ["team", "env", "project"])).toBe(
      "allocated",
    );
  });

  it("marks partial when some required keys are missing", () => {
    expect(resolveAllocationStatus({ team: "a" }, ["team", "env"])).toBe(
      "partial",
    );
  });
});

describe("mapFocusChargeToLineItem", () => {
  it("maps FOCUS fields to cost_line_items shape", () => {
    const item = mapFocusChargeToLineItem(sampleCharge, "team_abc", [
      "team",
      "env",
      "project",
    ]);
    expect(item.provider).toBe("Vercel");
    expect(item.account_id).toBe("team_abc");
    expect(item.service).toBe("Serverless Functions");
    expect(item.cost_amount).toBe(12.5);
    expect(item.tag_team).toBe("platform");
    expect(item.tag_project).toBe("cloud-sniffer");
    expect(item.allocation_status).toBe("partial");
    expect(item.line_item_id).toBe(
      buildVercelLineItemId("team_abc", sampleCharge),
    );
  });
});
