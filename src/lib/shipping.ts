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

/**
 * Delhivery's create-order response returns the AWB/waybill in one of several
 * shapes depending on the plan, the portal mapping and whether the waybill was
 * pre-assigned by us or dynamically allocated by Delhivery:
 *   - { "waybill": "…" }
 *   - { "packages": [{ "waybill": "…", "status": "Success" }] }
 *   - { "response": [{ "waybill": "…" }] }
 *   - { "response": [{ "packages": [{ "waybill": "…" }] }] }
 *   - { "data": { "waybill": "…" } }
 * We scan every documented location so the AWB is always captured back and
 * auto-filled onto the order.
 */
function extractWaybill(body: any): string {
  if (!body || typeof body !== "object") return "";
  const hit = (value: unknown) => {
    const text = String(value || "").trim();
    return text.length >= 8 ? text : "";
  };
  const scan = (node: any): string[] => {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) {
      const out: string[] = [];
      for (const item of node) out.push(...scan(item));
      return out;
    }
    const out: string[] = [];
    for (const key of ["waybill", "awb", "waybill_number", "awb_number"]) {
      const direct = hit(node[key]);
      if (direct) out.push(direct);
    }
    for (const key of ["packages", "response", "shipments", "data", "result", "package"]) {
      out.push(...scan(node[key]));
    }
    return out;
  };
  const found = scan(body).filter((value) => /^\d{10,}/.test(value));
  return found[0] || "";
}

/** Pull a human-readable reason out of a non-2xx Delhivery error body. */
function extractCarrierError(body: any): string {
  if (!body || typeof body !== "object") return "";
  const plain = (value: unknown) => String(value || "").trim();
  const messages: string[] = [];
  for (const key of ["error", "message", "detail", "rmk"]) {
    const text = plain(body?.[key]);
    if (text) messages.push(text);
  }
  const packages = Array.isArray(body?.packages)
    ? body.packages
    : Array.isArray(body?.response)
      ? body.response
      : [];
  for (const pkgItem of packages) {
    const remark = plain(pkgItem?.remarks) || plain(pkgItem?.error);
    if (remark) messages.push(remark);
    if (Array.isArray(pkgItem?.packages)) {
      for (const inner of pkgItem.packages) {
        const remarkInner = plain(inner?.remarks) || plain(inner?.error);
        if (remarkInner) messages.push(remarkInner);
      }
    }
  }
  return [...new Set(messages)].slice(0, 3).join(" · ");
}

