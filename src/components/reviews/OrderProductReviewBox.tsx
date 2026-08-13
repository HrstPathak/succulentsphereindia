"use client";

import { FormEvent, useState } from "react";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type Props = {
  productHandle: string;
  productTitle: string;
  orderNumber: string;
  canReview: boolean;
  inline?: boolean;
  hideNotice?: boolean;
};

export default function OrderProductReviewBox({
  productHandle,
  productTitle,
  orderNumber,
  canReview,
  inline = false,
  hideNotice = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: "", content: "" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.content.trim()) return showErrorToast("Please write your review.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productHandle,
          orderNumber,
          rating: form.rating,
          title: form.title,
          content: form.content,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to submit review."));
        return;
      }
      showSuccessToast("Review submitted.");
      setForm({ rating: 5, title: "", content: "" });
      setOpen(false);
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!productHandle) return null;

  return (
    <>
      <div className={inline ? "flex flex-wrap items-center gap-2" : "mt-3"}>
        <button
          type="button"
          onClick={() => canReview && setOpen(true)}
          disabled={!canReview}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            canReview
              ? "border border-[#d2c6b6] bg-white/85 text-[#31463a] hover:bg-white"
              : "cursor-not-allowed border border-[#e4dbcd] bg-[#f6f2eb] text-[#8b8d88]"
          }`}
        >
          Write a Review
        </button>
        {!canReview && !hideNotice ? (
          <span className={`text-[11px] text-[#6b766a] ${inline ? "whitespace-nowrap" : "mt-1 block"}`}>
            Review is available after this order is delivered.
          </span>
        ) : null}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--auth-muted)]">Reviewing</p>
                <h4 className="text-2xl font-serif text-[var(--color-text)]">{productTitle}</h4>
              </div>
              <button type="button" onClick={() => !submitting && setOpen(false)} className="text-2xl text-gray-500">
                ×
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-5">
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
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
