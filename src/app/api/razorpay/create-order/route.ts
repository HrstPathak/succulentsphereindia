import { NextResponse } from "next/server";
import {
  createCheckoutSession,
  type CartItem,
  type CustomerInfo,
  type GatheringInfo,
  getCheckoutAmounts,
  priceCartItems,
  validateCheckoutPayload,
} from "@/lib/razorpayCheckout";
import { COD_DEPOSIT_AMOUNT } from "@/lib/checkoutConfig";
import { getAuthenticatedCustomer } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Missing Razorpay server credentials." }, { status: 500 });
    }

    const body = await req.json();
    const requestedItems = Array.isArray(body?.items) ? (body.items as CartItem[]) : [];
    if (requestedItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }
    const items = await priceCartItems(requestedItems);
    const customer = (body?.customer || {}) as CustomerInfo;
    const gathering = (body?.gathering || {}) as GatheringInfo;
    const paymentMode = body?.paymentMode === "cod_deposit" ? "cod_deposit" : "prepaid";

    validateCheckoutPayload({ items, customer, paymentMode });

    const pricingSummary = getCheckoutAmounts(items, paymentMode);
    const amount = pricingSummary.expectedAmountPaise;
    const receipt = `ss_${Date.now()}`;
    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt,
        notes: {
          source: "succulent-sphere-custom-checkout",
          shipping: String(pricingSummary.pricing.shipping),
          discount: String(pricingSummary.pricing.discount),
          payment_mode: paymentMode,
          cod_deposit: paymentMode === "cod_deposit" ? String(COD_DEPOSIT_AMOUNT) : "0",
          cod_fee: String(pricingSummary.codFee.toFixed(2)),
          order_total: String(pricingSummary.totalWithCod.toFixed(2)),
        },
      }),
      cache: "no-store",
    });

    const razorpayData = await razorpayRes.json();
    if (!razorpayRes.ok) {
      return NextResponse.json(
        { error: razorpayData?.error?.description || "Failed to create Razorpay order." },
        { status: razorpayRes.status }
      );
    }

    const session = await getAuthenticatedCustomer();
    await createCheckoutSession({
      razorpayOrderId: String(razorpayData?.id || "").trim(),
      receipt,
      items,
      customer,
      gathering,
      userId: session.uid,
      paymentMode,
      currency: "INR",
      expectedAmountPaise: amount,
      subtotal: pricingSummary.subtotal,
      shipping: pricingSummary.pricing.shipping,
      discount: pricingSummary.pricing.discount,
      total: pricingSummary.pricing.total,
      codFee: pricingSummary.codFee,
      totalWithCod: pricingSummary.totalWithCod,
    });

    return NextResponse.json(razorpayData);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
