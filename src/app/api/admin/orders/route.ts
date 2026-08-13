import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { sendTrackingEmail } from "@/lib/order-email";

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const {
      id,
      fulfillmentStatus,
      financialStatus,
      trackingNumber,
      trackingUrl,
      carrier,
    } = await request.json();
    if (!String(id || "").trim())
      return NextResponse.json(
        { error: "Order id is required." },
        { status: 400 },
      );
    const db = getFirebaseDb();
    const orderRef = db.collection("orders").doc(String(id));
    const existing = await orderRef.get();
    if (!existing.exists)
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const update: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (
      ["UNFULFILLED", "FULFILLED", "DELIVERED", "CANCELLED"].includes(
        String(fulfillmentStatus || "").toUpperCase(),
      )
    )
      update.fulfillmentStatus = String(fulfillmentStatus).toUpperCase();
    if (
      ["PENDING", "PAID", "REFUNDED"].includes(
        String(financialStatus || "").toUpperCase(),
      )
    )
      update.financialStatus = String(financialStatus).toUpperCase();
    const safeTrackingNumber = String(trackingNumber || "").trim();
    const previousTrackingNumber = String(
      existing.get("tracking")?.[0]?.number || "",
    ).trim();
    if (safeTrackingNumber)
      update.tracking = [
        {
          number: safeTrackingNumber,
          url: String(trackingUrl || "").trim(),
          company: String(carrier || "Delhivery").trim() || "Delhivery",
        },
      ];
    if (Object.keys(update).length === 1)
      return NextResponse.json(
        { error: "Choose an order update." },
        { status: 400 },
      );
    await orderRef.set(update, { merge: true });
    let trackingEmailSent = false;
    if (safeTrackingNumber && safeTrackingNumber !== previousTrackingNumber) {
      const order = existing.data() || {};
      const customer = (order.customer || {}) as Record<string, unknown>;
      const recipient = String(order.emailLower || customer.email || "").trim();
      if (/^\S+@\S+\.\S+$/.test(recipient)) {
        const result = await sendTrackingEmail({
          orderId: existing.id,
          orderNumber: Number(order.orderNumber || 0),
          customerName: String(
            customer.fullName || order.customerName || "Customer",
          ),
          customerEmail: recipient,
          trackingNumber: safeTrackingNumber,
          trackingUrl: String(trackingUrl || "").trim(),
          carrier: String(carrier || "Delhivery").trim() || "Delhivery",
        });
        trackingEmailSent = result.sent;
      }
    }
    return NextResponse.json({ ok: true, trackingEmailSent });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          String((error as Error).message) === "ADMIN_REQUIRED"
            ? "Not found."
            : (error as Error).message,
      },
      {
        status:
          String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500,
      },
    );
  }
}
