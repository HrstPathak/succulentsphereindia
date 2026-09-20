import { NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "@/lib/auth";
import { releaseWalletHold } from "@/lib/wallet";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedCustomer();
    if (!session.uid) return NextResponse.json({ ok: true, released: false });

    const body = await req.json().catch(() => ({}));
    const holdId = String(body?.holdId || "").trim();
    if (!holdId) return NextResponse.json({ ok: true, released: false });

    await releaseWalletHold({ uid: session.uid, holdId });
    return NextResponse.json({ ok: true, released: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Unable to release wallet hold." }, { status: 500 });
  }
}
