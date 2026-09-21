/**
 * Route-level loading UI for /wishlist.
 *
 * Mirrors the real WishlistPage shell (max-w-5xl, [28px] card, heading block ->
 * two-column grid of product rows) so a client-side navigation to the wishlist
 * shows the layout immediately and the swap to real content does not shift the
 * page. Placeholder bars use the hand-written `.ss-skeleton*` classes from
 * globals.css (see src/app/account/loading.tsx).
 */

/** Number of placeholder rows: fills the first screen at both breakpoints. */
const SKELETON_ROW_COUNT = 4;

function WishlistRowSkeleton() {
  return (
    <article className="rounded-2xl border border-[var(--auth-border)] bg-white/60 p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <div className="ss-skeleton ss-skeleton-strong h-24 w-24 shrink-0 rounded-xl sm:h-28 sm:w-28" />
        <div className="min-w-0 flex-1">
          <div className="ss-skeleton ss-skeleton-strong h-5 w-4/5 rounded-md" />
          <div className="ss-skeleton mt-3 h-4 w-24 rounded-md" />
          <div className="mt-4 flex gap-2">
            <div className="ss-skeleton h-8 w-28 rounded-lg" />
            <div className="ss-skeleton h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function WishlistLoading() {
  return (
    <section
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading your wishlist"
      className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 pb-16 pt-8"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <span className="sr-only">Loading your wishlist…</span>

      <div className="mx-auto max-w-5xl">
        <div className="rounded-[28px] border border-[var(--auth-border)] bg-[linear-gradient(145deg,#f7f2ed_0%,#efe7df_100%)] p-4 shadow-[0_20px_55px_rgba(12,20,14,0.14)] sm:p-7">
          {/* Heading block: "Your Collection" / Wishlist / items saved + CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="ss-skeleton h-3 w-32" />
              <div className="ss-skeleton ss-skeleton-strong mt-2 h-10 w-44 rounded-lg" />
              <div className="ss-skeleton mt-3 h-4 w-40" />
            </div>
            <div className="ss-skeleton h-9 w-40 rounded-lg" />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
              <WishlistRowSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
