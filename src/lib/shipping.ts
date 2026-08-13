import "server-only";

import { getFirebaseDb } from "@/lib/firebase-admin";
import { sendTrackingEmail } from "@/lib/order-email";

const DELHIVERY_CREATE_URL = String(process.env.DELHIVERY_CREATE_URL || "").trim();
const DELHIVERY_API_TOKEN = String(process.env.DELHIVERY_API_TOKEN || "").trim();
const MAX_SHIPMENT_ATTEMPTS = 8;

type ShipmentOptions = {
  orderNumber?: number;
  package?: Record<string, unknown>;
  retryFailed?: boolean;
};

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function configuredPackage(input?: Record<string, unknown>) {
  if (input) return input;
  return {
    package_type: String(process.env.DELHIVERY_PACKAGE_TYPE || "Cardboard Box"),
    length_cm: number(process.env.DELHIVERY_PACKAGE_LENGTH_CM, 14),
    breadth_cm: number(process.env.DELHIVERY_PACKAGE_BREADTH_CM, 12),
    height_cm: number(process.env.DELHIVERY_PACKAGE_HEIGHT_CM, 12),
    weight_gm: number(process.env.DELHIVERY_PACKAGE_WEIGHT_GM, 450),
  };
}

function defaultTrackingUrl(waybill: string) {
  return `https://www.delhivery.com/track/package/${encodeURIComponent(waybill)}`;
}

function carrierConfigured() {
  return Boolean(DELHIVERY_CREATE_URL && DELHIVERY_API_TOKEN);
}

async function callCarrierCreate(payload: Record<string, unknown>) {
  if (!carrierConfigured()) {
    throw new Error("Delhivery shipment creation is not configured. Set DELHIVERY_CREATE_URL and DELHIVERY_API_TOKEN.");
  }

  const response = await fetch(DELHIVERY_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${DELHIVERY_API_TOKEN}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const raw = await response.text();
  let body: any = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }
  if (!response.ok) {
    throw new Error(String(body?.message || body?.error || `Delhivery shipment creation failed (${response.status}).`));
  }
  return body;
}

