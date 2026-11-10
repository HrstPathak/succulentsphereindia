import { NextResponse } from "next/server";
import {
  ensureFirebaseOrderForPayment,
  fetchRazorpayPaymentsForOrder,
  getCheckoutSessionByOrderId,
  noteCheckoutSessionError,
  recordPaymentAgainstSession,
} from "@/lib/razorpayCheckout";
import { sendOrderConfirmationEmail } from "@/lib/order-email";

export const runtime = "nodejs";

/**
 * Best-effort recovery when the browser leaves while Razorpay is returning its
 * callback. The order id is looked up in our server-created checkout session;
 * client supplied payment state is never trusted.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.razorpay_order_id || "").trim();
    if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
      return NextResponse.json({ error: "A valid Razorpay order id is required." }, { status: 400 });
    }

    const session = await getCheckoutSessionByOrderId(orderId);
    if (!session) return NextResponse.json({ error: "Checkout session not found." }, { status: 404 });

    // A repeated recovery request after successful order creation should not
    // make another Razorpay API call or repeat the order/email work.
    if (
      session.status === "order_created" &&
      session.firebaseOrderId &&
      String(session.paymentStatus || "").toLowerCase() === "captured"
    ) {
      return NextResponse.json({
        status: "confirmed",
        paymentStatus: "captured",
        paymentId: session.paymentId || "",
        amountPaise: session.expectedAmountPaise,
        paymentMode: session.paymentMode,
        firebaseOrderId: session.firebaseOrderId,
        orderNumber: session.orderNumber,
        alreadyCreated: true,
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return NextResponse.json({ error: "Missing Razorpay credentials." }, { status: 500 });

    let payment: any = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const payments = await fetchRazorpayPaymentsForOrder(orderId, keyId, keySecret);
      const orderPayments = payments.filter((item: any) => String(item?.order_id || "") === orderId);
      payment =
        orderPayments.find((item: any) => String(item?.status || "").toLowerCase() === "captured") ||
        orderPayments.find((item: any) => String(item?.status || "").toLowerCase() === "authorized") ||
        orderPayments.find((item: any) => String(item?.status || "").toLowerCase() === "failed") ||
        null;
      const status = String(payment?.status || "").toLowerCase();
      if (status === "captured" || status === "failed") break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 900));
    }

    if (!payment) {
      return NextResponse.json({ status: "processing", paymentStatus: session.paymentStatus || "pending" });
    }

    const paymentStatus = String(payment.status || "").toLowerCase();
    const paymentId = String(payment.id || "").trim();
    const paymentDetails = {
      razorpayOrderId: orderId,
      paymentId,
      paymentStatus,
      amountPaise: Number(payment.amount || 0),
      currency: String(payment.currency || "INR"),
      method: String(payment.method || ""),
    };

    if (paymentStatus === "failed") {
      await recordPaymentAgainstSession({
        ...paymentDetails,
        failureReason: String(payment.error_description || payment.error_reason || "Payment failed at the gateway."),
      });
      return NextResponse.json({ status: "failed", paymentStatus });
    }

    if (paymentStatus !== "captured" && paymentStatus !== "authorized") {
      return NextResponse.json({ status: "processing", paymentStatus });
    }

    await recordPaymentAgainstSession(paymentDetails);
    let result: Awaited<ReturnType<typeof ensureFirebaseOrderForPayment>>;
    try {
      result = await ensureFirebaseOrderForPayment({ ...paymentDetails, waitForLockMs: 12000 });
    } catch (error) {
      await noteCheckoutSessionError(orderId, (error as Error).message || "Order creation failed during payment reconciliation.").catch(() => undefined);
      throw error;
    }
    if (result.email && !(result as any).emailSent) await sendOrderConfirmationEmail(result.email);
    return NextResponse.json({
      status: result.firebaseOrderId ? "confirmed" : "processing",
      paymentStatus,
      paymentId,
      amountPaise: Number(payment.amount || 0),
      paymentMode: session.paymentMode,
      firebaseOrderId: result.firebaseOrderId,
      orderNumber: result.orderNumber,
      alreadyCreated: result.alreadyCreated,
      processing: result.processing,
    });
  } catch (error) {
    console.error("[razorpay reconcile error]", error);
    return NextResponse.json({ error: (error as Error).message || "Unable to reconcile checkout." }, { status: 500 });
  }
}
