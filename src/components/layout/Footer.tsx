import Link from "next/link";
import { Facebook, Instagram, Mail, Phone, Pin } from "lucide-react";
import NewsletterSignup from "./NewsletterSignup";

export default function Footer() {
  const supportEmail = "support@succulentsphere.com";
  const supportPhone = "+91 94583 21209";

  return (
    <footer className="mt-20 bg-[var(--color-bg)] text-[var(--color-text)]" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Succulent Sphere Footer
      </h2>

      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--color-secondary) 20%, var(--color-brand) 50%, var(--color-accent) 80%, transparent 100%)",
        }}
      />

      <section aria-label="Newsletter" className="px-4 pt-8 sm:px-6 lg:px-8">
        <div
          className="mx-auto max-w-7xl rounded-2xl p-6 shadow-sm sm:p-8 lg:p-10"
          style={{ background: "linear-gradient(135deg, rgba(163,177,138,0.24) 0%, rgba(203,153,126,0.1) 100%)" }}
        >
          <div className="mb-3 flex items-center gap-2 opacity-70" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-[var(--color-brand)]" />
            <span className="h-1 w-3 rounded-full bg-[var(--color-accent)]" />
            <span className="h-1 w-6 rounded-full bg-[var(--color-secondary)]" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Join Our Plant Community</h2>
              <p className="mt-3 max-w-xl text-sm opacity-90">
                Get indoor plant care tips, premium succulent drops, and curated plant decor updates for modern homes.
              </p>
            </div>

            <NewsletterSignup />
          </div>
        </div>
      </section>

      <section className="px-4 pb-8 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:bg-black/20 sm:p-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="text-lg font-semibold">Succulent Sphere</h3>
              <p className="mt-3 text-sm leading-6 opacity-90">
                Premium succulents and plant decor for modern homes. Discover indoor plants designed to elevate calm
                living.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Succulent Sphere on Instagram"
                  className="rounded-xl p-2 transition-colors hover:bg-[var(--color-accent)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                >
                  <Instagram size={18} strokeWidth={1.8} />
                </a>
                <a
                  href="https://pinterest.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Succulent Sphere on Pinterest"
                  className="rounded-xl p-2 transition-colors hover:bg-[var(--color-accent)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                >
                  <Pin size={18} strokeWidth={1.8} />
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Succulent Sphere on Facebook"
                  className="rounded-xl p-2 transition-colors hover:bg-[var(--color-accent)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                >
                  <Facebook size={18} strokeWidth={1.8} />
                </a>
              </div>
            </div>

            <nav aria-label="Shop links">
              <h3 className="text-base font-semibold">Shop</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/collections/succulents" className="transition-colors hover:text-[var(--color-accent)]">
                    Succulent Plants
                  </Link>
                </li>
                <li>
                  <Link href="/collections" className="transition-colors hover:text-[var(--color-accent)]">
                    Pots &amp; Planters
                  </Link>
                </li>
                <li>
                  <Link href="/collections" className="transition-colors hover:text-[var(--color-accent)]">
                    Gifting Collection
                  </Link>
                </li>
                <li>
                  <Link href="/collections" className="transition-colors hover:text-[var(--color-accent)]">
                    Beginner Friendly
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Support links">
              <h3 className="text-base font-semibold">Support</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/plant-care" className="transition-colors hover:text-[var(--color-accent)]">
                    Plant Care Guide
                  </Link>
                </li>
                <li>
                  <Link href="/shipping-returns" className="transition-colors hover:text-[var(--color-accent)]">
                    Shipping &amp; Delivery
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition-colors hover:text-[var(--color-accent)]">
                    FAQs
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition-colors hover:text-[var(--color-accent)]">
                    Contact Us
                  </Link>
                </li>
              </ul>

              <div className="mt-5 rounded-2xl border border-black/5 bg-[var(--color-bg)]/70 p-4 dark:border-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">Talk to us</p>

                <div className="mt-3 space-y-3 text-sm">
                  <a
                    href="tel:+919458321209"
                    className="group flex items-start gap-3 rounded-xl transition-colors hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)]/12 text-[var(--color-brand)]"
                      aria-hidden="true"
                    >
                      <Phone size={16} strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs uppercase tracking-[0.16em] opacity-60">Contact Number</span>
                      <span className="mt-1 block font-medium leading-5">{supportPhone}</span>
                    </span>
                  </a>

                  <a
                    href={`mailto:${supportEmail}`}
                    className="group flex items-start gap-3 rounded-xl transition-colors hover:text-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/18 text-[var(--color-accent)]"
                      aria-hidden="true"
                    >
                      <Mail size={16} strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs uppercase tracking-[0.16em] opacity-60">Support Email</span>
                      <span className="mt-1 block break-all font-medium leading-5">{supportEmail}</span>
                    </span>
                  </a>
                </div>
              </div>
            </nav>

            <nav aria-label="Legal links">
              <h3 className="text-base font-semibold">Legal</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/privacy-policy" className="transition-colors hover:text-[var(--color-accent)]">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms-and-conditions" className="transition-colors hover:text-[var(--color-accent)]">
                    Terms &amp; Conditions
                  </Link>
                </li>
                <li>
                  <Link href="/refund-policy" className="transition-colors hover:text-[var(--color-accent)]">
                    Refund &amp; Cancellation
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl border-t border-black/10 pt-5 dark:border-white/10">
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; 2026 Succulent Sphere. All rights reserved.</p>
            <div className="flex items-center gap-2" aria-label="Payment methods">
              <span className="rounded-lg border border-black/10 px-2 py-1 text-xs shadow-sm dark:border-white/10">VISA</span>
              <span className="rounded-lg border border-black/10 px-2 py-1 text-xs shadow-sm dark:border-white/10">Mastercard</span>
              <span className="rounded-lg border border-black/10 px-2 py-1 text-xs shadow-sm dark:border-white/10">UPI</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}


