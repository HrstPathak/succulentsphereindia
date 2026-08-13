import type { Metadata } from "next";
import Link from "next/link";
import { fetchProductsByQuery } from "@/lib/commerce";
import { resolveProductImageAlt } from "@/lib/imageAlt";
import ComboCollectionGrid from "@/components/combo/ComboCollectionGrid";
import { mediaAsset } from "@/lib/media";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Combo Collection | Succulent Sphere",
  description: "Curated succulent combos with free delivery. Ready-to-gift bundles handpicked by our team.",
};

const COMBO_PRODUCT_TYPE = "Combo";

function productCardImage(url: string) {
  return url;
}

async function getComboReadyProducts() {
  try {
    const res = await fetchProductsByQuery(`product_type:"${COMBO_PRODUCT_TYPE}"`, {
      first: 60,
      sortKey: "BEST_SELLING",
      reverse: false,
    });
    return (res.edges || []).map((edge: any, idx: number) => {
      const node = edge?.node || {};
      const image = node?.images?.edges?.[0]?.node?.url || "/assets/product-1.jpg";
      const imageAlt = resolveProductImageAlt(node?.images?.edges?.[0]?.node?.altText);
      const variant = node?.variants?.edges?.[0]?.node;
      return {
        id: String(node.id || `combo-ready-${idx}`),
        title: String(node.title || "Untitled"),
        handle: String(node.handle || ""),
        price: String(variant?.price?.amount ?? variant?.priceV2?.amount ?? "0.00"),
        image: productCardImage(String(image)),
        imageAlt,
      };
    });
  } catch {
    return [];
  }
}

export default async function ComboCollectionPage() {
  const products = await getComboReadyProducts();

  return (
    <section
      className="min-h-screen bg-[radial-gradient(circle_at_top,#f9f3ea_0%,#f2ede3_32%,#f7f4ee_78%)] pb-14"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <div className="container mx-auto px-4">
        <div
          className="mb-10 rounded-3xl border border-black/10 bg-[#101412] px-6 py-10 text-center shadow-[0_22px_60px_rgba(18,26,22,0.18)] md:px-10 md:py-12"
          style={{
            backgroundImage:
              `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${mediaAsset("sites/images/77f60e9fdc-Succulent_combo_set_with_free_delivery.png")}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/80">Combo</p>
          <h1 className="mt-4 text-3xl font-serif text-white md:text-4xl">
            Free Delivered Combos are waiting for you. Buy now.
          </h1>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/combo-builder"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-xs font-semibold text-[#20352a] shadow-[0_14px_28px_rgba(8,12,10,0.35)] transition hover:-translate-y-0.5"
            >
              Build Your Own Combo
            </Link>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-full border border-white/80 bg-white/10 px-6 py-2.5 text-xs font-semibold text-white/90 transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              Explore All Plants
            </Link>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
            Free Delivery On Combo
          </p>
        </div>

        {products.length > 0 ? (
          <ComboCollectionGrid products={products} />
        ) : (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50 p-6 text-sm text-amber-900">
             No combo bundles found yet. Set the product <strong>Product Type</strong> to{" "}
            <strong>{COMBO_PRODUCT_TYPE}</strong> to populate this page.
          </div>
        )}
      </div>
    </section>
  );
}

