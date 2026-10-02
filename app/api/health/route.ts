import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ok = await pingDatabase();
    return NextResponse.json({ status: ok ? "ok" : "degraded", database: ok });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { status: "error", database: false, message },
      { status: 503 },
    );
  }
}