/** Creates one durable shipment job per order. It is safe to call repeatedly. */
export async function enqueueShipment(orderId: string, options: ShipmentOptions = {}) {
  const db = getFirebaseDb();
  const jobRef = db.collection("shipments").doc(orderId);
  const now = new Date().toISOString();
  const existing = await jobRef.get();
  if (!existing.exists) {
    await jobRef.set({
      orderId,
      orderNumber: options.orderNumber || null,
      package: options.package || null,
      carrier: "Delhivery",
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
  } else if (options.retryFailed && existing.get("status") === "failed") {
    await jobRef.set({ status: "pending", attempts: 0, lastError: null, updatedAt: now }, { merge: true });
  }
  return jobRef.id;
}

export async function processShipmentJob(jobId: string) {
  const db = getFirebaseDb();
  const jobRef = db.collection("shipments").doc(jobId);
  if (!carrierConfigured()) return { ok: false, skipped: true, reason: "carrier_not_configured" };
  const lock = await db.runTransaction(async (transaction) => {
    const jobSnap = await transaction.get(jobRef);
    if (!jobSnap.exists) throw new Error("Shipment job not found.");
    const job = jobSnap.data() as any;
    if (job.status === "done") return { job, skip: "already_created" };
    if (job.status === "failed") return { job, skip: "retry_limit_reached" };
    const updatedAt = new Date(String(job.updatedAt || 0)).getTime();
    const processingIsFresh = job.status === "processing" && Number.isFinite(updatedAt) && Date.now() - updatedAt < 10 * 60 * 1000;
    if (processingIsFresh) return { job, skip: "already_processing" };
    const attempts = number(job.attempts) + 1;
    const lockedJob = { ...job, attempts };
    transaction.set(jobRef, { status: "processing", attempts, updatedAt: new Date().toISOString() }, { merge: true });
    return { job: lockedJob, skip: "" };
  });
  if (lock.skip) return { ok: lock.skip === "already_created", skipped: true, reason: lock.skip };
  const job = lock.job;
  const attempts = number(job.attempts);

  try {
    const orderRef = db.collection("orders").doc(String(job.orderId));
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error("Order not found for shipment job.");
    const order = orderSnap.data() || {};
    const existingTracking = Array.isArray(order.tracking) ? order.tracking[0] : null;
    if (existingTracking?.number) {
      await jobRef.set({ status: "done", updatedAt: new Date().toISOString(), trackingNumber: existingTracking.number }, { merge: true });
      return { ok: true, skipped: true, reason: "order_already_has_tracking", trackingNumber: existingTracking.number };
    }

    const paymentMode = String(order.paymentMode || "prepaid");
    const total = number(order.total);
    const paymentReceived = number(order.paymentReceived);
    const collectableAmount = paymentMode === "cod_deposit" ? Math.max(0, Number((total - paymentReceived).toFixed(2))) : 0;
    const customer = order.customer || {};
    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    const payload: Record<string, unknown> = {
      order_id: job.orderNumber || order.orderNumber || orderRef.id,
      name: customer.fullName || order.customerName || "Customer",
      phone: customer.phone || order.phone || order.customerPhone || "",
      email: customer.email || order.emailLower || "",
      address: [customer.address1 || customer.address, customer.address2, customer.city, customer.province || customer.state, customer.pincode || customer.zip]
        .filter(Boolean)
        .join(", "),
      city: customer.city || "",
      state: customer.province || customer.state || "",
      pin: customer.pincode || customer.zip || order.zip || "",
      payment_type: collectableAmount > 0 ? "COD" : "Prepaid",
      cod_amount: collectableAmount,
      collectable_amount: collectableAmount,
      items: lineItems.map((item: any) => ({
        name: String(item.title || "Product"),
        sku: String(item.productId || item.id || ""),
        qty: Math.max(1, number(item.quantity, 1)),
        price: number(item.price?.amount ?? item.price),
      })),
      package: configuredPackage(job.package),
      shipping_mode: String(job.package?.shipping_mode || process.env.DELHIVERY_SHIPPING_MODE || "Surface"),
      pickup_location: String(process.env.DELHIVERY_PICKUP_LOCATION || "").trim(),
      seller: String(process.env.DELHIVERY_SELLER_NAME || "Succulent Sphere").trim(),
    };

    const result = await callCarrierCreate(payload);
    const trackingNumber = String(result?.waybill || result?.awb || result?.waybill_number || result?.data?.waybill || result?.data?.awb || "").trim();
    const trackingUrl = String(result?.tracking_url || result?.url || "").trim() || defaultTrackingUrl(trackingNumber);
    if (!trackingNumber) throw new Error("Delhivery did not return a tracking number.");

    const tracking = [{ number: trackingNumber, url: trackingUrl, company: "Delhivery" }];
    await orderRef.set({ tracking, fulfillmentStatus: "SHIPPED", updatedAt: new Date().toISOString() }, { merge: true });
    await jobRef.set({ status: "done", updatedAt: new Date().toISOString(), trackingNumber, result }, { merge: true });

    const recipient = String(order.emailLower || customer.email || "").trim();
    if (/^\S+@\S+\.\S+$/.test(recipient)) {
      try {
        await sendTrackingEmail({
          orderId: orderRef.id,
          orderNumber: number(order.orderNumber),
          customerName: String(customer.fullName || order.customerName || "Customer"),
          customerEmail: recipient,
          trackingNumber,
          trackingUrl,
          carrier: "Delhivery",
        });
      } catch (error) {
        await orderRef.set({ trackingEmailError: String((error as Error).message || error).slice(0, 300), updatedAt: new Date().toISOString() }, { merge: true });
      }
    }

    return { ok: true, trackingNumber, trackingUrl };
  } catch (error) {
    const terminal = attempts >= MAX_SHIPMENT_ATTEMPTS;
    await jobRef.set({
      status: terminal ? "failed" : "pending",
      updatedAt: new Date().toISOString(),
      lastError: String((error as Error).message || error).slice(0, 1000),
    }, { merge: true });
    throw error;
  }
}

export async function processPendingShipments(limit = 5) {
  const db = getFirebaseDb();
  const [pending, processing] = await Promise.all([
    db.collection("shipments").where("status", "==", "pending").orderBy("createdAt").limit(limit).get(),
    db.collection("shipments").where("status", "==", "processing").limit(limit).get(),
  ]);
  const staleCutoff = Date.now() - 10 * 60 * 1000;
  const jobs = [
    ...pending.docs,
    ...processing.docs.filter((doc) => new Date(String(doc.get("updatedAt") || 0)).getTime() < staleCutoff),
  ].slice(0, limit);
  const results: Array<Record<string, unknown>> = [];
  for (const doc of jobs) {
    try {
      results.push({ id: doc.id, ...(await processShipmentJob(doc.id)) });
    } catch (error) {
      results.push({ id: doc.id, ok: false, error: String((error as Error).message || error) });
    }
  }
  return results;
}
