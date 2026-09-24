import "server-only";

import type { DocumentReference } from "firebase-admin/firestore";
import { getFirebaseDb } from "@/lib/firebase-admin";
import {
  buildDelhiveryDetailsFromOrder,
  calculateDelhiveryPackageMetrics,
  normalizeDelhiveryDetails,
  normalizeDelhiveryPincode,
  validateDelhiveryDetails,
  type DelhiveryRateQuote,
  type DelhiveryServiceability,
  type DelhiveryShipmentDetails,
} from "@/lib/delhivery-shipment";
import {
  allocateDelhiveryWaybills,
  checkDelhiveryServiceability,
  createDelhiveryShipment,
  getDelhiveryAdminConfig,
  getDelhiveryCompanyDetails,
  getDelhiveryRateQuote,
  isDelhiveryApiConfigured,
} from "@/lib/delhivery-server";
import { sendTrackingEmail } from "@/lib/order-email";

export type ShipmentJobStatus =
  | "awaiting_details"
  | "draft"
  | "ready"
  | "processing"
  | "pending"
  | "done"
  | "manual_ready"
  | "failed";

type ShipmentOptions = {
  orderNumber?: number;
  retryFailed?: boolean;
};

type ShipmentJob = Record<string, unknown> & {
  orderId: string;
  orderNumber?: number | null;
  status?: ShipmentJobStatus;
  details?: DelhiveryShipmentDetails;
  serviceability?: DelhiveryServiceability | null;
  quotes?: DelhiveryRateQuote[];
  attempts?: number;
};

const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function defaultTrackingUrl(waybill: string) {
  return `https://www.delhivery.com/track/package/${encodeURIComponent(waybill)}`;
}

function customerDestinationPin(order: Record<string, unknown>) {
  const customer =
    order.customer && typeof order.customer === "object"
      ? (order.customer as Record<string, unknown>)
      : {};
  return normalizeDelhiveryPincode(
    customer.pincode || customer.zip || order.pincode || order.zip,
  );
}

async function readOrderAndJob(orderId: string) {
  const db = getFirebaseDb();
  const orderRef = db.collection("orders").doc(orderId);
  const jobRef = db.collection("shipments").doc(orderId);
  const [orderSnap, jobSnap] = await Promise.all([orderRef.get(), jobRef.get()]);
  if (!orderSnap.exists) throw new Error("Order not found.");
  return {
    db,
    orderRef,
    order: orderSnap.data() || {},
    jobRef,
    job: (jobSnap.exists ? jobSnap.data() : null) as ShipmentJob | null,
  };
}

function shipmentSnapshot(job: ShipmentJob | null, order: Record<string, unknown>) {
  const details = job?.details
    ? normalizeDelhiveryDetails(job.details)
    : buildDelhiveryDetailsFromOrder(order);
  return {
    order,
    job,
    details,
    metrics: calculateDelhiveryPackageMetrics(details.boxes),
    company: getDelhiveryCompanyDetails(),
    integration: getDelhiveryAdminConfig(),
  };
}

export async function getShipmentWorkspace(orderId: string) {
  const { order, job } = await readOrderAndJob(String(orderId || ""));
  return shipmentSnapshot(job, order);
}

export async function saveShipmentDetails(orderId: string, input: unknown) {
  const { order, job, jobRef } = await readOrderAndJob(String(orderId || ""));
  const existing = job?.details || job?.package || null;
  const details = buildDelhiveryDetailsFromOrder(order, input || existing);
  const errors = validateDelhiveryDetails({
    order,
    details,
    requireConfirmed: false,
  });
  if (errors.length) {
    const error = new Error(errors.join(" "));
    (error as Error & { code?: string }).code = "INVALID_SHIPMENT_DETAILS";
    throw error;
  }
  const now = new Date().toISOString();
  const nextStatus: ShipmentJobStatus = details.confirmed ? "ready" : "draft";
  await jobRef.set(
    {
      orderId,
      orderNumber: number(order.orderNumber) || null,
      carrier: "Delhivery",
      status: nextStatus,
      details,
      serviceability: null,
      quotes: [],
      lastError: null,
      updatedAt: now,
      ...(job?.createdAt ? { createdAt: job.createdAt } : { createdAt: now }),
    },
    { merge: true },
  );
  return getShipmentWorkspace(orderId);
}

