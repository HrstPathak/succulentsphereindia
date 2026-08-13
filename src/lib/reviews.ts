export type ProductReview = {
  id: string;
  rating: number;
  title: string;
  content: string;
  authorName: string;
  authorEmail?: string;
  createdAt: string;
  verifiedPurchase?: boolean;
  orderNumber?: string;
};

function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function parseProductReviews(value: unknown): ProductReview[] {
  const raw = String(value || "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return (parsed
      .map((item): ProductReview | null => {
        if (!item || typeof item !== "object") return null;
        const node = item as Record<string, unknown>;
        const content = String(node.content || "").trim();
        const title = String(node.title || "").trim();
        const authorName = String(node.authorName || "Customer").trim();
        const createdAt = String(node.createdAt || "").trim();
        const rating = clampRating(Number(node.rating || 0));
        if (!content || !createdAt || rating < 1) return null;

        return {
          id: String(node.id || `${createdAt}-${authorName}`),
          rating,
          title,
          content,
          authorName,
          authorEmail: String(node.authorEmail || "").trim() || undefined,
          createdAt,
          verifiedPurchase: Boolean(node.verifiedPurchase),
          orderNumber: String(node.orderNumber || "").trim() || undefined,
        };
      })
      .filter(Boolean) as ProductReview[])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export function serializeProductReviews(reviews: ProductReview[]): string {
  return JSON.stringify(reviews);
}

export function getReviewStats(reviews: ProductReview[]): { reviewCount: number; averageRating: number } {
  const reviewCount = reviews.length;
  if (reviewCount === 0) return { reviewCount: 0, averageRating: 0 };
  const total = reviews.reduce((sum, review) => sum + clampRating(review.rating), 0);
  return {
    reviewCount,
    averageRating: Number((total / reviewCount).toFixed(1)),
  };
}
