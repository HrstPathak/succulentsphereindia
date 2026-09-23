import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import {
  WALLET_CASHBACK_MIN_ORDER_TOTAL,
  WALLET_CASHBACK_RATE,
  WALLET_CREDIT_EXPIRY_DAYS,
} from "@/lib/wallet";

/**
 * Slim promo strip under the home hero advertising the wallet cashback offer.
 *
 * Server component only — @/lib/wallet pulls in firebase-admin for the
 * admin-side credit logic, which must never end up in a "use client" bundle.
 * Numbers come from the same constants creditWalletCashback() uses, so the
 * advertised offer can never drift from what checkout actually credits.
 */
export default function CashbackStrip() {
  const percent = Math.round(WALLET_CASHBACK_RATE * 100);
  const minOrder = WALLET_CASHBACK_MIN_ORDER_TOTAL;
  const expiryDays = WALLET_CREDIT_EXPIRY_DAYS;

  return (
    <section
      aria-label={`${percent}% wallet cashback offer`}
      className="relative w-full overflow-hidden bg-[linear-gradient(90deg,#12291c_0%,#1d4534_45%,#2f5c42_100%)] text-white"
    >
      {/* Soft decorative highlights (mirrors the sticky-CTA card treatment) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 -top-14 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="absolute -bottom-16 right-[18%] h-36 w-36 rounded-full bg-[#f6d7b5]/15 blur-2xl" />
      </div>

      <div className="container relative mx-auto flex flex-col items-center gap-2.5 px-4 py-3.5 text-center sm:flex-row sm:justify-center sm:gap-6 sm:py-3 sm:text-left">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur-sm">
          <Wallet size={13} strokeWidth={2} aria-hidden="true" />
          Wallet Offer
        </span>

        <p className="text-sm leading-snug">
          <strong className="font-bold">{percent}% cashback</strong> on every order above{" "}
          <strong className="font-bold">₹{minOrder}</strong>
          <span className="mt-0.5 block text-white/75 sm:mt-0 sm:ml-1.5 sm:inline">
            credited to your wallet · expires in {expiryDays} days
          </span>
        </p>

        <Link
          href="/shop"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#1d4534] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.28)]"
        >
          Shop now
          <ArrowRight
            size={13}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}