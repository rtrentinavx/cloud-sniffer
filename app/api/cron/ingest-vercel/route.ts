import { NextRequest, NextResponse } from "next/server";
import { ingestVercelBilling } from "@/lib/vercel/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function runIngest(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body =
      request.method === "POST"
        ? await request.json().catch(() => ({}))
        : {};
    const from =
      typeof body?.from === "string" ? body.from : undefined;
    const to = typeof body?.to === "string" ? body.to : undefined;

    const result = await ingestVercelBilling({ from, to });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    console.error("[ingest-vercel]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Vercel Cron invokes cron paths with GET + Authorization header. */
export async function GET(request: NextRequest) {
  return runIngest(request);
}

export async function POST(request: NextRequest) {
  return runIngest(request);
}
