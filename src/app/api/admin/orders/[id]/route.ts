import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const id = String(params.id || "").trim();
    if (!id) return NextResponse.json({ error: "Order id required" }, { status: 400 });
    const db = getFirebaseDb();
    const doc = await db.collection("orders").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const data = doc.data() || {};
    return NextResponse.json({ order: data });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message || error) }, { status: 500 });
  }
}