function saveChecks(
  jobRef: DocumentReference,
  input: {
    serviceability?: DelhiveryServiceability | null;
    quotes?: DelhiveryRateQuote[];
  },
) {
  return jobRef.set(
    {
      ...input,
      checksUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function checkAndQuoteShipment(orderId: string, input?: unknown) {
  if (!isDelhiveryApiConfigured()) {
    const error = new Error(
      "Delhivery API is not configured. Add DELHIVERY_API_TOKEN, DELHIVERY_CREATE_URL, and DELHIVERY_CLIENT_NAME on the server.",
    );
    (error as Error & { code?: string }).code = "CARRIER_NOT_CONFIGURED";
    throw error;
  }
  const { order, job, jobRef } = await readOrderAndJob(orderId);
  const details = buildDelhiveryDetailsFromOrder(
    order,
    input || job?.details || job?.package || null,
  );
  const errors = validateDelhiveryDetails({
    order,
    details,
    company: getDelhiveryCompanyDetails(),
    requireConfirmed: false,
  });
  if (errors.length) {
    const error = new Error(errors.join(" "));
    (error as Error & { code?: string }).code = "INVALID_SHIPMENT_DETAILS";
    throw error;
  }
  await jobRef.set(
    {
      orderId,
      orderNumber: number(order.orderNumber) || null,
      carrier: "Delhivery",
      details,
      status: details.confirmed ? "ready" : "draft",
      lastError: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  const metrics = calculateDelhiveryPackageMetrics(details.boxes);
  const destinationPin = customerDestinationPin(order);
  const serviceability = await checkDelhiveryServiceability({
    pincode: destinationPin,
    paymentMode: details.paymentMode,
    chargeableWeightGrams: metrics.chargeableWeightGrams,
    collectableAmount: details.collectableAmount,
  });
  if (!serviceability.paymentServiceable) {
    await saveChecks(jobRef, { serviceability, quotes: [] });
    const error = new Error(serviceability.message);
    (error as Error & { code?: string }).code = "NOT_SERVICEABLE";
    throw error;
  }
  const company = getDelhiveryCompanyDetails();
  const quoteResults = await Promise.allSettled(
    (["Surface", "Express"] as const).map((mode) =>
      getDelhiveryRateQuote({
        company,
        destinationPincode: destinationPin,
        mode,
        chargeableWeightGrams: metrics.chargeableWeightGrams,
      }),
    ),
  );
  const quotes = quoteResults
    .filter(
      (result): result is PromiseFulfilledResult<DelhiveryRateQuote> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  if (!quotes.some((quote) => quote.mode === "Surface")) {
    const expressError = quoteResults.find(
      (result) => result.status === "rejected" && result.reason,
    ) as PromiseRejectedResult | undefined;
    await saveChecks(jobRef, { serviceability, quotes: [] });
    const error = new Error(
      expressError?.reason?.message ||
        "Delhivery did not return a Surface shipping quote for this route.",
    );
    (error as Error & { code?: string }).code = "RATE_UNAVAILABLE";
    throw error;
  }
  await jobRef.set(
    {
      orderId,
      orderNumber: number(order.orderNumber) || null,
      carrier: "Delhivery",
      details,
      serviceability,
      quotes,
      status: details.confirmed ? "ready" : "draft",
      lastError: null,
      checksUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(job?.createdAt ? { createdAt: job.createdAt } : { createdAt: new Date().toISOString() }),
    },
    { merge: true },
  );
  return getShipmentWorkspace(orderId);
}

export async function prepareManualShipment(orderId: string, input?: unknown) {
  const { order, job, jobRef } = await readOrderAndJob(orderId);
  const existingTracking = Array.isArray(order.tracking) ? order.tracking : [];
  if (existingTracking.some((item) => String(item?.number || "").trim())) {
    const error = new Error("This order already has an AWB. Edit the existing tracking instead of preparing another shipment.");
    (error as Error & { code?: string }).code = "SHIPMENT_ALREADY_CREATED";
    throw error;
  }
  const details = buildDelhiveryDetailsFromOrder(
    order,
    input || job?.details || job?.package || null,
  );
  const errors = validateDelhiveryDetails({ order, details });
  if (errors.length) {
    const error = new Error(errors.join(" "));
    (error as Error & { code?: string }).code = "INVALID_SHIPMENT_DETAILS";
    throw error;
  }
  await jobRef.set(
    {
      orderId,
      orderNumber: number(order.orderNumber) || null,
      carrier: "Delhivery",
      details,
      status: "manual_ready",
      mode: "manual",
      lastError: null,
      manualPreparedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(job?.createdAt ? { createdAt: job.createdAt } : { createdAt: new Date().toISOString() }),
    },
    { merge: true },
  );
  return getShipmentWorkspace(orderId);
}

/** Creates one durable shipment job per order. Paid orders wait for confirmed packing details. */
export async function enqueueShipment(orderId: string, options: ShipmentOptions = {}) {
  const { order, job, jobRef } = await readOrderAndJob(orderId);
  const now = new Date().toISOString();
  if (!job) {
    const details = buildDelhiveryDetailsFromOrder(order);
    await jobRef.set({
      orderId,
      orderNumber: options.orderNumber || number(order.orderNumber) || null,
      carrier: "Delhivery",
      status: "awaiting_details",
      details,
      serviceability: null,
      quotes: [],
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
  } else if (options.retryFailed && job.status === "failed") {
    const details = buildDelhiveryDetailsFromOrder(order, job.details || job.package);
    await jobRef.set({
      status: details.confirmed ? "ready" : "awaiting_details",
      mode: "api",
      attempts: 0,
      lastError: null,
      requiresManualVerification: false,
      updatedAt: now,
    }, { merge: true });
  }
  return orderId;
}

async function notifyTracking(input: {
  orderId: string;
  order: Record<string, unknown>;
  trackingNumber: string;
  trackingUrl: string;
}) {
  const customer =
    input.order.customer && typeof input.order.customer === "object"
      ? (input.order.customer as Record<string, unknown>)
      : {};
  const recipient = String(input.order.emailLower || customer.email || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(recipient)) return;
  try {
    await sendTrackingEmail({
      orderId: input.orderId,
      orderNumber: number(input.order.orderNumber),
      customerName: String(customer.fullName || input.order.customerName || "Customer"),
      customerEmail: recipient,
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl,
      carrier: "Delhivery",
    });
  } catch (error) {
    const db = getFirebaseDb();
    await db.collection("orders").doc(input.orderId).set({
      trackingEmailError: String((error as Error).message || error).slice(0, 300),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
}

export async function retryShipment(orderId: string) {
  const { job, jobRef } = await readOrderAndJob(orderId);
  const details = normalizeDelhiveryDetails(job?.details || job?.package);
  if (!details.confirmed) {
    const error = new Error("Confirm the packed measurements before retrying API creation.");
    (error as Error & { code?: string }).code = "INVALID_SHIPMENT_DETAILS";
    throw error;
  }
  if (job?.requiresManualVerification) {
    throw new Error(
      "This shipment has an uncertain or partial Delhivery allocation. Verify the dashboard before retrying, or attach the AWB manually.",
    );
  }
  await jobRef.set({
    status: "ready",
    mode: "api",
    attempts: 0,
    lastError: null,
    requiresManualVerification: false,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return processShipmentJob(orderId, { force: true });
}


export async function processShipmentJob(
  jobId: string,
  options: { force?: boolean } = {},
) {
  if (!isDelhiveryApiConfigured()) {
    return { ok: false, skipped: true, reason: "carrier_not_configured" };
  }
  const db = getFirebaseDb();
  const jobRef = db.collection("shipments").doc(jobId);
  const lock = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) throw new Error("Shipment job not found.");
    const job = snapshot.data() as ShipmentJob;
    if (job.status === "done") return { job, skip: "already_created" };
    if (job.status === "manual_ready") return { job, skip: "manual_mode" };
    if (job.status === "awaiting_details" || job.status === "draft") {
      return { job, skip: "details_required" };
    }
    if (job.status === "failed" && !options.force) {
      return { job, skip: "retry_limit_reached" };
    }
    const details = normalizeDelhiveryDetails(job.details || job.package);
    if (!details.confirmed && !options.force) {
      return { job, skip: "confirmation_required" };
    }
    const updatedAt = new Date(String(job.updatedAt || 0)).getTime();
    const processingIsFresh =
      job.status === "processing" &&
      Number.isFinite(updatedAt) &&
      Date.now() - updatedAt < 10 * 60 * 1000;
    if (processingIsFresh) return { job, skip: "already_processing" };
    const attempts = number(job.attempts) + 1;
    transaction.set(jobRef, {
      status: "processing",
      mode: "api",
      details,
      attempts,
      lastError: null,
      requiresManualVerification: false,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { job: { ...job, details, attempts }, skip: "" };
  });
  if (lock.skip) {
    if (lock.skip === "confirmation_required" || lock.skip === "details_required") {
      await jobRef.set(
        {
          status: "awaiting_details",
          lastError: "Confirm the packed measurements before API creation.",
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    if (lock.skip === "already_created") {
      return {
        ok: true,
        skipped: true,
        reason: lock.skip,
        waybills: Array.isArray(lock.job.waybills) ? lock.job.waybills : [],
      };
    }
    return { ok: false, skipped: true, reason: lock.skip };
  }

  const job = lock.job;
  const details = normalizeDelhiveryDetails(job.details);
  const attempts = number(job.attempts);
  let partialWaybills: string[] = [];
  let createAttempted = false;
  try {
    const orderRef = db.collection("orders").doc(String(job.orderId));
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error("Order not found for shipment job.");
    const order = orderSnap.data() || {};
    const existingTracking = Array.isArray(order.tracking) ? order.tracking : [];
    if (existingTracking.some((item) => String(item?.number || "").trim())) {
      await jobRef.set({
        status: "done",
        trackingNumbers: existingTracking.map((item) => String(item.number)),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return {
        ok: true,
        skipped: true,
        reason: "order_already_has_tracking",
        waybills: existingTracking.map((item) => String(item.number)),
      };
    }

    const company = getDelhiveryCompanyDetails();
    const errors = validateDelhiveryDetails({
      order,
      company,
      details,
      requireCompanyDetails: true,
    });
    if (errors.length) throw new Error(errors.join(" "));
    const metrics = calculateDelhiveryPackageMetrics(details.boxes);
    const serviceability = await checkDelhiveryServiceability({
      pincode: customerDestinationPin(order),
      paymentMode: details.paymentMode,
      chargeableWeightGrams: metrics.chargeableWeightGrams,
      collectableAmount: details.collectableAmount,
    });
    if (!serviceability.paymentServiceable) throw new Error(serviceability.message);

    let allocatedWaybills = Array.isArray(job.allocatedWaybills)
      ? job.allocatedWaybills.map(String)
      : [];
    if (details.boxes.length > 1 && allocatedWaybills.length !== details.boxes.length) {
      allocatedWaybills = await allocateDelhiveryWaybills(details.boxes.length);
      await jobRef.set(
        {
          allocatedWaybills,
          waybillsAllocatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    createAttempted = true;
    const result = await createDelhiveryShipment({
      order,
      company,
      details,
      waybills: allocatedWaybills,
    });
    partialWaybills = result.waybills;
    const expected = details.boxes.length;
    if (result.waybills.length !== expected) {
      await orderRef.set({
        tracking: result.waybills.map((waybill) => ({
          number: waybill,
          url: defaultTrackingUrl(waybill),
          company: "Delhivery",
        })),
        partialShipment: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      throw new Error(
        `Delhivery returned ${result.waybills.length} of ${expected} AWBs. Verify the partial shipment in Delhivery before retrying.`,
      );
    }
    const tracking = result.waybills.map((waybill) => ({
      number: waybill,
      url: defaultTrackingUrl(waybill),
      company: "Delhivery",
    }));
    const now = new Date().toISOString();
    await orderRef.set({
      tracking,
      awb: result.waybills[0],
      fulfillmentStatus: "SHIPPED",
      partialShipment: false,
      updatedAt: now,
    }, { merge: true });
    await jobRef.set({
      status: "done",
      mode: "api",
      serviceability,
      waybills: result.waybills,
      trackingNumbers: result.waybills,
      packageResults: result.packageResults,
      result: result.raw,
      completedAt: now,
      updatedAt: now,
    }, { merge: true });
    await notifyTracking({
      orderId: orderRef.id,
      order,
      trackingNumber: result.waybills[0],
      trackingUrl: defaultTrackingUrl(result.waybills[0]),
    });
    return { ok: true, waybills: result.waybills };
  } catch (error) {
    const message = String((error as Error).message || error).slice(0, 1000);
    await jobRef.set({
      status: "failed",
      attempts,
      lastError: message,
      requiresManualVerification: createAttempted || partialWaybills.length > 0,
      partialWaybills,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { ok: false, error: message, waybills: partialWaybills };
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
    ...processing.docs.filter(
      (doc) => new Date(String(doc.get("updatedAt") || 0)).getTime() < staleCutoff,
    ),
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
  return { ...(snap.data() || {}), id: snap.id };
}
