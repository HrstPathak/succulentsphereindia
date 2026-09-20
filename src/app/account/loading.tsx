/**
 * Route-level loading UI for /account.
 *
 * Mirrors the real AccountDashboard shell so the skeleton occupies the same
 * footprint (max-w-5xl, [30px] card, hero block -> profile card -> wallet card
 * -> account menu rows) and the swap to real content doesn't shift the page.
 *
 * Placeholder bars use the hand-written `.ss-skeleton*` classes from
 * globals.css instead of Tailwind colour utilities: Tailwind v3 silently drops
 * the opacity modifier on arbitrary `var()` colours (a class such as
 * `bg-[var(--token)]/20` emits NO rule at all), which previously made these
 * bars invisible.
 */

/** Number of placeholder rows for the account menu list. */
const MENU_ROW_COUNT = 5;

export default function AccountLoading() {
  return (
    <section
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading your account"
      className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 pb-16 pt-8"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <span className="sr-only">Loading your account…</span>

      <div className="mx-auto max-w-5xl">
        <div className="rounded-[30px] border border-[var(--auth-border)] bg-[linear-gradient(155deg,#f7f3ef_0%,#f2ece6_55%,#efe7df_100%)] p-4 shadow-[0_20px_55px_rgba(12,20,14,0.16)] sm:p-6">
          {/* Hero: "My Account" heading + shop shortcut + welcome copy */}
          <div className="rounded-2xl bg-[radial-gradient(circle_at_85%_35%,rgba(120,145,118,0.2),transparent_34%),linear-gradient(160deg,rgba(255,255,255,0.7),rgba(255,255,255,0.25))] px-4 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="ss-skeleton ss-skeleton-strong h-10 w-52 rounded-lg" />
              <div className="ss-skeleton h-9 w-9 shrink-0 rounded-lg" />
            </div>
            <div className="ss-skeleton mt-3 h-7 w-full max-w-xs rounded-lg" />
            <div className="ss-skeleton mt-3 h-4 w-full max-w-xl" />
          </div>

          {/* Profile card: avatar + name/email/member-since + Edit Profile button */}
          <div className="mt-4 rounded-2xl border border-[var(--auth-border)] bg-white/[0.62] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="ss-skeleton ss-skeleton-strong h-16 w-16 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="ss-skeleton ss-skeleton-strong h-8 w-48 rounded-lg" />
                  <div className="ss-skeleton h-4 w-56 max-w-full" />
                  <div className="ss-skeleton h-3 w-32" />
                </div>
              </div>
              <div className="ss-skeleton h-11 w-full rounded-lg sm:w-36" />
            </div>
          </div>

          {/* Wallet card */}
          <div className="mt-4 rounded-2xl border border-[var(--auth-border)] bg-white/[0.62] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
              <div className="ss-skeleton ss-skeleton-strong h-11 w-11 shrink-0 rounded-full" />
              <div className="space-y-2">
                <div className="ss-skeleton h-3 w-28" />
                <div className="ss-skeleton ss-skeleton-strong h-7 w-32 rounded-lg" />
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="ss-skeleton h-12 rounded-xl" />
              <div className="ss-skeleton h-12 rounded-xl" />
            </div>
          </div>

          {/* Account menu rows: Wallet / Orders / Wishlist / Settings / ... */}
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: MENU_ROW_COUNT }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-xl border border-[var(--auth-border)] bg-white/55 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="ss-skeleton ss-skeleton-strong h-5 w-5 shrink-0 rounded-full" />
                  <div className="ss-skeleton h-5 w-40 max-w-full rounded-md" />
                </div>
                <div className="ss-skeleton h-4 w-4 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
