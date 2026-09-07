import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

/** GET /api/admin/orders/[id] — fetch a single order */
export async function handleAdminOrderDetail(id: string) {
  try {
    await requireAdmin();
    const rawId = String(id || "").trim();
    if (!rawId) return NextResponse.json({ error: "Order id required" }, { status: 400 });
    const db = getFirebaseDb();
    const doc = await db.collection("orders").doc(rawId).get();
    if (!doc.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const data = doc.data() || {};
    return NextResponse.json({ order: data });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message || error) }, { status: 500 });
  }
}