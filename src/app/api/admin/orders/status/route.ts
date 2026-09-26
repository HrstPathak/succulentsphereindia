import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getOrderPaymentSummary } from "@/lib/orderAmounts";
import { sendOrderStatusEmail, type OrderLifecycleStatus } from "@/lib/order-email";
import { buildDelhiveryTrackingUrl } from "@/lib/delhiveryTracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: OrderLifecycleStatus[] = [
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

/** Fulfillment value stored on the order for each lifecycle status. */
const FULFILLMENT: Record<OrderLifecycleStatus, string> = {
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

/**
 * POST /api/admin/orders/status
 *
 * Lets an admin move an order forward or cancel it by hand, without waiting for
 * the carrier scan. This is an additional control: it only writes our Firestore
 * record and sends the lifecycle email. The manifest in Delhivery is untouched,
 * so cancel or edit the AWB in the Delhivery dashboard separately if needed.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const id = String(body?.id || "").trim();
    const status = String(body?.status || "").toUpperCase() as OrderLifecycleStatus;
    const sendEmail = body?.sendEmail !== false;

    if (!id) return NextResponse.json({ error: "order id required" }, { status: 400 });
    if (!ALLOWED.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED.join(", ")}` },
        { status: 400 },
      );
    }

    const db = getFirebaseDb();
    const doc = await db.collection("orders").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const data: any = doc.data() || {};
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = {
      fulfillmentStatus: FULFILLMENT[status],
      status,
      statusSource: "admin_manual",
      statusUpdatedAt: now,
      updatedAt: now,
    };
    if (status === "DELIVERED") {
      patch.deliveredAt = now;
    }
    if (status === "CANCELLED") {
      patch.cancelledAt = now;
    }
    await doc.ref.set(patch, { merge: true });

    // Mirror onto the shipment record so both views agree.
    const shipmentRef = db.collection("shipments").doc(id);
    if ((await shipmentRef.get()).exists) {
      await shipmentRef.set(
        {
          fulfillmentStatus: FULFILLMENT[status],
          status,
          statusSource: "admin_manual",
          statusUpdatedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    let email: { sent: boolean; skipped: boolean } = { sent: false, skipped: true };
    if (sendEmail) {
      const payment = getOrderPaymentSummary(data);
      const trackingNumber = data.awb || (data.tracking || [])[0]?.number || "";
      email = await sendOrderStatusEmail({
        orderId: id,
        orderNumber: Number(data.orderNumber || 0),
        customerName: data.customer?.fullName || data.customer?.name || "Customer",
        customerEmail: data.customer?.email || data.emailLower || "",
        status,
        trackingNumber,
        trackingUrl: buildDelhiveryTrackingUrl(trackingNumber),
        // Only an open COD balance is still collectable on delivery.
        amountDue: status === "OUT_FOR_DELIVERY" ? payment.codBalance : 0,
        carrier: data.tracking?.[0]?.company || data.carrier || "Delhivery",
      });
    }

    return NextResponse.json({ ok: true, id, status, email });
  } catch (error) {
    const message = String((error as Error).message || error);
    if (message === "ADMIN_REQUIRED" || message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Admin order status error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
