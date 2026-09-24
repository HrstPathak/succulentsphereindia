import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: rawId } = await params;
    const id = String(rawId || "").trim();
    if (!id) return NextResponse.json({ error: "Order id required" }, { status: 400 });
    const db = getFirebaseDb();
    const doc = await db.collection("orders").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const data = doc.data() || {};
    const shipmentSnap = await db.collection("shipments").doc(id).get();
    const shipment = shipmentSnap.exists ? shipmentSnap.data() : null;
    return NextResponse.json({ order: data, shipment });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message || error) }, { status: 500 });
  }
}
