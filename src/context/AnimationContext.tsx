import Link from "next/link";

export default function TrustBar({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={`border-t border-b border-neutral-200 py-4 ${embedded ? "mt-0" : "mt-4"}`}>
      <div className={embedded ? "" : "container mx-auto px-4"}>
        <div className="grid grid-cols-3 text-center text-sm font-medium gap-2">
          <Link href="/shipping-returns" className="group flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg px-2 py-1 transition hover:bg-[var(--color-brand)]/10">
            <span className="text-[var(--color-brand)]">
              <ShippingIcon />
            </span>
            <span className="group-hover:text-[var(--color-brand)]">Safe Shipping</span>
          </Link>

          <Link href="/privacy-policy" className="group flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg px-2 py-1 transition hover:bg-[var(--color-brand)]/10">
            <span className="text-[var(--color-brand)]">
              <ShieldIcon />
            </span>
            <span className="group-hover:text-[var(--color-brand)]">Privacy Protected</span>
          </Link>

          <Link href="/terms-and-conditions" className="group flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg px-2 py-1 transition hover:bg-[var(--color-brand)]/10">
            <span className="text-[var(--color-brand)]">
              <TermsIcon />
            </span>
            <span className="group-hover:text-[var(--color-brand)]">Terms &amp; Conditions</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ShippingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M3 7h11v8H3V7Zm11 2h3l3 3v3h-6V9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="7" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TermsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
