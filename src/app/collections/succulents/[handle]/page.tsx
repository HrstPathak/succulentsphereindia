import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { mockProducts } from "../../../../data/mockProducts";
import RecommendedProducts from "../../../../components/product/RecommendedProducts";
import ProductFaqs from "../../../../components/product/ProductFaqs";
import { fetchProductByHandle } from "../../../../lib/commerce";
import UnifiedProductDetail from "@/components/product/UnifiedProductDetail";
import { absoluteUrl } from "@/lib/seo";
import { buildProductFaqStructuredData, buildProductStructuredData, toJsonLd } from "@/lib/structured-data";

export const revalidate = 86400;

function cleanProductDescription(input: unknown, fallback: string): string {
  const value = String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return fallback;
  return value.length > 220 ? `${value.slice(0, 217).trimEnd()}...` : value;
}

async function resolveProductByHandle(handle: string) {
  let product = null;

  try {
    product = await fetchProductByHandle(handle);
  } catch (error) {
    console.error("Failed to fetch product by handle:", error);
  }

  if (!product) {
    product = mockProducts.find((p) => p.handle === handle) ?? null;
  }

  return product;
}

export async function generateMetadata({
  params,
}: {
  params: { handle?: string } | Promise<{ handle?: string }>;
}): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const handle = resolvedParams?.handle ?? "";
  const product = await resolveProductByHandle(handle);

  if (!product) {
    return {
      title: "Product Not Found | Succulent Sphere",
      description: "Explore premium succulents from Succulent Sphere.",
    };
  }

  const rawSeoTitle = String(product.seoTitle || "").trim();
  const rawSeoDescription = String(product.seoDescription || "").trim();
  const title = rawSeoTitle || `${product.title} | Buy Online in India`;
  const description = rawSeoDescription
    || cleanProductDescription(
      product.description,
      `Buy ${product.title} online in India from Succulent Sphere.`
    );

  console.log("[SEO][Succulents Product Metadata]", {
    handle: product.handle || handle,
    rawSeoTitle,
    rawSeoDescription,
    titleSource: rawSeoTitle ? "product-seo" : "fallback-product-title",
    descriptionSource: rawSeoDescription ? "product-seo" : "fallback-product-description",
    seoTitle: title,
    seoDescription: description,
  });

  return {
    title,
    description,
    alternates: {
      canonical: `https://succulentsphere.com/collections/succulents/${product.handle}`,
    },
    openGraph: {
      title,
      description,
      images: product.image ? [product.image] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: { handle?: string } | Promise<{ handle?: string }> }) {
  const resolvedParams = await Promise.resolve(params);
  const handle = resolvedParams?.handle ?? "";
  const product = await resolveProductByHandle(handle);

  if (!product) {
    notFound();
  }

  const productJson = buildProductStructuredData(product, `/collections/succulents/${product.handle || handle}`);
  const productFaqs = Array.isArray(product?.faqs) ? product.faqs : [];
  const productFaqJson = buildProductFaqStructuredData(product, `/collections/succulents/${product.handle || handle}`);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(productJson) }} />
      {productFaqJson ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(productFaqJson) }} /> : null}

      <section
        className="min-h-screen"
        style={{
          backgroundColor: "var(--color-bg)",
          color: "var(--color-text)",
          paddingTop: "calc(var(--ss-header-offset, 64px) + 20px)"
        }}
      >
        <div className="container mx-auto px-4 pb-6">
          <UnifiedProductDetail product={product} />
          <div className="mt-8 hidden md:block">
            <ImportantShoppingNotice />
          </div>

          <div className="mt-12">
            <RecommendedProducts currentId={product.id} currentHandle={product.handle} currentProduct={product} collectionHandle="succulents" />
          </div>

          {productFaqs.length > 0 ? (
            <div className="mt-12">
              <ProductFaqs faqs={productFaqs} productTitle={product.title} />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function ImportantShoppingNotice() {
  return (
    <aside className="overflow-hidden rounded-2xl border border-[#d9ccb9] bg-[linear-gradient(145deg,#fff8ec_0%,#f2ecdf_62%,#eef5eb_100%)] shadow-[0_20px_42px_-32px_rgba(52,68,56,0.85)]">
      <div className="bg-[linear-gradient(90deg,#1d4534_0%,#667f54_50%,#b88962_100%)] px-4 py-2 text-xs font-semibold tracking-[0.14em] text-white">
        PURCHASE NOTE
      </div>
      <div className="space-y-2 p-4 text-sm leading-relaxed text-[#3b4e43]">
        <p className="font-medium text-[#26382f]">Please review before ordering:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Unboxing video is mandatory for refund and return eligibility.</li>
          <li>We offer a 7-day return window only for defective, damaged, or incorrect items. As we are shipping live plants, a mandatory unboxing video is required to process your request quickly and fairly.</li>
          <li>Plants are generally delivered bare-root unless stated otherwise.</li>
          <li>Pots shown in product imagery are for catalog representation.</li>
        </ul>
        <p>
          For an easy return or refund experience, connect with us directly on WhatsApp or email us. Our team handles defective-item claims personally so we can resolve them quickly.
        </p>
        <a
          href="https://wa.me/919458321209?text=Hi%20Succulent%20Sphere,%20I%20need%20help%20regarding%20return%20or%20refund."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-lg border border-[#ccbba4] bg-white/80 px-3 py-2 text-xs font-semibold text-[#304338] transition hover:bg-white"
        >
          WhatsApp Return &amp; Refund Support
        </a>
        <Link href="/refund-policy" className="inline-flex rounded-lg border border-[#ccbba4] bg-white/80 px-3 py-2 text-xs font-semibold text-[#304338] transition hover:bg-white">
          View Refund &amp; Cancellation Policy
        </Link>
      </div>
    </aside>
  );
}
