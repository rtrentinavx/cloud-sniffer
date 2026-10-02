import { fetchDailyRollupLast30Days } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatMoney(value: string, currency: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

type Totals = {
  byProvider: Map<string, number>;
  byService: Map<string, number>;
  grandTotal: number;
  currency: string;
};

function aggregateTotals(
  rows: Awaited<ReturnType<typeof fetchDailyRollupLast30Days>>,
): Totals {
  const byProvider = new Map<string, number>();
  const byService = new Map<string, number>();
  let grandTotal = 0;
  let currency = "USD";

  for (const row of rows) {
    currency = row.currency || currency;
    const cost = Number(row.total_cost);
    if (Number.isNaN(cost)) continue;
    grandTotal += cost;
    byProvider.set(row.provider, (byProvider.get(row.provider) ?? 0) + cost);
    const serviceKey = `${row.provider} / ${row.service}`;
    byService.set(serviceKey, (byService.get(serviceKey) ?? 0) + cost);
  }

  return { byProvider, byService, grandTotal, currency };
}

export default async function HomePage() {
  let rows: Awaited<ReturnType<typeof fetchDailyRollupLast30Days>> = [];
  let loadError: string | null = null;

  try {
    rows = await fetchDailyRollupLast30Days();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Could not load cost data";
  }

  const totals = aggregateTotals(rows);

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:px-6">
          <p className="text-sm font-medium text-zinc-500">Cloud sniffer · lab</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Last 30 days spend
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Daily rollups from Neon (<code className="text-xs">cost_daily_rollup</code>
            ). Vercel billing ingest runs on cron via{" "}
            <code className="text-xs">/api/cron/ingest-vercel</code>.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {loadError ? (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            {loadError}. Set <code className="text-xs">DATABASE_URL</code> and apply{" "}
            <code className="text-xs">db/schema.sql</code>, or run{" "}
            <code className="text-xs">npm run seed:demo</code> for sample data.
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Total (30d)
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(String(totals.grandTotal), totals.currency)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              By provider
            </p>
            <ul className="mt-2 flex flex-wrap gap-3 text-sm">
              {[...totals.byProvider.entries()].map(([provider, amount]) => (
                <li
                  key={provider}
                  className="rounded-full bg-zinc-100 px-3 py-1 tabular-nums"
                >
                  <span className="font-medium">{provider}</span>{" "}
                  {formatMoney(String(amount), totals.currency)}
                </li>
              ))}
              {totals.byProvider.size === 0 ? (
                <li className="text-zinc-500">No rollup rows yet.</li>
              ) : null}
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3">
            <h2 className="text-sm font-semibold">By service</h2>
          </div>
          <ul className="divide-y divide-zinc-100 px-4 py-2 text-sm">
            {[...totals.byService.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([service, amount]) => (
                <li
                  key={service}
                  className="flex items-center justify-between py-2 tabular-nums"
                >
                  <span>{service}</span>
                  <span className="font-medium">
                    {formatMoney(String(amount), totals.currency)}
                  </span>
                </li>
              ))}
            {totals.byService.size === 0 ? (
              <li className="py-4 text-zinc-500">No service breakdown yet.</li>
            ) : null}
          </ul>
        </section>

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3">
            <h2 className="text-sm font-semibold">Daily detail</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Service</th>
                  <th className="px-4 py-2 font-medium">Region</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                  <th className="px-4 py-2 font-medium text-right">Unallocated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row) => (
                  <tr key={`${row.usage_date}-${row.provider}-${row.service}-${row.region}`}>
                    <td className="px-4 py-2 whitespace-nowrap">{row.usage_date}</td>
                    <td className="px-4 py-2">{row.provider}</td>
                    <td className="px-4 py-2">{row.service}</td>
                    <td className="px-4 py-2 text-zinc-600">{row.region ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(row.total_cost, row.currency)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-800">
                      {formatMoney(row.unallocated_cost, row.currency)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loadError ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No rows in the last 30 days. Trigger ingest or seed demo data.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
