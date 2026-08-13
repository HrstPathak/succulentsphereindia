import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

const string = (value: unknown, fallback = "") => typeof value === "string" ? value : value == null ? fallback : String(value);
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export async function GET() {
  try {
    await requireAdmin();
    const db = getFirebaseDb();
    const [productsSnapshot, ordersSnapshot, usersSnapshot, reviewsSnapshot] = await Promise.all([
      db.collection("products").limit(1000).get(),
      db.collection("orders").orderBy("createdAt", "desc").limit(250).get(),
      db.collection("users").orderBy("createdAt", "desc").limit(250).get(),
      db.collection("reviews").orderBy("createdAt", "desc").limit(250).get(),
    ]);

    const products = productsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, title: string(data.title, "Untitled"), handle: string(data.handle), price: number(data.price), inventoryQuantity: number(data.inventoryQuantity), available: data.available !== false, status: string(data.status, "active"), image: string(data.image), tags: Array.isArray(data.tags) ? data.tags.map(String) : [], updatedAt: string(data.updatedAt) };
    });
    const orders = ordersSnapshot.docs.map((doc) => {
      const data = doc.data(); const customer = data.customer || {};
      return { id: doc.id, orderNumber: number(data.orderNumber), customerName: string(customer.fullName, string(data.customerName, "Customer")), email: string(data.emailLower, string(customer.email)), total: number(data.total), paymentMode: string(data.paymentMode), financialStatus: string(data.financialStatus, "PENDING"), fulfillmentStatus: string(data.fulfillmentStatus, "UNFULFILLED"), createdAt: string(data.createdAt || data.processedAt), emailStatus: string(data.emailStatus, "pending"), itemCount: Array.isArray(data.lineItems) ? data.lineItems.length : 0, tracking: Array.isArray(data.tracking) ? data.tracking : [] };
    });
    const customers = usersSnapshot.docs.map((doc) => { const data = doc.data(); return { id: doc.id, email: string(data.email), name: string(data.displayName, `${string(data.firstName)} ${string(data.lastName)}`.trim()), phone: string(data.phone), createdAt: string(data.createdAt), wishlistCount: Array.isArray(data.wishlistProductIds) ? data.wishlistProductIds.length : 0 }; });
    const reviews = reviewsSnapshot.docs.map((doc) => { const data = doc.data(); return { id: doc.id, productId: string(data.productId), authorName: string(data.authorName, "Customer"), title: string(data.title), content: string(data.content), rating: number(data.rating), status: string(data.status, "published"), createdAt: string(data.createdAt), verifiedPurchase: Boolean(data.verifiedPurchase) }; });
    const revenue = orders.filter((order) => order.financialStatus === "PAID").reduce((total, order) => total + order.total, 0);
    return NextResponse.json({
      summary: { products: products.length, lowStock: products.filter((item) => item.inventoryQuantity > 0 && item.inventoryQuantity <= 10).length, outOfStock: products.filter((item) => item.inventoryQuantity <= 0 || !item.available).length, orders: orders.length, paidRevenue: revenue, customers: customers.length, reviews: reviews.length },
      products, orders, customers, reviews,
    });
  } catch (error) {
    return NextResponse.json({ error: "Not found." }, { status: String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500 });
  }
}
