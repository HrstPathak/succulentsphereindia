import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  ensureFirebaseOrderForPayment,
  getCheckoutSessionByOrderId,
  noteCheckoutSessionError,
  recordPaymentAgainstSession,
} from "@/lib/razorpayCheckout";
import { sendOrderConfirmationEmail } from "@/lib/order-email";

export const runtime = "nodejs";

function isValidWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return expectedSignature === signature;
}

export async function POST(req: Request) {
  const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing RAZORPAY_WEBHOOK_SECRET." }, { status: 500 });
  }

  const signature = String(req.headers.get("x-razorpay-signature") || "").trim();
  if (!signature) {
    return NextResponse.json({ error: "Missing Razorpay webhook signature." }, { status: 400 });
  }

  const rawBody = await req.text();
  if (!isValidWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Razorpay webhook signature." }, { status: 400 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const eventName = String(payload?.event || "").trim();
    const payment = payload?.payload?.payment?.entity;
    const orderId = String(payment?.order_id || "").trim();
    const paymentId = String(payment?.id || "").trim();
    const paymentStatus = String(payment?.status || "").toLowerCase();
    const paymentAmount = Number(payment?.amount || 0);
    const paymentCurrency = String(payment?.currency || "INR");

    if (!orderId || !paymentId) {
      return NextResponse.json({ received: true, ignored: true, reason: "missing_ids" });
    }

    const session = await getCheckoutSessionByOrderId(orderId);
    if (!session) {
      return NextResponse.json({ received: true, ignored: true, reason: "session_not_found" });
    }

    if (eventName === "payment.authorized") {
      await recordPaymentAgainstSession({
        razorpayOrderId: orderId,
        paymentId,
        paymentStatus,
        amountPaise: paymentAmount,
        currency: paymentCurrency,
      });

      return NextResponse.json({ received: true, processed: true, awaitingCapture: true });
    }

    if (eventName !== "payment.captured") {
      return NextResponse.json({ received: true, ignored: true, reason: "event_not_handled" });
    }

    const result = await ensureFirebaseOrderForPayment({
      razorpayOrderId: orderId,
      paymentId,
      paymentStatus,
      amountPaise: paymentAmount,
      currency: paymentCurrency,
      waitForLockMs: 10000,
    });
    if (result.email && !(result as any).emailSent) await sendOrderConfirmationEmail(result.email);

    return NextResponse.json({
      received: true,
      processed: true,
      firebaseOrderId: result.firebaseOrderId,
      orderNumber: result.orderNumber,
      alreadyCreated: result.alreadyCreated,
      processing: result.processing,
    });
  } catch (error) {
    const payloadText = rawBody.slice(0, 300);
    console.error("[razorpay webhook error]", error, payloadText);

    try {
      const parsed = JSON.parse(rawBody);
      const payment = parsed?.payload?.payment?.entity;
      const orderId = String(payment?.order_id || "").trim();
      if (orderId) {
        await noteCheckoutSessionError(orderId, (error as Error).message);
      }
    } catch {}

    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
