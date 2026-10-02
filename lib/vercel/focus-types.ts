/** Vercel GET /v1/billing/charges — FOCUS v1.3 JSONL row (subset used for ingest). */
export type VercelFocusCharge = {
  BilledCost: number;
  BillingCurrency: string;
  ChargeCategory: string;
  ChargePeriodEnd: string;
  ChargePeriodStart: string;
  ConsumedQuantity?: number | null;
  ConsumedUnit?: string | null;
  EffectiveCost: number;
  PricingCategory?: string;
  PricingCurrency?: string;
  PricingQuantity?: number;
  PricingUnit?: string;
  RegionId?: string;
  RegionName?: string;
  ServiceCategory?: string;
  ServiceName: string;
  ServiceProviderName?: string;
  SkuId: string;
  Tags?: Record<string, string> | string;
};
