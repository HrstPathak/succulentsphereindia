"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { formatINR } from "@/lib/currency";

// Mirrors the server wallet rules in src/lib/wallet.ts
// (WALLET_CASHBACK_RATE, WALLET_CASHBACK_MIN_ORDER_TOTAL) so the estimate shown
// here always matches what creditWalletCashback() credits after payment.
const CASHBACK_RATE = 0.04;
const CASHBACK_MIN_ORDER_TOTAL = 400;

function estimateCashback(basisAmount: number) {
  if (basisAmount < CASHBACK_MIN_ORDER_TOTAL) return 0;
  return Math.round(basisAmount * CASHBACK_RATE);
}

type WalletCashbackBadgeProps = {
  /** Value the server bases cashback on: pricing total minus wallet redemption, COD fees excluded. */
  basisAmount: number;
  /** Cashback is only credited for logged-in customers (server needs a uid). */
  isLoggedIn: boolean;
};

export default function WalletCashbackBadge({ basisAmount, isLoggedIn }: WalletCashbackBadgeProps) {
  const estimatedEarn = estimateCashback(basisAmount);

  // Guests below the threshold get no badge — nothing to promote yet.
  if (!isLoggedIn && estimatedEarn <= 0) return null;

  let message;
  if (!isLoggedIn) {
    message = (
      <>
        <Link
          href="/login"
          className="font-semibold underline decoration-[rgb(var(--ss-brand-rgb)/0.35)] underline-offset-2 hover:decoration-current"
        >
          Sign in
        </Link>{" "}
        to earn {formatINR(estimatedEarn, 0)} wallet cashback on this order
      </>
    );
  } else if (estimatedEarn > 0) {
    message = <>You&apos;ll earn {formatINR(estimatedEarn, 0)} wallet cashback on this order</>;
  } else {
    message = <>Add {formatINR(CASHBACK_MIN_ORDER_TOTAL - basisAmount, 0)} more to unlock 4% wallet cashback</>;
  }

  return (
    <p className="flex items-center gap-2 rounded-full border border-[rgb(var(--ss-brand-rgb)/0.22)] bg-[rgb(var(--ss-brand-rgb)/0.05)] px-3.5 py-2 text-xs leading-snug text-[var(--color-brand)]">
      <Sparkles size={14} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
