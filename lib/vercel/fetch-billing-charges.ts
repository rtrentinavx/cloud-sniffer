import type { VercelFocusCharge } from "./focus-types";

const VERCEL_API = "https://api.vercel.com";

export type FetchBillingChargesOptions = {
  token: string;
  from: string;
  to: string;
  teamId?: string;
  slug?: string;
};

export async function* streamVercelBillingCharges(
  options: FetchBillingChargesOptions,
): AsyncGenerator<VercelFocusCharge> {
  const params = new URLSearchParams({
    from: options.from,
    to: options.to,
  });
  if (options.teamId) params.set("teamId", options.teamId);
  if (options.slug) params.set("slug", options.slug);

  const res = await fetch(
    `${VERCEL_API}/v1/billing/charges?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/jsonl",
        "Accept-Encoding": "gzip",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Vercel billing/charges failed (${res.status}): ${body.slice(0, 500)}`,
    );
  }

  if (!res.body) {
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      yield JSON.parse(trimmed) as VercelFocusCharge;
    }
  }

  const tail = buffer.trim();
  if (tail) {
    yield JSON.parse(tail) as VercelFocusCharge;
  }
}

export async function collectVercelBillingCharges(
  options: FetchBillingChargesOptions,
): Promise<VercelFocusCharge[]> {
  const rows: VercelFocusCharge[] = [];
  for await (const row of streamVercelBillingCharges(options)) {
    rows.push(row);
  }
  return rows;
}
