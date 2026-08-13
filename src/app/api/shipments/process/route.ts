import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { processPendingShipments } from "@/lib/shipping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function process(req: Request) {
  try {
    const cronSecret = String(process.env.CRON_SECRET || "").trim();
    const authorization = String(req.headers.get("authorization") || "").trim();
    const calledByCron = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
    if (!calledByCron) await requireAdmin();
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 5);
    const result = await processPendingShipments(Math.max(1, Math.min(50, limit)));
    return NextResponse.json({ ok: true, processed: result.length, results: result });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message || error) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return process(req);
}

export async function POST(req: Request) {
  return process(req);
}
