import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { enqueueShipment, processShipmentJob } from "@/lib/shipping";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { id } = await req.json();
    if (!String(id || "").trim()) return NextResponse.json({ error: "Order id required" }, { status: 400 });
    const db = getFirebaseDb();
    const orderRef = db.collection("orders").doc(String(id));
    const snap = await orderRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = snap.data() || {};
    const jobId = await enqueueShipment(snap.id, { orderNumber: Number(order.orderNumber || 0) || undefined, retryFailed: true });
    const result = await processShipmentJob(jobId);
    if (!result.ok && result.reason === "carrier_not_configured") {
      return NextResponse.json({ error: "Delhivery is not ready yet. Set DELHIVERY_CREATE_URL and confirm the Delhivery API payload mapping." }, { status: 503 });
    }
    if (!result.ok) return NextResponse.json({ error: "Unable to create shipment." }, { status: 502 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message || error) }, { status: 500 });
  }
}
