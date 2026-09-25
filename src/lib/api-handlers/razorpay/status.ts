import { NextResponse } from "next/server";
import { ensureFirebaseOrderForPayment, fetchRazorpayPayment, getCheckoutSessionByOrderId, getCheckoutSessionByPaymentId } from "@/lib/razorpayCheckout";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { getShipmentCreationSummary } from "@/lib/shipping";

/** GET /api/razorpay/status — poll payment/checkout status */
export async function handleRazorpayStatus(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = String(searchParams.get("orderId") || "");
    const paymentId = String(searchParams.get("paymentId") || "");
    const session = orderId ? await getCheckoutSessionByOrderId(orderId) : paymentId ? await getCheckoutSessionByPaymentId(paymentId) : null;
    if (!session) return NextResponse.json({ error: "Checkout session not found." }, { status: 404 });
    const paymentIsCaptured =
      String(session.paymentStatus || "").toLowerCase() === "captured";
    if (
      session.status === "order_created" &&
      session.firebaseOrderId &&
      paymentIsCaptured
    ) {
      return NextResponse.json({
        status: "confirmed",
        firebaseOrderId: session.firebaseOrderId,
        orderNumber: session.orderNumber,
        paymentId: paymentId || session.paymentId,
        shipment: await getShipmentCreationSummary(session.firebaseOrderId),
      });
    }
    const effectivePaymentId = paymentId || session.paymentId;
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (effectivePaymentId && keyId && keySecret) {
      const payment = await fetchRazorpayPayment(effectivePaymentId, keyId, keySecret);
      if (String(payment.status).toLowerCase() === "captured") {
        const result = await ensureFirebaseOrderForPayment({ razorpayOrderId: session.razorpayOrderId, paymentId: effectivePaymentId, paymentStatus: "captured", amountPaise: Number(payment.amount), currency: String(payment.currency || "INR") });
        if (result.email) await sendOrderConfirmationEmail(result.email);
        return NextResponse.json({
          status: "confirmed",
          firebaseOrderId: result.firebaseOrderId,
          orderNumber: result.orderNumber,
          paymentId: effectivePaymentId,
          shipment: result.shipment,
        });
      }
    }
    return NextResponse.json({ status: "processing", paymentId: effectivePaymentId, paymentStatus: session.paymentStatus || null, lastError: session.lastError || null });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}