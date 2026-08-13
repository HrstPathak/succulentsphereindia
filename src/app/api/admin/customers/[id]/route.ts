import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

const text = (value: unknown, fallback = "") => typeof value === "string" ? value.trim() : value == null ? fallback : String(value).trim();
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const db = getFirebaseDb();
    const user = await db.collection("users").doc(text(id)).get();
    if (!user.exists) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    const data = user.data() || {};
    const [addresses, ordersByUid, ordersByEmail, reviews] = await Promise.all([
      user.ref.collection("addresses").get(),
      db.collection("orders").where("userId", "==", user.id).get(),
      text(data.email) ? db.collection("orders").where("emailLower", "==", text(data.email).toLowerCase()).get() : Promise.resolve(null),
      db.collection("reviews").where("userId", "==", user.id).get(),
    ]);
    const orders = [...ordersByUid.docs, ...(ordersByEmail?.docs || [])]
      .filter((order, index, all) => all.findIndex((candidate) => candidate.id === order.id) === index)
      .map((order) => {
        const value = order.data(); const customer = (value.customer || {}) as Record<string, unknown>;
        return { id: order.id, orderNumber: number(value.orderNumber), customerName: text(customer.fullName, text(value.customerName, "Customer")), email: text(value.emailLower, text(customer.email)), createdAt: text(value.createdAt || value.processedAt), total: number(value.total), financialStatus: text(value.financialStatus, "PENDING"), fulfillmentStatus: text(value.fulfillmentStatus, "UNFULFILLED"), emailStatus: text(value.emailStatus, "pending"), itemCount: Array.isArray(value.lineItems) ? value.lineItems.length : 0, paymentMode: text(value.paymentMode), tracking: Array.isArray(value.tracking) ? value.tracking : [], shippingAddress: customer };
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({
      customer: { id: user.id, name: text(data.displayName, `${text(data.firstName)} ${text(data.lastName)}`.trim()), firstName: text(data.firstName), lastName: text(data.lastName), displayName: text(data.displayName), email: text(data.email), phone: text(data.phone), createdAt: text(data.createdAt), updatedAt: text(data.updatedAt), wishlistProductIds: Array.isArray(data.wishlistProductIds) ? data.wishlistProductIds.map(String) : [], defaultAddressId: text(data.defaultAddressId) },
      addresses: addresses.docs.map((address) => ({ id: address.id, ...address.data() })), orders,
      reviews: reviews.docs.map((review) => ({ id: review.id, productId: text(review.get("productId")), authorName: text(review.get("authorName"), "Customer"), title: text(review.get("title")), content: text(review.get("content")), rating: number(review.get("rating")), status: text(review.get("status"), "published"), createdAt: text(review.get("createdAt")), verifiedPurchase: Boolean(review.get("verifiedPurchase")) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  } catch (error) {
    return NextResponse.json({ error: text((error as Error).message, "Unable to load customer.") }, { status: text((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500 });
  }
}
