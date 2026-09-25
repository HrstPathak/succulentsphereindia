import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { sendTrackingEmail } from "@/lib/order-email";
import { applyWalletOrderCancellationPolicy } from "@/lib/wallet";
import { buildDelhiveryTrackingUrl } from "@/lib/delhiveryTracking";

function cleanWaybills(values: unknown) {
  const input = Array.isArray(values) ? values : [values];
  return [
    ...new Set(
      input
        .flatMap((value) =>
          value && typeof value === "object"
            ? [String((value as Record<string, unknown>).number || "")]
            : String(value || "").split(/[\s,]+/),
        )
        .map((value) => value.trim())
        .filter((value) => /^[A-Za-z0-9]{10,}$/.test(value)),
    ),
  ];
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const {
      id,
      fulfillmentStatus,
      financialStatus,
      trackingNumber,
      trackingNumbers,
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
      ["UNFULFILLED", "READY", "FULFILLED", "SHIPPED", "DELIVERED", "CANCELLED"].includes(
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
    const previousWaybills = cleanWaybills(existing.get("tracking"));
    const submittedWaybills = cleanWaybills(trackingNumbers || trackingNumber);
    const waybills = [...new Set([...previousWaybills, ...submittedWaybills])];
    const safeTrackingNumber = waybills[0] || "";
    const safeUrl = String(trackingUrl || "").trim();
    const canonicalUrl = buildDelhiveryTrackingUrl(safeTrackingNumber);
    if (waybills.length) {
      if (!update.fulfillmentStatus) update.fulfillmentStatus = "SHIPPED";
      update.awb = safeTrackingNumber;
      update.tracking = waybills.map((number, index) => ({
        number,
        url:
          index === 0 && safeUrl
            ? safeUrl
            : buildDelhiveryTrackingUrl(number),
        company: String(carrier || "Delhivery").trim() || "Delhivery",
      }));
    }
    if (Object.keys(update).length === 1)
      return NextResponse.json(
        { error: "Choose an order update." },
        { status: 400 },
      );
    await orderRef.set(update, { merge: true });
    if (safeTrackingNumber) {
      const shipmentRef = db.collection("shipments").doc(String(id));
      const shipmentSnap = await shipmentRef.get();
      const shipment = shipmentSnap.exists ? shipmentSnap.data() || {} : {};
      const existingWaybills = cleanWaybills(shipment.waybills);
      const allWaybills = [...new Set([...existingWaybills, ...waybills])];
      await shipmentRef.set(
        {
          orderId: String(id),
          status: "done",
          mode: shipment.mode || "manual",
          tracking: update.tracking,
          awb: safeTrackingNumber,
          fulfillmentStatus: "SHIPPED",
          waybills: allWaybills,
          trackingNumbers: allWaybills,
          trackingNumber: safeTrackingNumber,
          trackingUrl: safeUrl || canonicalUrl,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    const nextFulfillmentStatus = String(update.fulfillmentStatus || "").toUpperCase();
    const nextFinancialStatus = String(update.financialStatus || "").toUpperCase();
    if (nextFulfillmentStatus === "CANCELLED" || nextFinancialStatus === "REFUNDED") {
      await applyWalletOrderCancellationPolicy(String(id));
    }
    let trackingEmailSent = false;
    const hasNewWaybill = submittedWaybills.some(
      (number) => !previousWaybills.includes(number),
    );
    if (safeTrackingNumber && hasNewWaybill) {
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
          trackingUrl: safeUrl || canonicalUrl,
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
          String((error as Error).message) === "ADMIN_REQUIRED" ||
          String((error as Error).message) === "UNAUTHENTICATED"
            ? 404
            : 500,
      },
    );
  }
}
