import "server-only";

import { NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildDelhiveryDetailsFromOrder,
  normalizeDelhiveryPhone,
  normalizeDelhiveryPincode,
  validateDelhiveryDetails,
} from "@/lib/delhivery-shipment";
import {
  checkDelhiveryServiceability,
  createDelhiveryShipment,
  getDelhiveryCompanyDetails,
  isDelhiveryApiConfigured,
} from "@/lib/delhivery-server";
import {
  buildDelhiveryOrderReference,
  buildDelhiveryTrackingUrl,
  parseManualOrderText,
} from "@/lib/delhiveryTracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const asText = (value: unknown) => String(value ?? "").trim();
const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
};

/** Firestore document id for an order id (mirrors the POST write). */
const toDocId = (orderId: string) => orderId.replace(/[^A-Za-z0-9_-]/g, "_");

function adminError(error: unknown) {
  const message = String((error as Error).message || error);
  if (message === "ADMIN_REQUIRED" || message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  console.error("Manual order error:", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Updates the stored details of a manual order.
 *
 * This only edits our Firestore record. The manifest already created in
 * Delhivery is not re-sent, so the AWB and the carrier copy keep whatever was
 * submitted at creation time.
 */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const id = asText(body?.id);
    if (!id) {
      return NextResponse.json({ error: "Order id required" }, { status: 400 });
    }

    const ref = getFirebaseDb().collection("manualOrders").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return NextResponse.json(
        { error: "That manual order no longer exists." },
        { status: 404 },
      );
    }
    const current = snapshot.data() || {};

    // Only these fields are editable; the AWB is immutable.
    const name = body?.name === undefined ? asText(current.name) : asText(body.name);
    const email = body?.email === undefined ? asText(current.email) : asText(body.email);
    const phone =
      body?.phone === undefined
        ? asText(current.phone)
        : normalizeDelhiveryPhone(body.phone);
    const address =
      body?.address === undefined ? asText(current.address) : asText(body.address);
    const city = body?.city === undefined ? asText(current.city) : asText(body.city);
    const state = body?.state === undefined ? asText(current.state) : asText(body.state);
    const pincode =
      body?.pincode === undefined
        ? asText(current.pincode)
        : normalizeDelhiveryPincode(body.pincode);
    const amount =
      body?.amount === undefined ? asNumber(current.amount) : asNumber(body.amount);
    const paymentMode =
      body?.paymentMode === undefined
        ? asText(current.paymentMode) || "COD"
        : asText(body.paymentMode).toUpperCase() === "PREPAID"
          ? "Prepaid"
          : "COD";

    const missing: string[] = [];
    if (!name) missing.push("name");
    if (!/^\d{10,15}$/.test(phone)) missing.push("phone (10 digits)");
    if (!address) missing.push("address");
    if (!/^\d{6}$/.test(pincode)) missing.push("pincode (6 digits)");
    if (!amount) missing.push("amount");
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing or invalid: ${missing.join(", ")}.` },
        { status: 400 },
      );
    }

    const awb = asText(current.awb);
    const patch = {
      name,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      amount,
      paymentMode,
      codAmount: paymentMode === "COD" ? amount : 0,
      trackingUrl: asText(current.trackingUrl) || buildDelhiveryTrackingUrl(awb),
      updatedAt: new Date().toISOString(),
    };
    await ref.set(patch, { merge: true });

    return NextResponse.json({ ok: true, id, order: { id, awb, ...patch } });
  } catch (error) {
    return adminError(error);
  }
}

/**
 * Deletes a manual order record.
 *
 * This only removes the Firestore entry. The shipment already created in
 * Delhivery keeps running, so cancel or edit the AWB in the Delhivery
 * dashboard as well if that is required.
 */
export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const id =
      asText(new URL(req.url).searchParams.get("id")) || asText(await readBodyId(req));
    if (!id) {
      return NextResponse.json({ error: "Order id required" }, { status: 400 });
    }
    const ref = getFirebaseDb().collection("manualOrders").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return NextResponse.json(
        { error: "That manual order no longer exists." },
        { status: 404 },
      );
    }
    await ref.delete();
    return NextResponse.json({ ok: true, id, deleted: true });
  } catch (error) {
    return adminError(error);
  }
}

/** DELETE may carry the id in the body when a query string is awkward. */
async function readBodyId(req: Request): Promise<unknown> {
  try {
    const body = await req.json();
    return body?.id;
  } catch {
    return "";
  }
}

/**
 * Lists the most recent manual (WhatsApp) Delhivery orders so the admin page
 * can show a durable history, not just what was created in this session.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = new URL(req.url).searchParams;
    const limit = Math.min(
      100,
      Math.max(1, Number(params.get("limit") || 20) || 20),
    );

    const snapshot = await getFirebaseDb()
      .collection("manualOrders")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const orders = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        orderId: asText(data.orderId) || doc.id,
        orderReference: asText(data.orderReference) || asText(data.orderId) || doc.id,
        name: asText(data.name),
        phone: asText(data.phone),
        email: asText(data.email),
        address: asText(data.address),
        city: asText(data.city),
        state: asText(data.state),
        pincode: asText(data.pincode),
        amount: asNumber(data.amount),
        paymentMode: asText(data.paymentMode) || "COD",
        codAmount: asNumber(data.codAmount),
        awb: asText(data.awb),
        trackingUrl:
          asText(data.trackingUrl) || buildDelhiveryTrackingUrl(data.awb),
        createdAt: asText(data.createdAt),
      };
    });

    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    const message = String((error as Error).message || error);
    if (message === "ADMIN_REQUIRED" || message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Manual order list error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Standalone Delhivery order creation for orders that never went through
 * checkout (e.g. orders taken over WhatsApp). Creates the manifest in
 * Delhivery and records it under `manualOrders` in Firestore so the admin can
 * look it up later. It deliberately does not touch the `orders` collection.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();

    const parsed = parseManualOrderText(body?.rawText);
    const orderId = asText(body?.orderId) || parsed.orderId;
    const name = asText(body?.name) || parsed.name;
    const email = asText(body?.email) || parsed.email;
    const address = asText(body?.address) || parsed.address;
    const pincode = normalizeDelhiveryPincode(body?.pincode ?? parsed.pincode);
    const phone = normalizeDelhiveryPhone(body?.phone ?? parsed.phone);
    const city = asText(body?.city) || parsed.city;
    const state = asText(body?.state) || parsed.state;
    const amount = asNumber(body?.amount ?? parsed.amount);
    const paymentMode =
      asText(body?.paymentMode || parsed.paymentMode).toUpperCase() === "PREPAID"
        ? "Prepaid"
        : "COD";

    const missing: string[] = [];
    if (!orderId) missing.push("order id");
    if (!name) missing.push("name");
    if (!/^\d{10,15}$/.test(phone)) missing.push("phone (10 digits)");
    if (!address) missing.push("address");
    if (!/^\d{6}$/.test(pincode)) missing.push("pincode (6 digits)");
    if (!amount) missing.push("amount");
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing or invalid: ${missing.join(", ")}.` },
        { status: 400 },
      );
    }
    if (!isDelhiveryApiConfigured()) {
      return NextResponse.json(
        { error: "Delhivery API is not configured. Add DELHIVERY_API_TOKEN on the server." },
        { status: 503 },
      );
    }

    // Delhivery's serviceability record is authoritative for city/state.
    const serviceability = await checkDelhiveryServiceability({
      pincode,
      paymentMode,
      chargeableWeightGrams: 450,
      collectableAmount: paymentMode === "COD" ? amount : 0,
    });
    if (!serviceability.paymentServiceable) {
      return NextResponse.json({ error: serviceability.message }, { status: 409 });
    }

    const syntheticOrder = {
      orderNumber: orderId,
      customer: {
        fullName: name,
        email,
        phone,
        address1: address,
        pincode,
        city: city || serviceability.city,
        state: state || serviceability.state,
      },
      lineItems: [{ title: "Succulents", quantity: 1, price: amount }],
      paymentMode,
      total: amount,
      cod_balance: paymentMode === "COD" ? amount : 0,
      createdAt: new Date().toISOString(),
    };
    const details = buildDelhiveryDetailsFromOrder(syntheticOrder);
    const errors = validateDelhiveryDetails({
      order: syntheticOrder,
      details,
      company: getDelhiveryCompanyDetails(),
      requireCompanyDetails: true,
    });
    if (errors.length) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const orderReference = buildDelhiveryOrderReference(orderId, 1);
    const result = await createDelhiveryShipment({
      order: syntheticOrder,
      orderId,
      details,
      orderReference,
    });

    const waybill = result.waybills[0];
    const now = new Date().toISOString();
    const record = {
      orderId,
      orderReference,
      name,
      email,
      phone,
      address,
      city: city || serviceability.city,
      state: state || serviceability.state,
      pincode,
      amount,
      paymentMode,
      codAmount: paymentMode === "COD" ? amount : 0,
      awb: waybill,
      trackingNumber: waybill,
      trackingUrl: buildDelhiveryTrackingUrl(waybill),
      serviceability,
      source: "manual",
      createdAt: now,
    };

    await getFirebaseDb()
      .collection("manualOrders")
      .doc(toDocId(orderId))
      .set(record, { merge: true });

    return NextResponse.json({
      ok: true,
      orderId,
      orderReference,
      awb: waybill,
      waybills: result.waybills,
      trackingNumber: waybill,
      trackingUrl: buildDelhiveryTrackingUrl(waybill),
      serviceability,
      record,
    });
  } catch (error) {
    const code = String((error as Error & { code?: string })?.code || "");
    const message = String((error as Error).message || error);
    console.error("Delhivery manual order error:", error);
    if (message === "ADMIN_REQUIRED" || message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (code === "CARRIER_NOT_CONFIGURED") {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}