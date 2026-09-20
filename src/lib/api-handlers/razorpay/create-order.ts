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
import { releaseWalletHold, reserveWalletForCheckout } from "@/lib/wallet";

/** POST /api/razorpay/create-order — create a Razorpay order and checkout session */
export async function handleRazorpayCreateOrder(req: Request) {
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

    // The client-sent wallet amount is only a *request*. It is clamped server-side
    // inside reserveWalletForCheckout (min of requested / available balance / per-order cap).
    const requestedWalletAmount = Math.max(0, Number(body?.walletAmount || 0));

    validateCheckoutPayload({ items, customer, paymentMode });

    const basePricingSummary = getCheckoutAmounts(items, paymentMode);
    const session = await getAuthenticatedCustomer();
    const receipt = `ss_${Date.now()}`;
    // Place a short-lived hold so the balance cannot be double-spent across tabs
    // while the Razorpay payment is in flight. No balance is debited yet.
    const walletReservation = session.uid
      ? await reserveWalletForCheckout({
          uid: session.uid,
          requestedAmount: requestedWalletAmount,
          orderTotal: basePricingSummary.totalWithCod,
          holdId: receipt,
        })
      : { walletAmountApplied: 0, walletBalance: 0, walletAvailableBalance: 0, walletHoldId: null };
    const pricingSummary = getCheckoutAmounts(items, paymentMode, walletReservation.walletAmountApplied);
    const amount = pricingSummary.expectedAmountPaise;
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
          wallet_used: String(pricingSummary.walletAmountApplied.toFixed(2)),
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
      // Payment could not even be started — give the held balance straight back.
      if (session.uid && walletReservation.walletHoldId) {
        await releaseWalletHold({ uid: session.uid, holdId: walletReservation.walletHoldId });
      }
      return NextResponse.json(
        { error: razorpayData?.error?.description || "Failed to create Razorpay order." },
        { status: razorpayRes.status }
      );
    }

    try {
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
        walletAmountApplied: pricingSummary.walletAmountApplied,
        walletHoldId: walletReservation.walletHoldId,
        payableAmount: pricingSummary.payableAmount,
        cashbackBasisAmount: pricingSummary.cashbackBasisAmount,
      });
    } catch (error) {
      // Session persistence failed after the Razorpay order was created — release the hold.
      if (session.uid && walletReservation.walletHoldId) {
        await releaseWalletHold({ uid: session.uid, holdId: walletReservation.walletHoldId });
      }
      throw error;
    }

    return NextResponse.json({
      ...razorpayData,
      walletAmountApplied: pricingSummary.walletAmountApplied,
      walletAvailableBalance: walletReservation.walletAvailableBalance,
      payableAmount: pricingSummary.payableAmount,
      orderTotalAfterWallet: pricingSummary.orderTotalAfterWallet,
      cashbackBasisAmount: pricingSummary.cashbackBasisAmount,
      walletHoldId: walletReservation.walletHoldId,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}