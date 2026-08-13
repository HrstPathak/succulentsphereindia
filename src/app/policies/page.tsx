import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    absolute: "Policies | Succulent Sphere",
  },
  description:
    "Access all Succulent Sphere policies in one place, including shipping, refunds, privacy, and terms.",
  alternates: {
    canonical: "/policies",
  },
};

const POLICIES = [
  {
    title: "Shipping & Delivery",
    description: "Coverage areas, timelines, courier partners, and delivery attempts.",
    href: "/shipping-returns",
  },
  {
    title: "Refund & Cancellation",
    description: "Refund eligibility, unboxing requirements, and processing timelines.",
    href: "/refund-policy",
  },
  {
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal data.",
    href: "/privacy-policy",
  },
  {
    title: "Terms & Conditions",
    description: "Website usage, orders, payments, and dispute resolution.",
    href: "/terms-and-conditions",
  },
];

export default function PoliciesPage() {
  return (
    <section className="min-h-screen bg-[var(--color-bg)] py-12 pt-24">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--auth-border)] bg-[linear-gradient(140deg,rgba(255,255,255,0.98)_0%,rgba(244,238,232,0.9)_55%,rgba(236,242,232,0.92)_100%)] p-8 shadow-[0_24px_60px_-36px_rgba(12,20,14,0.45)] md:p-12">
          <div className="pointer-events-none absolute -left-24 -top-20 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(163,177,138,0.35),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(203,153,126,0.35),transparent_70%)] blur-3xl" />

          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-brand)]/70">
              Policies
            </p>
            <h1 className="mt-3 font-serif text-4xl text-[var(--color-text)] sm:text-5xl">
              Everything you need to know
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--auth-muted)] sm:text-base">
              Find all policy documents in one place. We keep them clear, transparent, and easy to access so you can
              shop with confidence.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit rounded-2xl border border-[var(--auth-border)] bg-white/70 p-5 shadow-[0_18px_40px_-28px_rgba(12,20,14,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--auth-muted)]">
              Quick Links
            </p>
            <nav className="mt-4 flex flex-col gap-2">
              {POLICIES.map((policy) => (
                <Link
                  key={policy.href}
                  href={policy.href}
                  className="group rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]/35 hover:bg-[var(--color-brand)]/10"
                >
                  <span className="flex items-center justify-between">
                    {policy.title}
                    <span className="text-[var(--color-brand)] opacity-0 transition group-hover:opacity-100">
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </nav>
          </aside>

          <div className="grid gap-5 md:grid-cols-2">
            {POLICIES.map((policy) => (
              <Link
                key={policy.href}
                href={policy.href}
                className="group relative overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white/80 p-6 shadow-[0_18px_40px_-30px_rgba(12,20,14,0.4)] transition hover:-translate-y-1 hover:shadow-[0_26px_50px_-32px_rgba(12,20,14,0.5)]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(163,177,138,0.3),transparent_70%)] opacity-0 transition group-hover:opacity-100" />
                <h3 className="text-xl font-semibold text-[var(--color-text)]">{policy.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--auth-muted)]">{policy.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-brand)]">
                  Read policy <span aria-hidden>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
