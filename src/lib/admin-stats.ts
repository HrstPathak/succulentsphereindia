import "server-only";

import { getFirebaseDb } from "@/lib/firebase-admin";
import { getOrderGrandTotal } from "@/lib/orderAmounts";

/**
 * The admin Command Center shows six counters (products, low stock, out of
 * stock, orders, paid revenue, customers, reviews).
 *
 * Deriving them from live data meant every dashboard open read
 * 1000 products + 250 orders + 250 users + 250 reviews = ~1750 Firestore
 * reads, even when the operator only ever looked at the counters and never
 * opened the tab that needed the rows.
 *
 * These totals move slowly — they change when an admin edits something, not
 * when a customer browses — so they are persisted to one document. Reading the
 * overview becomes a single document read, and the expensive recount happens
 * only when someone explicitly asks for it.
 */

const STATS_COLLECTION = "adminStats";
const STATS_DOC_ID = "overview";

/** Upper bound for the scan fallbacks. Matches the old product page cap. */
const SCAN_LIMIT = 1000;

export type AdminSummary = {
  products: number;
  lowStock: number;
  outOfStock: number;
  orders: number;
  paidRevenue: number;
  customers: number;
  reviews: number;
};

export type AdminStatsRecord = {
  summary: AdminSummary;
  computedAt: string;
};

const emptySummary: AdminSummary = {
  products: 0,
  lowStock: 0,
  outOfStock: 0,
  orders: 0,
  paidRevenue: 0,
  customers: 0,
  reviews: 0,
};

const count = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const money = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Number(parsed.toFixed(2))) : 0;
};

const toIso = (value: unknown) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: () => Date })?.toDate === "function")
    return (value as { toDate: () => Date }).toDate().toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

function normaliseSummary(raw: Record<string, unknown>): AdminSummary {
  return {
    products: count(raw.products),
    lowStock: count(raw.lowStock),
    outOfStock: count(raw.outOfStock),
    orders: count(raw.orders),
    paidRevenue: money(raw.paidRevenue),
    customers: count(raw.customers),
    reviews: count(raw.reviews),
  };
}


/**
 * Counts documents in a collection, ideally for the price of a single read.
 *
 * An aggregation query (`count()`) bills as one read regardless of how many
 * documents match, but a filtered or compound count only works if the implied
 * composite index exists. Those throw when the index is missing, so every
 * count is attempted and falls back to a bounded document scan: the recount
 * button must never be the thing that takes the dashboard down.
 */
async function countWhere(
  collectionName: string,
  options: {
    query?: (
      collection: FirebaseFirestore.CollectionReference,
    ) => FirebaseFirestore.Query;
    matches?: (data: FirebaseFirestore.DocumentData) => boolean;
  } = {},
): Promise<number> {
  const base = getFirebaseDb().collection(collectionName);

  try {
    const aggregate = options.query
      ? await options.query(base).count().get()
      : await base.count().get();
    return count(aggregate.data().count);
  } catch {
    // Missing composite index, or the field is not indexed. Scan instead.
  }

  const snapshot = await base.limit(SCAN_LIMIT).get();
  if (!options.matches) return snapshot.size;
  return snapshot.docs.filter((doc) => options.matches!(doc.data())).length;
}

const stockOf = (data: FirebaseFirestore.DocumentData) => {
  const raw = Number(data.inventoryQuantity);
  return Number.isFinite(raw) ? raw : 0;
};

/**
 * Paid revenue sums `getOrderGrandTotal`, which derives an amount from several
 * fields, so it cannot be expressed as an aggregation — the PAID order
 * documents have to be read. This is scoped to a single-field equality query
 * (no composite index required) and only ever runs when someone presses the
 * recount button.
 */
async function computePaidRevenue(): Promise<number> {
  const snapshot = await getFirebaseDb()
    .collection("orders")
    .where("financialStatus", "==", "PAID")
    .limit(SCAN_LIMIT)
    .get();

  return snapshot.docs.reduce(
    (total, doc) => total + money(getOrderGrandTotal(doc.data() || {})),
    0,
  );
}

/** Recomputes every counter from live data and persists the result. */
export async function recomputeAdminSummary(): Promise<AdminStatsRecord> {
  const [
    products,
    lowStock,
    outOfStock,
    orders,
    customers,
    reviews,
    paidRevenue,
  ] = await Promise.all([
    countWhere("products"),
    // Range on a single field is served by the automatic index; the scan
    // fallback covers the case where inventoryQuantity was never indexed.
    countWhere("products", {
      query: (collection) =>
        collection
          .where("inventoryQuantity", ">", 0)
          .where("inventoryQuantity", "<=", 10),
      matches: (data) => stockOf(data) > 0 && stockOf(data) <= 10,
    }),
    // "Out of stock" is `inventory <= 0 OR available === false`. That is a
    // disjunction, which no single Firestore query can express, so it is a
    // scanned predicate rather than an aggregation.
    countWhere("products", {
      matches: (data) => stockOf(data) <= 0 || data.available === false,
    }),
    countWhere("orders"),
    countWhere("users"),
    countWhere("reviews"),
    computePaidRevenue(),
  ]);

  return writeAdminSummary({
    products,
    lowStock,
    outOfStock,
    orders,
    customers,
    reviews,
    paidRevenue,
  });
}

export async function writeAdminSummary(
  summary: AdminSummary,
): Promise<AdminStatsRecord> {
  const record: AdminStatsRecord = {
    summary: { ...emptySummary, ...summary },
    computedAt: new Date().toISOString(),
  };

  await getFirebaseDb()
    .collection(STATS_COLLECTION)
    .doc(STATS_DOC_ID)
    .set(record, { merge: true });

  return record;
}

/** Single-document read. Returns null when nothing has been computed yet. */
export async function readAdminSummary(): Promise<AdminStatsRecord | null> {
  const doc = await getFirebaseDb()
    .collection(STATS_COLLECTION)
    .doc(STATS_DOC_ID)
    .get();

  if (!doc.exists) return null;

  const data = doc.data() || {};
  return {
    summary: normaliseSummary(
      (data.summary as Record<string, unknown>) || data,
    ),
    computedAt: toIso(data.computedAt) || toIso(data.updatedAt),
  };
}
