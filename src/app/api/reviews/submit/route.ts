import { NextResponse } from "next/server";
import { clearAuthCookies, getAuthenticatedCustomer } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getReviewStats, type ProductReview } from "@/lib/reviews";
async function responseForProduct(productId: string, review: ProductReview) { const reviews = (await getFirebaseDb().collection("reviews").where("productId", "==", productId).where("status", "==", "published").get()).docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductReview)); const stats = getReviewStats(reviews); return NextResponse.json({ ok: true, review, reviews, reviewCount: stats.reviewCount, rating: stats.averageRating }); }
export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedCustomer();
    if (!session.uid || !session.customer) {
      const response = NextResponse.json({ error: "Please login to submit a review." }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }

    const body = await request.json();
    const productId = String(body.productId || "").trim();
    const content = String(body.content || "").trim().slice(0, 2000);
    const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating || 0))));
    if (!productId || !content || !rating) return NextResponse.json({ error: "Product, rating, and review text are required." }, { status: 400 });

    const orderId = String(body.orderId || "").trim();
    if (orderId) {
      const order = await getFirebaseDb().collection("orders").doc(orderId).get();
      if (!order.exists || order.get("userId") !== session.uid || String(order.get("fulfillmentStatus") || "").toUpperCase() !== "DELIVERED") {
        return NextResponse.json({ error: "Only delivered purchases can be reviewed." }, { status: 403 });
      }
    }

    const review: ProductReview & { productId: string; userId: string; status: string } = {
      id: "",
      productId,
      userId: session.uid,
      status: "published",
      rating,
      title: String(body.title || "").trim().slice(0, 120),
      content,
      authorName: session.customer.displayName || session.customer.firstName || "Customer",
      authorEmail: session.customer.email,
      createdAt: new Date().toISOString(),
      verifiedPurchase: Boolean(orderId),
      ...(body.orderNumber ? { orderNumber: String(body.orderNumber) } : {}),
    };
    const ref = await getFirebaseDb().collection("reviews").add({ ...review, orderId: orderId || null });
    review.id = ref.id;
    await ref.update({ id: ref.id });
    return responseForProduct(productId, review);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Unable to submit review." }, { status: 500 });
  }
}
