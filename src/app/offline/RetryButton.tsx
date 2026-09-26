"use client";

/** Re-fetches the page once connectivity returns. */
export default function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-xl bg-[#1d4c38] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#163a2c]"
    >
      Try again
    </button>
  );
}
