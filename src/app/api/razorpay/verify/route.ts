import { NextResponse } from "next/server";
import {
  ensureFirebaseOrderForPayment,
  fetchRazorpayPayment,
  getCheckoutSessionByOrderId,
  isValidRazorpaySignature,
  noteCheckoutSessionError,
} from "@/lib/razorpayCheckout";
import { sendOrderConfirmationEmail } from "@/lib/order-email";

export const runtime = "nodejs";

async function waitForCapturedPayment(input: {
  paymentId: string;
  keyId: string;
  keySecret: string;
  maxAttempts?: number;
  delayMs?: number;
}) {
  const maxAttempts = input.maxAttempts ?? 6;
  const delayMs = input.delayMs ?? 1500;
  let latestPayment: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    latestPayment = await fetchRazorpayPayment(input.paymentId, input.keyId, input.keySecret);
    const paymentStatus = String(latestPayment?.status || "").toLowerCase();
    if (paymentStatus === "captured") {
      return latestPayment;
    }
    if (paymentStatus !== "authorized") {
      return latestPayment;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return latestPayment;
}

export async function POST(req: Request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Missing Razorpay credentials." }, { status: 500 });
    }

    const body = await req.json();
    const orderId = String(body?.razorpay_order_id || "").trim();
    const paymentId = String(body?.razorpay_payment_id || "").trim();
    const signature = String(body?.razorpay_signature || "").trim();

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: "Missing payment verification fields." }, { status: 400 });
    }

    const session = await getCheckoutSessionByOrderId(orderId);
    if (!session) {
      return NextResponse.json(
        {
          verified: false,
          error: "Checkout session not found for this payment. Please contact support before retrying payment.",
        },
        { status: 409 }
      );
    }

    const verified = isValidRazorpaySignature({
      orderId,
      paymentId,
      signature,
      keySecret,
    });

    if (!verified) {
      await noteCheckoutSessionError(orderId, "Invalid payment signature.");
      return NextResponse.json({ verified: false, error: "Invalid payment signature." }, { status: 400 });
    }

    const razorpayPayment = await waitForCapturedPayment({
      paymentId,
      keyId,
      keySecret,
    });
    const paymentStatus = String(razorpayPayment?.status || "").toLowerCase();

    if (paymentStatus !== "captured" && paymentStatus !== "authorized") {
      await noteCheckoutSessionError(orderId, `Payment status is ${paymentStatus || "unknown"} in Razorpay.`);
      return NextResponse.json(
        { verified: false, error: `Payment status is ${paymentStatus || "unknown"} in Razorpay.` },
        { status: 400 }
      );
    }

    const result = await ensureFirebaseOrderForPayment({
      razorpayOrderId: orderId,
      paymentId,
      paymentStatus,
      amountPaise: Number(razorpayPayment?.amount || 0),
      currency: String(razorpayPayment?.currency || "INR"),
      waitForLockMs: 15000,
    });
    // ensureFirebaseOrderForPayment now attempts to send the email itself and sets `emailSent`.
    if (result.email && !(result as any).emailSent) await sendOrderConfirmationEmail(result.email);

    return NextResponse.json({
      verified: true,
      orderId,
      paymentId,
      firebaseOrderId: result.firebaseOrderId,
      orderNumber: result.orderNumber,
      alreadyCreated: result.alreadyCreated,
      processing: result.processing,
      paymentCaptured: paymentStatus === "captured",
      paymentStatus,
    });
  } catch (error) {
    console.error("[verify route error]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
