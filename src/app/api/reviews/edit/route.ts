import { NextResponse } from "next/server";
import { clearAuthCookies, getAuthenticatedCustomer } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getReviewStats, type ProductReview } from "@/lib/reviews";

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedCustomer();
    if (!session.uid) {
      const response = NextResponse.json({ error: "Please login to edit your review." }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }

    const { reviewId, productId, title, content, rating } = await request.json();
    const ref = getFirebaseDb().collection("reviews").doc(String(reviewId || ""));
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.get("userId") !== session.uid) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    const next = {
      title: String(title || "").trim().slice(0, 120),
      content: String(content || "").trim().slice(0, 2000),
      rating: Math.max(1, Math.min(5, Math.round(Number(rating || 0)))),
      updatedAt: new Date().toISOString(),
    };
    if (!next.content || !next.rating) {
      return NextResponse.json({ error: "Rating and review text are required." }, { status: 400 });
    }

    await ref.update(next);
    const prior = snapshot.data() || {};
    const review: ProductReview = {
      id: ref.id,
      title: next.title,
      content: next.content,
      rating: next.rating,
      authorName: String(prior.authorName || "Customer"),
      authorEmail: String(prior.authorEmail || "") || undefined,
      createdAt: String(prior.createdAt || next.updatedAt),
      verifiedPurchase: Boolean(prior.verifiedPurchase),
      orderNumber: String(prior.orderNumber || "") || undefined,
    };
    const reviews = (await getFirebaseDb().collection("reviews").where("productId", "==", String(productId || snapshot.get("productId"))).where("status", "==", "published").get()).docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductReview));
    const stats = getReviewStats(reviews);
    return NextResponse.json({ ok: true, review, reviews, reviewCount: stats.reviewCount, rating: stats.averageRating });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Unable to edit review." }, { status: 500 });
  }
}
