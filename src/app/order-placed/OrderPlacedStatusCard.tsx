"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, ShoppingBag } from "lucide-react";
import { formatINR } from "@/lib/currency";
import PurchaseDataLayerEvent from "./PurchaseDataLayerEvent";

type Props = {
  razorpayOrderId: string;
  paymentId: string;
  amount: number;
  paymentMode: string;
  initialOrderNumber?: number;
};

type ConfirmationState = {
  status: "processing" | "confirmed";
  firebaseOrderId?: string;
  orderNumber?: number;
};

export default function OrderPlacedStatusCard({
  razorpayOrderId,
  paymentId,
  amount,
  paymentMode,
  initialOrderNumber,
}: Props) {
  const isCodDeposit = paymentMode === "cod_deposit";
  const [confirmation, setConfirmation] = useState<ConfirmationState>(() =>
    initialOrderNumber
      ? {
          status: "confirmed",
          orderNumber: initialOrderNumber,
        }
      : { status: "processing" }
  );

  useEffect(() => {
    if (confirmation.status === "confirmed") return;
    if (!razorpayOrderId && !paymentId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollStatus = async () => {
      try {
        const params = new URLSearchParams();
        if (razorpayOrderId) params.set("orderId", razorpayOrderId);
        if (paymentId) params.set("paymentId", paymentId);

        const response = await fetch(`/api/razorpay/status?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (cancelled) return;

        if (response.ok && payload?.status === "confirmed") {
          setConfirmation({
            status: "confirmed",
            firebaseOrderId: String(payload?.firebaseOrderId || "").trim() || undefined,
            orderNumber: Number(payload?.orderNumber) || undefined,
          });
          return;
        }
      } catch {
        // Keep polling silently. Webhook confirmation can still arrive.
      }

      timeoutId = setTimeout(() => {
        void pollStatus();
      }, 2500);
    };

    void pollStatus();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [confirmation.status, paymentId, razorpayOrderId]);

  const confirmedOrderLabel = useMemo(() => {
    return confirmation.orderNumber ? `#${confirmation.orderNumber}` : confirmation.firebaseOrderId || "-";
  }, [confirmation.firebaseOrderId, confirmation.orderNumber]);

  const isConfirmed = confirmation.status === "confirmed";

  return (
    <>
      {isConfirmed && <PurchaseDataLayerEvent orderId={String(confirmation.orderNumber || confirmation.firebaseOrderId || razorpayOrderId)} amount={amount} />}

      <div className="overflow-hidden rounded-[1.75rem] border border-[#ded2c1] bg-[linear-gradient(145deg,#fffaf1_0%,#f5efe6_58%,#eef5eb_100%)] shadow-[0_35px_70px_-42px_rgba(56,68,58,0.72)]">
        <div className="border-b border-[#e8ddce] bg-[linear-gradient(90deg,#1d4534_0%,#667f54_50%,#b88962_100%)] px-6 py-4 text-white sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.12em]">
            {isConfirmed ? <CheckCircle2 size={14} /> : <LoaderCircle size={14} className="animate-spin" />}
            {isConfirmed ? "ORDER CONFIRMED" : "PAYMENT RECEIVED"}
          </div>
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl">
            {isConfirmed ? "Order Placed" : "Confirming Your Order"}
          </h1>
          <p className="mt-2 text-sm text-white/90">
            {isConfirmed
              ? isCodDeposit
                ? "Your COD security deposit was received. The balance will be collected at delivery."
                : "Your payment was successful. Thank you for shopping with us."
              : "Your payment went through. Please wait while we create your order automatically on our server."}
          </p>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          {!isConfirmed && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-900">
              <p className="font-semibold">Please wait on this page for a few seconds.</p>
              <p className="mt-2">
                Do not refresh, close the tab, or press back while order confirmation is running. If you accidentally leave,
                we will still keep processing your paid order securely on the server.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-[#e8dece] bg-white/75 p-5 text-sm text-[#3f4f45]">
            <div className="grid gap-3">
              {isConfirmed && (
                <p className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-[#25352d]">Order Number</span>
                  <span className="break-all text-right">{confirmedOrderLabel}</span>
                </p>
              )}
              <p className="flex items-start justify-between gap-3">
                <span className="font-semibold text-[#25352d]">Razorpay Order ID</span>
                <span className="break-all text-right">{razorpayOrderId || "-"}</span>
              </p>
              <p className="flex items-start justify-between gap-3">
                <span className="font-semibold text-[#25352d]">Payment ID</span>
                <span className="break-all text-right">{paymentId || "-"}</span>
              </p>
              <p className="flex items-start justify-between gap-3 border-t border-[#ebe2d4] pt-3">
                <span className="font-semibold text-[#25352d]">{isCodDeposit ? "Deposit Paid" : "Amount Paid"}</span>
                <span className="text-base font-bold text-[var(--color-brand)]">{formatINR(amount)}</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#e8dece] bg-white/70 px-4 py-3 text-sm text-[#3f4f45]">
            {isConfirmed
              ? "You will receive a confirmation email with your Order ID shortly. Our team will contact you within 24 hours."
              : "We will update this page automatically as soon as the order is created."}
          </div>

          {isConfirmed ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/collections"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
              >
                <ShoppingBag size={16} />
                Continue Shopping
              </Link>
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-xl border border-[#d2c6b6] bg-white/85 px-4 py-3 text-sm font-semibold text-[#2e4036] transition hover:bg-white sm:w-auto"
              >
                Back to Home
              </Link>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#365041]">
              <LoaderCircle size={16} className="animate-spin" />
              Finalizing your order...
            </div>
          )}
        </div>
      </div>
    </>
  );
}
