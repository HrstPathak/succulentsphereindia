import "server-only";

import type { Transaction } from "firebase-admin/firestore";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const WALLET_CASHBACK_RATE = 0.04;
export const WALLET_CASHBACK_MIN_ORDER_TOTAL = 400;
export const WALLET_CREDIT_EXPIRY_DAYS = 90;
export const WALLET_REDEEM_MIN_ORDER_TOTAL = 199;
export const WALLET_REDEEM_MAX_PER_ORDER = 50;
export const WALLET_HOLD_MINUTES = 30;

export type WalletLedgerType = "credit" | "debit" | "expired";
export type WalletLedgerReason =
  | "order_cashback"
  | "order_redemption"
  | "expiry"
  | "refund_credit"
  | "admin_adjustment"
  | "order_cashback_reversal";
export type WalletLedgerStatus = "active" | "used" | "expired";

export type WalletTransaction = {
  id: string;
  type: WalletLedgerType;
  amount: number;
  originalAmount?: number;
  reason: WalletLedgerReason;
  orderId: string | null;
  earnedAt: string | null;
  expiresAt: string | null;
  status: WalletLedgerStatus;
  effectiveStatus: WalletLedgerStatus;
  createdAt: string;
};

export type WalletSummary = {
  balance: number;
  availableBalance: number;
  heldBalance: number;
  activeCredits: WalletTransaction[];
  transactions: WalletTransaction[];
};

const roundRupees = (value: number) => Math.round(Number(value || 0));
const money = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Number(next.toFixed(2))) : 0;
};
const iso = (value: unknown) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") return (value as { toDate: () => Date }).toDate().toISOString();
  return String(value);
};
const dateValue = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") return (value as { toDate: () => Date }).toDate();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

function isActiveCredit(data: FirebaseFirestore.DocumentData, now: Date) {
  const expiresAt = dateValue(data.expiresAt);
  return data.type === "credit" && data.status === "active" && money(data.amount) > 0 && Boolean(expiresAt && expiresAt > now);
}

function mapLedgerDoc(doc: FirebaseFirestore.QueryDocumentSnapshot, now: Date): WalletTransaction {
  const data = doc.data();
  const expiresAt = dateValue(data.expiresAt);
  const status = String(data.status || "active") as WalletLedgerStatus;
  const effectiveStatus = status === "active" && expiresAt && expiresAt <= now ? "expired" : status;
  return {
    id: doc.id,
    type: String(data.type || "credit") as WalletLedgerType,
    amount: money(data.amount),
    originalAmount: data.originalAmount == null ? undefined : money(data.originalAmount),
    reason: String(data.reason || "admin_adjustment") as WalletLedgerReason,
    orderId: data.orderId ? String(data.orderId) : null,
    earnedAt: iso(data.earnedAt) || null,
    expiresAt: iso(data.expiresAt) || null,
    status,
    effectiveStatus,
    createdAt: iso(data.createdAt) || "",
  };
}

function activeHoldAmount(data: FirebaseFirestore.DocumentData, now: Date) {
  const expiresAt = dateValue(data.expiresAt);
  if (data.status !== "active" || !expiresAt || expiresAt <= now) return 0;
  return money(data.amount);
}

export function clampWalletRedemption(input: { requestedAmount: number; availableBalance: number; orderTotal: number }) {
  if (input.orderTotal <= WALLET_REDEEM_MIN_ORDER_TOTAL) return 0;
  return Math.min(
    money(input.requestedAmount),
    money(input.availableBalance),
    WALLET_REDEEM_MAX_PER_ORDER,
  );
}

export function calculateWalletCashback(finalOrderTotal: number) {
  // Cashback is intentionally based on the final payable order value after
  // wallet redemption and discounts, excluding COD fees. That protects margin
  // and keeps wallet-spend from earning cashback on itself.
  if (finalOrderTotal < WALLET_CASHBACK_MIN_ORDER_TOTAL) return 0;
  return roundRupees(finalOrderTotal * WALLET_CASHBACK_RATE);
}

