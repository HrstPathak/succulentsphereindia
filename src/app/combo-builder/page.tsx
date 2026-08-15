import type { Metadata } from "next";
import Link from "next/link";
import ComboBuilder from "@/components/combo/ComboBuilder";
import { fetchProductsByQuery } from "@/lib/commerce";
import { resolveProductImageAlt } from "@/lib/imageAlt";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Combo Builder | Succulent Sphere",
  description: "Mix & match 4 plants, save 10%. Build your own custom combo box from our combo collection.",
};

function productCardImage(url: string) {
  return url;
}

async function getComboProducts() {
  try {
    const res = await fetchProductsByQuery(`tag:"combo"`, {
      first: 60,
      sortKey: "BEST_SELLING",
      reverse: false,
    });
    return (res.edges || []).map((edge: any, idx: number) => {
      const node = edge?.node || {};
      const image = String(node?.image || "/assets/product-1.jpg");
      const imageAlt = resolveProductImageAlt(node?.imageAlt || node?.title || "Combo product");
      const price = String(node?.price ?? "0.00");
      return {
        id: String(node.id || `combo-${idx}`),
        title: String(node.title || "Untitled"),
        handle: String(node.handle || ""),
        price,
        image: productCardImage(image),
        imageAlt,
      };
    });
  } catch {
    return [];
  }
}

export default async function ComboBuilderPage() {
  const products = await getComboProducts();

  return (
    <section
      className="min-h-screen bg-[radial-gradient(circle_at_top,#f7f3ed_0%,#f1ebe2_35%,#f7f4ee_75%)] pb-10"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <div className="container mx-auto px-4">
        <div className="mb-8 rounded-[28px] border border-emerald-100/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(13,27,21,0.12)]">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Custom Combo Builder</p>
          <h2 className="mt-2 text-2xl font-serif text-[var(--color-text)] sm:text-3xl">
            Pick any 4 from the combo collection
          </h2>
          <p className="mt-2 text-sm text-[var(--auth-muted)]">
            Each combo is curated fresh. Once you add the combo, you will see the 10% savings directly in your cart.
          </p>
          <p className="mt-3 text-xs text-[var(--auth-muted)]">
            Tap any product card to select it. You can choose up to 4 plants.
          </p>

          <div className="mt-5 rounded-2xl border border-emerald-100/70 bg-emerald-50/70 p-4 text-sm text-emerald-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Prefer a ready-made combo?
                </p>
                <p className="mt-1 text-sm text-emerald-900/90">
                  Explore our curated combo bundles with free delivery, crafted by our team.
                </p>
              </div>
              <Link
                href="/combo"
                className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-5 py-2 text-xs font-semibold text-white shadow-[0_14px_26px_rgba(16,90,54,0.28)] transition hover:-translate-y-0.5"
              >
                Browse Combo Collection
              </Link>
            </div>
          </div>
        </div>

        {products.length > 0 ? (
          <>
            <ComboBuilder products={products} />

            <section className="mt-10 rounded-[28px] border border-emerald-100/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(13,27,21,0.12)]">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Premium Care Notes</p>
              <h3 className="mt-2 text-xl font-serif text-[var(--color-text)] sm:text-2xl">Shopping Notice</h3>
              <p className="mt-2 text-sm text-[var(--auth-muted)]">
                We pack every combo with care so it arrives healthy and ready to thrive. Please review the key details below.
              </p>
              <ul className="mt-5 grid gap-3 text-sm text-[var(--color-text)] sm:grid-cols-2">
                <li className="rounded-2xl border border-emerald-100/70 bg-emerald-50/60 px-4 py-3">
                  Plants are delivered bare-root unless a pot is explicitly listed in the product details.
                </li>
                <li className="rounded-2xl border border-emerald-100/70 bg-emerald-50/60 px-4 py-3">
                  An unboxing video is required for any refund or replacement request.
                </li>
                <li className="rounded-2xl border border-emerald-100/70 bg-emerald-50/60 px-4 py-3">
                  Pots shown in images are for display styling only and are not included unless stated.
                </li>
                <li className="rounded-2xl border border-emerald-100/70 bg-emerald-50/60 px-4 py-3">
                  Delivery is typically within 5–8 business days after dispatch.
                </li>
              </ul>
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50 p-6 text-sm text-amber-900">
             No combo-tagged products found yet. Add the tag <strong>combo</strong> in the Admin product dashboard to populate this page.
          </div>
        )}
      </div>
    </section>
  );
}
