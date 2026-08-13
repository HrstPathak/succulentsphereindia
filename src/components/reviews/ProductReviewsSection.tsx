"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import type { ProductReview } from "@/lib/reviews";

type Props = {
  productId: string;
  productHandle: string;
  initialReviews?: ProductReview[];
  initialReviewCount?: number;
  initialRating?: number;
};

function formatReviewDate(value: string): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Recently";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function Stars({ rating }: { rating: number }) {
  const safe = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-1 text-yellow-500" aria-label={`${safe} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < safe ? "text-yellow-500" : "text-gray-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ProductReviewsSection({
  productId,
  productHandle,
  initialReviews = [],
  initialReviewCount = 0,
  initialRating = 0,
}: Props) {
  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
  const [reviewCount, setReviewCount] = useState(initialReviewCount || initialReviews.length);
  const [rating, setRating] = useState(initialRating);
  const [popupOpen, setPopupOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [viewerEmail, setViewerEmail] = useState("");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductReview | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: "", content: "", name: "", email: "" });

  const hasReviews = reviewCount > 0;
  const heading = hasReviews ? `${reviewCount} ${reviewCount === 1 ? "Review" : "Reviews"}` : "Reviews";
  const summaryText = useMemo(() => {
    if (!hasReviews) return "Be the first to review this product.";
    return `${rating.toFixed(1)} average from ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`;
  }, [hasReviews, rating, reviewCount]);
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/customer", { method: "GET", credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json();
        const email = String(json?.customer?.email || "").trim().toLowerCase();
        if (!cancelled && email) {
          setViewerEmail(email);
          setForm((prev) => ({
            ...prev,
            name:
              [json?.customer?.firstName, json?.customer?.lastName].filter(Boolean).join(" ").trim() ||
              String(json?.customer?.displayName || ""),
            email,
          }));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.content.trim()) {
      showErrorToast("Please write your review.");
      return;
    }
    setSubmitting(true);
    try {
      const isEditing = Boolean(editingReviewId);
      const response = await fetch(isEditing ? "/api/reviews/edit" : "/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          productHandle,
          reviewId: editingReviewId || undefined,
          rating: form.rating,
          title: form.title,
          content: form.content,
          name: viewerEmail ? undefined : form.name,
          email: viewerEmail ? undefined : form.email,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to submit review."));
        return;
      }
      const nextReviews = Array.isArray(json?.reviews) ? (json.reviews as ProductReview[]) : reviews;
      setReviews(nextReviews);
      setReviewCount(Number(json?.reviewCount || nextReviews.length || 0));
      setRating(Number(json?.rating || rating || 0));
      setForm((prev) => ({ ...prev, rating: 5, title: "", content: "", ...(viewerEmail ? {} : { name: "", email: "" }) }));
      setEditingReviewId(null);
      setPopupOpen(false);
      showSuccessToast(isEditing ? "Review updated." : "Review submitted.");
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--auth-border)] bg-white/85 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-[var(--color-text)]">{heading}</h3>
          <p className="text-sm text-[var(--auth-muted)]">{summaryText}</p>
        </div>
        <button
          type="button"
          onClick={() => setPopupOpen(true)}
          className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-white"
        >
          Write a Review
        </button>
      </div>

      {hasReviews && (
        <div className="mt-3 space-y-2.5">
          {visibleReviews.map((review) => (
            <article
              key={review.id}
              className="rounded-lg border border-[#e4ddd2] bg-[linear-gradient(155deg,#ffffff_0%,#fbf8f4_100%)] px-3 py-2.5 shadow-[0_10px_24px_-22px_rgba(26,44,35,0.7)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Stars rating={review.rating} />
                  {review.verifiedPurchase ? (
                    <span className="rounded-full bg-[var(--color-secondary)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand)]">
                      Verified
                    </span>
                  ) : null}
                </div>
                <p className="rounded-full bg-[#f3ede3] px-2 py-0.5 text-[10px] font-medium text-[#5f6d62]">{formatReviewDate(review.createdAt)}</p>
              </div>
              {review.title ? <p className="mt-1.5 text-[15px] font-semibold leading-tight text-[var(--color-text)]">{review.title}</p> : null}
              <p className="mt-1 text-[13px] leading-snug text-[#59665b]">{review.content}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-[0.01em] text-[#22362c]">By {review.authorName}</p>
                {viewerEmail && String(review.authorEmail || "").trim().toLowerCase() === viewerEmail ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-[var(--color-brand)]"
                      onClick={() => {
                        setEditingReviewId(review.id);
                        setForm({
                          rating: review.rating,
                          title: review.title || "",
                          content: review.content || "",
                          name: form.name,
                          email: form.email,
                        });
                        setPopupOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-[#8a3a32]"
                      onClick={() => setDeleteTarget(review)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          {reviewCount > 1 ? (
            <button
              type="button"
              onClick={() => setShowAllReviews((prev) => !prev)}
              className="text-xs font-semibold text-[var(--color-brand)] underline underline-offset-2"
            >
              {showAllReviews ? "Show less" : "All Reviews"}
            </button>
          ) : null}
        </div>
      )}

      {popupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--auth-muted)]">Reviewing</p>
                <h4 className="text-3xl font-serif text-[var(--color-text)]">{editingReviewId ? "Edit Review" : "Write a Review"}</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (submitting) return;
                  setPopupOpen(false);
                  setEditingReviewId(null);
                  setForm((prev) => ({ ...prev, rating: 5, title: "", content: "", ...(viewerEmail ? {} : { name: "", email: "" }) }));
                }}
                className="text-2xl text-gray-500"
              >
                ×
              </button>
            </div>
            <form onSubmit={submitReview} className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Your Rating</label>
                <div className="flex gap-2 text-3xl">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const value = index + 1;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, rating: value }))}
                        className={value <= form.rating ? "text-yellow-500" : "text-gray-300"}
                        aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Review Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  maxLength={120}
                  className="w-full rounded-lg border border-[var(--auth-border)] px-3 py-2 text-sm"
                  placeholder="Sum it up in a few words..."
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Your Review</label>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  maxLength={2000}
                  rows={6}
                  className="w-full rounded-lg border border-[var(--auth-border)] px-3 py-2 text-sm"
                  placeholder="What did you love about it?"
                  required
                />
                <p className="mt-1 text-right text-xs text-[var(--auth-muted)]">{form.content.length}/2000</p>
              </div>
              {!viewerEmail && !editingReviewId ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      maxLength={80}
                      className="w-full rounded-lg border border-[var(--auth-border)] px-3 py-2 text-sm"
                      placeholder="Priya S."
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Email *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="w-full rounded-lg border border-[var(--auth-border)] px-3 py-2 text-sm"
                      placeholder="you@email.com"
                      required
                    />
                  </div>
                  <p className="sm:col-span-2 text-xs text-[var(--auth-muted)]">Your email won&apos;t be published.</p>
                </div>
              ) : null}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setPopupOpen(false)}
                  className="rounded-lg border border-[var(--auth-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-white"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editingReviewId ? "Save Review" : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-[#e4ddd2] bg-white p-4 shadow-2xl">
            <h5 className="text-base font-semibold text-[var(--color-text)]">Delete review?</h5>
            <p className="mt-1 text-sm text-[var(--auth-muted)]">
              This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
                className="rounded-lg border border-[var(--auth-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text)]"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const response = await fetch("/api/reviews/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        productId,
                        productHandle,
                        reviewId: deleteTarget.id,
                      }),
                    });
                    const json = await response.json();
                    if (!response.ok) {
                      showErrorToast(String(json?.error || "Unable to delete review."));
                      return;
                    }
                    const nextReviews = Array.isArray(json?.reviews) ? (json.reviews as ProductReview[]) : [];
                    setReviews(nextReviews);
                    setReviewCount(Number(json?.reviewCount || nextReviews.length || 0));
                    setRating(Number(json?.rating || 0));
                    setDeleteTarget(null);
                    showSuccessToast("Review deleted.");
                  } catch (error) {
                    showErrorToast((error as Error).message || "Unable to delete review.");
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="rounded-lg bg-[#8a3a32] px-3 py-1.5 text-sm font-semibold text-white"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
