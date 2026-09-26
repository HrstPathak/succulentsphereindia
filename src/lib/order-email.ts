import "server-only";

import { getFirebaseDb } from "@/lib/firebase-admin";
import { configuredEmailProvider, sendEmail } from "@/lib/email-sender";
import { buildDelhiveryTrackingUrl } from "@/lib/delhiveryTracking";
import { buildOrderStatusEmail } from "@/lib/email-templates/orderStatus";
import {
  buildAdminOrderAlertEmail,
  buildOrderConfirmationEmail,
  type OrderConfirmationEmailInput,
} from "@/lib/email-templates/orderConfirmation";

export type OrderConfirmationEmail = OrderConfirmationEmailInput;

export async function sendOrderConfirmationEmail(
  order: OrderConfirmationEmail,
) {
  if (!configuredEmailProvider()) {
    await getFirebaseDb()
      .collection("orders")
      .doc(order.orderId)
      .set(
        {
          emailStatus: "not_configured",
          emailUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { sent: false, skipped: true };
  }

  try {
    console.log(`[order-email] attempting send to customer: ${order.customerEmail} (order:${order.orderNumber})`);
    // The template owns its own subject, preheader, HTML and plain-text twin so
    // the customer copy and the text fallback can never drift apart. The
    // idempotency key is deliberately unchanged: altering it would slip past
    // the provider's de-duplication and let a resent confirmation reach the
    // customer twice.
    const email = buildOrderConfirmationEmail(order);
    const delivery = await sendEmail({
      to: order.customerEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `order-confirmation-${order.orderId}`,
    });
    console.log(`[order-email] sent to ${order.customerEmail}`, { orderId: order.orderId, provider: delivery.provider, id: delivery.id });
    await getFirebaseDb()
      .collection("orders")
      .doc(order.orderId)
      .set(
        {
          emailStatus: "sent",
          emailProvider: delivery.provider,
          emailProviderId: delivery.id || "",
          emailSentAt: new Date().toISOString(),
        },
        { merge: true },
      );
    const rawAdmins = String(process.env.ADMIN_EMAILS || "").trim();
    if (rawAdmins) {
      const admins = rawAdmins.split(",").map((s) => String(s || "").trim()).filter(Boolean);
      for (const adminEmail of admins) {
        try {
          const alert = buildAdminOrderAlertEmail(order);
          const adminDelivery = await sendEmail({
            to: adminEmail,
            subject: alert.subject,
            html: alert.html,
            text: alert.text,
            idempotencyKey: `order-admin-notify-${order.orderId}-${adminEmail}`,
          });
          await getFirebaseDb().collection("orders").doc(order.orderId).set(
            {
              adminEmailStatus: "sent",
              adminEmailProvider: adminDelivery.provider,
              adminEmailProviderId: adminDelivery.id || "",
              adminEmailSentAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } catch (adminErr) {
          await getFirebaseDb().collection("orders").doc(order.orderId).set(
            {
              adminEmailStatus: "failed",
              adminEmailError: String((adminErr as Error).message || adminErr).slice(0, 300),
              adminEmailUpdatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
      }
    }
    return { sent: true, skipped: false };
  } catch (error) {
    console.error("[order-email] send failed", (error as Error).message || error);
    await getFirebaseDb()
      .collection("orders")
      .doc(order.orderId)
      .set(
        {
          emailStatus: "failed",
          emailError: String(
            (error as Error).message || "Unable to send order email.",
          ).slice(0, 300),
          emailUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { sent: false, skipped: false };
  }
}

export type OrderLifecycleStatus = "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

/**
 * Sends the lifecycle email for a manual status change made by an admin
 * (in transit, out for delivery, delivered, cancelled). Returns the same shape
 * as the other mail helpers so callers can report sent/skipped/failed.
 *
 * The design, copy and plain-text part all come from
 * src/lib/email-templates/orderStatus.ts. This function only resolves the
 * order's real values and records the outcome in Firestore.
 */
export async function sendOrderStatusEmail(input: {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  status: OrderLifecycleStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  amountDue?: number;
}) {
  if (!configuredEmailProvider()) return { sent: false, skipped: true };

  // De-duplicate against the dispatch email, which carries the same IN_TRANSIT
  // copy. Creating a shipment already tells the customer their plants are moving,
  // so a later manual IN_TRANSIT must not repeat it. The other three statuses
  // are genuinely new states and always send.
  if (input.status === "IN_TRANSIT") {
    try {
      const snapshot = await getFirebaseDb().collection("orders").doc(input.orderId).get();
      const tracking = (snapshot.data() as any)?.trackingEmailStatus;
      if (String(tracking || "") === "sent") {
        await getFirebaseDb()
          .collection("orders")
          .doc(input.orderId)
          .set(
            {
              statusEmail_IN_TRANSIT: {
                status: "skipped",
                reason: "tracking_email_already_sent",
                updatedAt: new Date().toISOString(),
              },
            },
            { merge: true },
          );
        return { sent: false, skipped: true };
      }
    } catch {
      // A read failure must not block the send; fall through and deliver.
    }
  }

  const trackingNumber = String(input.trackingNumber || "").trim();
  const email = buildOrderStatusEmail({
    status: input.status,
    orderNumber: input.orderNumber,
    customerName: input.customerName,
    trackingNumber,
    trackingUrl:
      input.trackingUrl || (trackingNumber ? buildDelhiveryTrackingUrl(trackingNumber) : ""),
    carrier: input.carrier,
    amountDue: input.amountDue,
  });

  try {
    const delivery = await sendEmail({
      to: input.customerEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `status-${input.orderId}-${input.status}`,
    });
    await getFirebaseDb()
      .collection("orders")
      .doc(input.orderId)
      .set(
        {
          [`statusEmail_${input.status}`]: {
            status: "sent",
            provider: delivery.provider,
            providerId: delivery.id || "",
            sentAt: new Date().toISOString(),
          },
        },
        { merge: true },
      );
    return { sent: true, skipped: false };
  } catch (error) {
    await getFirebaseDb()
      .collection("orders")
      .doc(input.orderId)
      .set(
        {
          [`statusEmail_${input.status}`]: {
            status: "failed",
            error: String((error as Error).message).slice(0, 300),
            updatedAt: new Date().toISOString(),
          },
        },
        { merge: true },
      );
    return { sent: false, skipped: false };
  }
}

/**
 * Sends the dispatch email when a shipment is created and a waybill exists.
 *
 * This is the same message an admin gets by setting IN_TRANSIT by hand, so it
 * reuses that template verbatim (IN_TRANSIT copy) rather than maintaining a
 * second design. To stop the customer receiving two near-identical "your plants
 * are on the way" emails, the IN_TRANSIT status email is checked first: if one
 * already went out for this order, this call is skipped.
 */
export async function sendTrackingEmail(input: {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  trackingNumber: string;
  trackingUrl?: string;
  carrier?: string;
}) {
  if (!configuredEmailProvider()) return { sent: false, skipped: true };

  const db = getFirebaseDb();
  const trackingNumber = String(input.trackingNumber || "").trim();
  const carrier = input.carrier || "Delhivery";

  // De-duplicate against the manual IN_TRANSIT notification.
  try {
    const snapshot = await db.collection("orders").doc(input.orderId).get();
    const alreadySent = (snapshot.data() as any)?.statusEmail_IN_TRANSIT;
    if (alreadySent && String(alreadySent.status || "") === "sent") {
      await db
        .collection("orders")
        .doc(input.orderId)
        .set(
          {
            trackingEmailStatus: "skipped",
            trackingEmailSkipReason: "in_transit_status_email_already_sent",
            trackingEmailUpdatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      return { sent: false, skipped: true };
    }
  } catch {
    // A read failure must not block the send; fall through and deliver.
  }

  const email = buildOrderStatusEmail({
    status: "IN_TRANSIT",
    orderNumber: input.orderNumber,
    customerName: input.customerName,
    trackingNumber,
    trackingUrl: input.trackingUrl || (trackingNumber ? buildDelhiveryTrackingUrl(trackingNumber) : ""),
    carrier,
  });

  try {
    const delivery = await sendEmail({
      to: input.customerEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `tracking-${input.orderId}-${trackingNumber}`,
    });
    await db
      .collection("orders")
      .doc(input.orderId)
      .set(
        {
          trackingEmailStatus: "sent",
          trackingEmailProvider: delivery.provider,
          trackingEmailSentAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { sent: true, skipped: false };
  } catch (error) {
    await getFirebaseDb()
      .collection("orders")
      .doc(input.orderId)
      .set(
        {
          trackingEmailStatus: "failed",
          trackingEmailError: String((error as Error).message).slice(0, 300),
          trackingEmailUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { sent: false, skipped: false };
  }
}