export async function getWalletSummary(uid: string): Promise<WalletSummary> {
  const db = getFirebaseDb();
  const now = new Date();
  const userRef = db.collection("users").doc(uid);
  const [ledgerSnapshot, holdsSnapshot] = await Promise.all([
    userRef.collection("walletLedger").orderBy("createdAt", "desc").limit(200).get(),
    userRef.collection("walletHolds").where("status", "==", "active").limit(50).get(),
  ]);

  const transactions = ledgerSnapshot.docs.map((doc) => mapLedgerDoc(doc, now));
  const activeCredits = transactions
    .filter((entry) => entry.type === "credit" && entry.effectiveStatus === "active" && entry.amount > 0)
    .sort((left, right) => String(left.expiresAt || "").localeCompare(String(right.expiresAt || "")));
  const balance = Number(activeCredits.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2));
  const heldBalance = Number(holdsSnapshot.docs.reduce((sum, doc) => sum + activeHoldAmount(doc.data(), now), 0).toFixed(2));
  const availableBalance = Number(Math.max(0, balance - heldBalance).toFixed(2));

  // Fire-and-forget snapshot write: previously awaited, so EVERY /account view
  // paid a full Firestore write round-trip before first byte. Balance is always
  // recomputed from the ledger at read-time (lazy expiry), so a slightly stale
  // cached field is harmless — never block TTFB on it.
  userRef.set({ walletBalance: balance, walletAvailableBalance: availableBalance, walletUpdatedAt: now.toISOString() }, { merge: true }).catch(() => {});

  return { balance, availableBalance, heldBalance, activeCredits, transactions };
}

export async function reserveWalletForCheckout(input: { uid: string; requestedAmount: number; orderTotal: number; holdId: string }) {
  const db = getFirebaseDb();
  const userRef = db.collection("users").doc(input.uid);
  const holdRef = userRef.collection("walletHolds").doc(input.holdId);
  const now = new Date();
  let reservedAmount = 0;
  let balance = 0;
  let availableBalance = 0;

  await db.runTransaction(async (tx) => {
    const [creditsSnapshot, holdsSnapshot] = await Promise.all([
      tx.get(userRef.collection("walletLedger").where("status", "==", "active")),
      tx.get(userRef.collection("walletHolds").where("status", "==", "active")),
    ]);
    balance = Number(creditsSnapshot.docs.reduce((sum, doc) => sum + (isActiveCredit(doc.data(), now) ? money(doc.get("amount")) : 0), 0).toFixed(2));
    const heldBalance = Number(holdsSnapshot.docs.reduce((sum, doc) => sum + activeHoldAmount(doc.data(), now), 0).toFixed(2));
    availableBalance = Number(Math.max(0, balance - heldBalance).toFixed(2));
    reservedAmount = clampWalletRedemption({
      requestedAmount: input.requestedAmount,
      availableBalance,
      orderTotal: input.orderTotal,
    });

    if (reservedAmount > 0) {
      tx.set(holdRef, {
        amount: reservedAmount,
        status: "active",
        createdAt: now,
        updatedAt: now,
        expiresAt: addMinutes(now, WALLET_HOLD_MINUTES),
      });
      availableBalance = Number(Math.max(0, availableBalance - reservedAmount).toFixed(2));
    }
    tx.set(userRef, { walletBalance: balance, walletAvailableBalance: availableBalance, walletUpdatedAt: now.toISOString() }, { merge: true });
  });

  return { walletAmountApplied: reservedAmount, walletBalance: balance, walletAvailableBalance: availableBalance, walletHoldId: reservedAmount > 0 ? input.holdId : null };
}

export async function releaseWalletHold(input: { uid: string; holdId: string }) {
  const db = getFirebaseDb();
  const holdRef = db.collection("users").doc(input.uid).collection("walletHolds").doc(input.holdId);
  await holdRef.set({ status: "released", releasedAt: new Date(), updatedAt: new Date() }, { merge: true });
}

