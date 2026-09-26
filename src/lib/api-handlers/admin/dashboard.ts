import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidateAdminScopes, cachedAdminScope } from "@/lib/admin-cache";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getOrderGrandTotal } from "@/lib/orderAmounts";
import {
  readAdminSummary,
  recomputeAdminSummary,
  type AdminStatsRecord,
} from "@/lib/admin-stats";

const string = (value: unknown, fallback = "") => typeof value === "string" ? value : value == null ? fallback : String(value);
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const fail = (error: unknown) =>
  NextResponse.json(
    { error: String((error as Error).message) === "ADMIN_REQUIRED" ? "Not found." : (error as Error).message },
    { status: String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500 },
  );

const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

function mapProductRow(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return { id: doc.id, title: string(data.title, "Untitled"), handle: string(data.handle), price: number(data.price), inventoryQuantity: number(data.inventoryQuantity), available: data.available !== false, status: string(data.status, "active"), image: string(data.image), tags: list(data.tags), updatedAt: string(data.updatedAt) };
}
function mapOrderRow(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data(); const customer = data.customer || {};
  return { id: doc.id, orderNumber: number(data.orderNumber), customerName: string(customer.fullName, string(data.customerName, "Customer")), email: string(data.emailLower, string(customer.email)), total: getOrderGrandTotal(data), paymentMode: string(data.paymentMode), financialStatus: string(data.financialStatus, "PENDING"), fulfillmentStatus: string(data.fulfillmentStatus, "UNFULFILLED"), createdAt: string(data.createdAt || data.processedAt), emailStatus: string(data.emailStatus, "pending"), itemCount: Array.isArray(data.lineItems) ? data.lineItems.length : 0, tracking: Array.isArray(data.tracking) ? data.tracking : [] };
}
function mapCustomerRow(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return { id: doc.id, email: string(data.email), name: string(data.displayName, `${string(data.firstName)} ${string(data.lastName)}`.trim()), phone: string(data.phone), createdAt: string(data.createdAt), wishlistCount: Array.isArray(data.wishlistProductIds) ? data.wishlistProductIds.length : 0 };
}
function mapReviewRow(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return { id: doc.id, productId: string(data.productId), authorName: string(data.authorName, "Customer"), title: string(data.title), content: string(data.content), rating: number(data.rating), status: string(data.status, "published"), createdAt: string(data.createdAt), verifiedPurchase: Boolean(data.verifiedPurchase) };
}

/**
 * GET /api/admin/dashboard?scope=...
 *
 * This used to unconditionally read 1000 products + 250 orders + 250 users +
 * 250 reviews (~1750 reads) and ship every row to the browser, no matter which
 * tab the operator had open. The tabs are independent, so each is now fetched
 * on demand, and the Command Center counters come from a single stored
 * document rather than a live count.
 *
 * Scopes: summary | products | orders | customers | reviews
 */
export async function handleAdminDashboard(request: Request) {
  try {
    await requireAdmin();
    const scope = new URL(request.url).searchParams.get("scope") || "summary";
    const db = getFirebaseDb();

    if (scope === "summary") {
      // One document read. If nothing has ever been computed, build the
      // baseline once so the tab has real numbers instead of zeros.
      const stored = await readAdminSummary();
      return NextResponse.json(stored ?? (await recomputeAdminSummary()));
    }

    if (scope === "products") {
      const payload = await cachedAdminScope("products", async () => {
        const snapshot = await db.collection("products").limit(1000).get();
        return { products: snapshot.docs.map(mapProductRow) };
      });
      return NextResponse.json(payload);
    }
    if (scope === "orders") {
      const payload = await cachedAdminScope("orders", async () => {
        const snapshot = await db.collection("orders").orderBy("createdAt", "desc").limit(250).get();
        return { orders: snapshot.docs.map(mapOrderRow) };
      });
      return NextResponse.json(payload);
    }
    if (scope === "customers") {
      const payload = await cachedAdminScope("customers", async () => {
        const snapshot = await db.collection("users").orderBy("createdAt", "desc").limit(250).get();
        return { customers: snapshot.docs.map(mapCustomerRow) };
      });
      return NextResponse.json(payload);
    }
    if (scope === "reviews") {
      const payload = await cachedAdminScope("reviews", async () => {
        const snapshot = await db.collection("reviews").orderBy("createdAt", "desc").limit(250).get();
        return { reviews: snapshot.docs.map(mapReviewRow) };
      });
      return NextResponse.json(payload);
    }

    return NextResponse.json({ error: "Unknown scope." }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/admin/dashboard — recount every counter and persist the result.
 *
 * Deliberately not automatic. These totals are a cache, and a cache that
 * silently refreshes itself is just the expensive query wearing a hat.
 *
 * The recount also derives low-stock/out-of-stock counts FROM the product
 * documents, so the cached Products tab payload is now describing stale rows.
 * Drop it here as well, or the freshly counted numbers would disagree with the
 * list rendered next to them.
 */
export async function handleAdminDashboardRecount() {
  try {
    await requireAdmin();
    const record: AdminStatsRecord = await recomputeAdminSummary();
    invalidateAdminScopes("products");
    return NextResponse.json(record);
  } catch (error) {
    return fail(error);
  }
}