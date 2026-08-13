export default function AccountLoading() {
  return (
    <section
      className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 pb-16 pt-12"
      style={{
        paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)",
      }}
    >
      <div
        className="mx-auto max-w-6xl"
      >
        <div
        className="animate-pulse rounded-2xl border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-8"
        style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface)" }}
      >
        <div className="h-3 w-40 rounded bg-[var(--color-secondary)]/40" />
        <div className="mt-3 h-9 w-72 rounded bg-[var(--color-brand)]/20" />
        <div className="mt-3 h-4 w-80 rounded bg-[var(--color-text)]/15" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[220px,1fr]">
          <div className="space-y-2 rounded-2xl border p-2" style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface)" }}>
            <div className="h-9 rounded-xl bg-[var(--color-secondary)]/25" />
            <div className="h-9 rounded-xl bg-[var(--color-secondary)]/25" />
            <div className="h-9 rounded-xl bg-[var(--color-secondary)]/25" />
            <div className="h-9 rounded-xl bg-[var(--color-secondary)]/25" />
          </div>
          <div className="space-y-3 rounded-2xl border p-5" style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface)" }}>
            <div className="h-8 w-52 rounded bg-[var(--color-brand)]/20" />
            <div className="h-11 rounded-2xl bg-[var(--color-secondary)]/25" />
            <div className="h-11 rounded-2xl bg-[var(--color-secondary)]/25" />
            <div className="h-11 rounded-2xl bg-[var(--color-secondary)]/25" />
            <div className="h-11 w-44 rounded-2xl bg-[var(--color-brand)]/20" />
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