export async function consumeWalletHoldForOrder(tx: Transaction, input: { uid: string; holdId?: string | null; amount: number; orderId: string }) {
  const amount = money(input.amount);
  if (!input.uid || !input.holdId || amount <= 0) return 0;

  const db = getFirebaseDb();
  const now = new Date();
  const userRef = db.collection("users").doc(input.uid);
  const holdRef = userRef.collection("walletHolds").doc(input.holdId);
  const holdSnap = await tx.get(holdRef);
  if (!holdSnap.exists || holdSnap.get("status") !== "active" || money(holdSnap.get("amount")) < amount) {
    throw new Error("Wallet reservation expired. Please retry checkout so your wallet balance can be recalculated.");
  }

  const creditsSnapshot = await tx.get(userRef.collection("walletLedger").where("status", "==", "active"));
  const credits = creditsSnapshot.docs
    .filter((doc) => isActiveCredit(doc.data(), now))
    .sort((left, right) => {
      const leftExpiry = dateValue(left.get("expiresAt"))?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightExpiry = dateValue(right.get("expiresAt"))?.getTime() || Number.MAX_SAFE_INTEGER;
      return leftExpiry - rightExpiry;
    });

  const balance = credits.reduce((sum, doc) => sum + money(doc.get("amount")), 0);
  if (balance + 0.001 < amount) {
    throw new Error("Wallet balance changed before payment confirmation. Please contact support.");
  }

  let remaining = amount;
  for (const credit of credits) {
    if (remaining <= 0) break;
    const currentAmount = money(credit.get("amount"));
    const used = Math.min(currentAmount, remaining);
    const nextAmount = Number(Math.max(0, currentAmount - used).toFixed(2));
    tx.update(credit.ref, {
      amount: nextAmount,
      status: nextAmount > 0 ? "active" : "used",
      usedAt: nextAmount > 0 ? null : now,
      updatedAt: now,
    });
    remaining = Number(Math.max(0, remaining - used).toFixed(2));
  }

  tx.set(userRef.collection("walletLedger").doc(), {
    type: "debit",
    amount,
    reason: "order_redemption",
    orderId: input.orderId,
    earnedAt: null,
    expiresAt: null,
    status: "used",
    createdAt: now,
  });
  tx.set(holdRef, { status: "consumed", consumedAt: now, orderId: input.orderId, updatedAt: now }, { merge: true });

  const nextBalance = Number(Math.max(0, balance - amount).toFixed(2));
  tx.set(userRef, { walletBalance: nextBalance, walletAvailableBalance: nextBalance, walletUpdatedAt: now.toISOString() }, { merge: true });
  return amount;
}

export function creditWalletCashback(tx: Transaction, input: { uid?: string | null; orderId: string; orderTotal: number }) {
  if (!input.uid) return 0;
  const amount = calculateWalletCashback(input.orderTotal);
  if (amount <= 0) return 0;
  const db = getFirebaseDb();
  const now = new Date();
  const userRef = db.collection("users").doc(input.uid);
  tx.set(userRef.collection("walletLedger").doc(), {
    type: "credit",
    amount,
    originalAmount: amount,
    reason: "order_cashback",
    orderId: input.orderId,
    earnedAt: now,
    expiresAt: addDays(now, WALLET_CREDIT_EXPIRY_DAYS),
    status: "active",
    createdAt: now,
  });
  return amount;
}

export async function applyWalletOrderCancellationPolicy(orderId: string) {
  const db = getFirebaseDb();
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error("Order not found.");
    const order = orderSnap.data() || {};
    const uid = String(order.userId || "").trim();
    if (!uid) return;

    const now = new Date();
    const userRef = db.collection("users").doc(uid);
    const walletUsed = money(order.walletAmountUsed);
    if (walletUsed > 0 && !order.walletRefunded) {
      tx.set(userRef.collection("walletLedger").doc(), {
        type: "credit",
        amount: walletUsed,
        originalAmount: walletUsed,
        reason: "refund_credit",
        orderId,
        earnedAt: now,
        expiresAt: addDays(now, WALLET_CREDIT_EXPIRY_DAYS),
        status: "active",
        createdAt: now,
      });
      tx.set(orderRef, { walletRefunded: true, walletRefundedAt: now.toISOString() }, { merge: true });
    }

    const cashbackEarned = money(order.walletCashbackEarned);
    if (cashbackEarned > 0 && !order.walletCashbackReversed) {
      const creditsSnapshot = await tx.get(userRef.collection("walletLedger").where("status", "==", "active"));
      const cashbackCredits = creditsSnapshot.docs.filter((doc) => {
        const data = doc.data();
        return data.reason === "order_cashback" && data.orderId === orderId && isActiveCredit(data, now);
      });
      const reversible = Number(cashbackCredits.reduce((sum, doc) => sum + money(doc.get("amount")), 0).toFixed(2));
      for (const credit of cashbackCredits) {
        tx.update(credit.ref, { amount: 0, status: "used", reversedAt: now, updatedAt: now });
      }
      if (reversible > 0) {
        tx.set(userRef.collection("walletLedger").doc(), {
          type: "debit",
          amount: reversible,
          reason: "order_cashback_reversal",
          orderId,
          earnedAt: null,
          expiresAt: null,
          status: "used",
          createdAt: now,
        });
      }
      tx.set(orderRef, { walletCashbackReversed: true, walletCashbackReversedAmount: reversible, walletCashbackReversedAt: now.toISOString() }, { merge: true });
    }
  });

  const order = await orderRef.get();
  const uid = String(order.get("userId") || "").trim();
  if (uid) await getWalletSummary(uid);
}
