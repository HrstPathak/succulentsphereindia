"use client";


import { Wallet } from "lucide-react";
import { formatINR } from "@/lib/currency";

type ActiveCredit = {
  id: string;
  amount: number;
  expiresAt: string | null;
};

type Transaction = {
  id: string;
  type: "credit" | "debit" | "expired";
  amount: number;
  reason: string;
  orderId: string | null;
  earnedAt: string | null;
  expiresAt: string | null;
  status: string;
  effectiveStatus: string;
  createdAt: string;
};

type WalletSectionProps = {
  balance: number;
  availableBalance: number;
  activeCredits: ActiveCredit[];
  transactions: Transaction[];
};

function expiryLabel(expiresAt: string | null): { days: number; label: string; color: string } {
  if (!expiresAt) return { days: 0, label: "No expiry", color: "text-gray-500" };
  const expires = new Date(expiresAt);
  const now = new Date();
  const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) return { days: diffDays, label: `Expires in ${diffDays} days`, color: "text-emerald-700" };
  if (diffDays >= 7) return { days: diffDays, label: `Expires in ${diffDays} days`, color: "text-amber-700" };
  return { days: diffDays, label: `Expires in ${diffDays} days`, color: "text-red-700" };
}

function transactionLabel(t: Transaction): string {
  const reasonLabels: Record<string, string> = {
    order_cashback: "Cashback earned",
    order_redemption: "Wallet redeemed",
    expiry: "Credit expired",
    refund_credit: "Wallet refunded",
    admin_adjustment: "Admin adjustment",
    order_cashback_reversal: "Cashback reversed",
  };
  const base = reasonLabels[t.reason] || t.reason;
  const orderRef = t.orderId ? ` (Order #${t.orderId.slice(0, 8)})` : "";
  const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
  return `${base}${orderRef} — ${date}`;
}

export default function WalletSection({
  balance,
  availableBalance,
  activeCredits,
  transactions,
}: WalletSectionProps) {
  const hasBalance = balance > 0;
  const hasActiveCredits = activeCredits.length > 0;
  const recentTransactions = transactions.slice(0, 12);

  return (
    <div className="mt-4 rounded-2xl border border-[var(--auth-border)] bg-white/70 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-3 border-b border-[rgb(var(--ss-border-rgb)/0.4)] pb-4">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(135deg,#1d4534,#6a8257)] text-white shadow-inner">
          <Wallet size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h3 className="font-serif text-2xl text-[var(--color-text)]">My Wallet</h3>
          <p className="text-xs text-[var(--auth-muted)]">4% cashback on orders above ₹400, expires in 90 days</p>
        </div>
      </div>

      {hasBalance ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-[var(--auth-muted)] uppercase tracking-wide">Available to use</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-semibold text-[var(--color-brand)]">{formatINR(availableBalance, 0)}</span>
              <span className="text-sm text-[var(--auth-muted)]">
                (₹{balance.toFixed(0)} total, ₹{availableBalance.toFixed(0)} available)
              </span>
            </p>
            {availableBalance > 0 ? (
              <p className="mt-1.5 text-xs text-[var(--color-brand)]">
                Use up to ₹50 of this balance on your next order above ₹199 at checkout.
              </p>
            ) : null}
          </div>

          {hasActiveCredits ? (
            <div>
              <p className="text-xs text-[var(--auth-muted)] uppercase tracking-wide">Active credits</p>
              <ul className="mt-2 space-y-2">
                {activeCredits.map((credit) => {
                  const expiry = expiryLabel(credit.expiresAt);
                  return (
                    <li
                      key={credit.id}
                      className="flex items-center justify-between rounded-lg border border-[rgb(var(--ss-border-rgb)/0.4)] bg-white/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-[var(--color-text)]">{formatINR(credit.amount, 0)}</span>
                      </div>
                      <span className={`text-xs font-medium ${expiry.color}`}>{expiry.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-xs text-[var(--auth-muted)] uppercase tracking-wide">Recent activity</p>
            {recentTransactions.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {recentTransactions.map((t) => {
                  const isCredit = t.type === "credit" && t.effectiveStatus === "active" && t.amount > 0;
                  const isExpired = t.effectiveStatus === "expired";
                  const sign = isCredit ? "+" : "-";
                  const color = isCredit ? "text-emerald-700" : isExpired ? "text-gray-500" : "text-rose-700";
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-[var(--auth-text)]">{transactionLabel(t)}</span>
                      <span className={`ml-3 font-medium whitespace-nowrap ${color}`}>
                        {sign}{formatINR(t.amount, 0)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--auth-muted)]">No wallet activity yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-[rgb(var(--ss-border-rgb)/0.6)] bg-white/40 p-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(135deg,#f3ede4,#e2d4c0)] shadow-inner">
            <Wallet size={26} strokeWidth={1.4} className="text-[rgb(var(--ss-text-rgb)/0.5)]" />
          </div>
          <p className="mt-4 font-serif text-xl text-[var(--color-text)]">No wallet balance yet</p>
          <p className="mt-1 max-w-xs text-sm text-[var(--auth-muted)]">
            Earn 4% cashback on every order above ₹400. Credits are added to your wallet and expire in 90 days.
          </p>
          <a
            href="/shop"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(52,78,65,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(52,78,65,0.3)]"
          >
            Shop now
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