async function callCarrierCreate(payload: Record<string, unknown>) {
  if (!carrierConfigured()) {
    throw new Error("Delhivery shipment creation is not configured. Set DELHIVERY_CREATE_URL and DELHIVERY_API_TOKEN.");
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(5000, number(process.env.DELHIVERY_REQUEST_TIMEOUT_MS, 25000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(DELHIVERY_CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${DELHIVERY_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const raw = await response.text();
  let body: any = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }
  if (!response.ok) {
    throw new Error(extractCarrierError(body) || `Delhivery shipment creation failed (${response.status}).`);
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
  if (lock.skip) {
    if (lock.skip === "already_created") {
      return {
        ok: true,
        skipped: true,
        reason: lock.skip,
        trackingNumber: String(lock.job?.trackingNumber || "").trim(),
        trackingUrl: String(lock.job?.trackingUrl || "").trim(),
      };
    }
    return { ok: false, skipped: true, reason: lock.skip };
  }
  const job = lock.job;
  const attempts = number(job.attempts);

  try {
    const orderRef = db.collection("orders").doc(String(job.orderId));
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error("Order not found for shipment job.");
    const order = orderSnap.data() || {};
    const existingTracking = Array.isArray(order.tracking) ? order.tracking[0] : null;
    if (existingTracking?.number) {
      await jobRef.set({ status: "done", updatedAt: new Date().toISOString(), trackingNumber: existingTracking.number, trackingUrl: existingTracking.url }, { merge: true });
      return { ok: true, skipped: true, reason: "order_already_has_tracking", trackingNumber: existingTracking.number, trackingUrl: existingTracking.url };
    }

    const paymentMode = String(order.paymentMode || "prepaid");
    const total = number(order.total);
    const paymentReceived = number(order.paymentReceived);
    // "cod_deposit" = partial COD (deposit paid online, balance due on delivery);
    // plain "cod" = full COD. In both cases the unpaid balance travels as Delhivery COD.
    const collectableAmount = /^cod/i.test(paymentMode) ? Math.max(0, Number((total - paymentReceived).toFixed(2))) : 0;
    const customer = order.customer || {};
    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    // Delhivery's B2C create-order contract (/api/cmu/create.json) expects every
    // shipment inside a "shipments" array with the standard keys below.
    // `order` is the seller's own reference. Extra fields known to the endpoint
    // are ignored by Delhivery, so the same body works on the classic prod URL
    // and on a portal-specific create URL.
    const sellerName = String(process.env.DELHIVERY_SELLER_NAME || "Succulent Sphere").trim();
    const fullAddress = [customer.address1 || customer.address || order.address, customer.address2, customer.landmark]
      .filter(Boolean)
      .join(", ");
    const shipment: Record<string, unknown> = {
      name: customer.fullName || order.customerName || "Customer",
      phone: String(customer.phone || order.phone || order.customerPhone || "").trim(),
      email: customer.email || order.emailLower || "",
      add: fullAddress,
      city: customer.city || order.city || "",
      state: customer.province || customer.state || order.state || "",
      pin: String(customer.pincode || customer.zip || order.zip || "").trim(),
      order: String(job.orderNumber || order.orderNumber || orderRef.id),
      address_type: "home",
      payment_mode: collectableAmount > 0 ? "COD" : "Prepaid",
      cod_amount: collectableAmount,
      total_amount: total,
      shipping_mode: String(job.package?.shipping_mode || process.env.DELHIVERY_SHIPPING_MODE || "Surface"),
      client: sellerName,
      items: lineItems.map((item: any) => ({
        name: String(item.title || "Product"),
        sku: String(item.productId || item.id || ""),
        qty: Math.max(1, number(item.quantity, 1)),
        price: number(item.price?.amount ?? item.price),
      })),
      ...configuredPackage(job.package),
    };
    const payload: Record<string, unknown> = {
      shipments: [shipment],
      pickup_location: String(process.env.DELHIVERY_PICKUP_LOCATION || "").trim(),
    };
    const pickupTime = String(process.env.DELHIVERY_PICKUP_TIME || "").trim();
    const pickupDate = String(process.env.DELHIVERY_PICKUP_DATE || "").trim();
    if (pickupTime) payload.pickup_time = pickupTime;
    if (pickupDate) payload.pickup_date = pickupDate;

    const result = await callCarrierCreate(payload);
    const trackingNumber = extractWaybill(result);
    const trackingUrl = String(result?.tracking_url || result?.url || "").trim() || defaultTrackingUrl(trackingNumber);
    if (!trackingNumber) {
      throw new Error(extractCarrierError(result) || "Delhivery did not return a waybill/AWB in its response.");
    }

    const tracking = [{ number: trackingNumber, url: trackingUrl, company: "Delhivery" }];
    await orderRef.set(
      { tracking, awb: trackingNumber, fulfillmentStatus: "SHIPPED", updatedAt: new Date().toISOString() },
      { merge: true },
    );
    await jobRef.set({ status: "done", updatedAt: new Date().toISOString(), trackingNumber, trackingUrl, result }, { merge: true });

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

/** Read the durable shipment job for an order (used by the admin UI). */
export async function getShipmentJob(orderId: string): Promise<Record<string, unknown> | null> {
  const db = getFirebaseDb();
  const snap = await db.collection("shipments").doc(orderId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown> | undefined;
  return { ...(data || {}), id: snap.id };
}
