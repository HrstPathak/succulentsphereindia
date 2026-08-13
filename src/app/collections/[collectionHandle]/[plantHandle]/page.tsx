import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RevampedProductDetail from "../../../../components/product/RevampedProductDetail";
import UnifiedProductDetail from "@/components/product/UnifiedProductDetail";
import RecommendedProducts from "../../../../components/product/RecommendedProducts";
import ProductFaqs from "../../../../components/product/ProductFaqs";
import TrustBar from "../../../../components/TrustBar";
import { mockProducts } from "../../../../data/mockProducts";
import { fetchProductByHandle } from "../../../../lib/commerce";
import { absoluteUrl } from "@/lib/seo";
import { buildProductFaqStructuredData, buildProductStructuredData, toJsonLd } from "@/lib/structured-data";

export const revalidate = 86400;

const COLLECTION_METADATA: Record<string, { name: string }> = {
  succulents: { name: "Succulent Plants" },
  "air-plants": { name: "Air Plants" },
  "air-purifier": { name: "Air Purifier" },
  cacti: { name: "Cacti Collection" },
  cactus: { name: "Cacti Collection" },
  pots: { name: "Pots Collection" },
  "gift-collection": { name: "Gift Collection" },
  "rare-plants": { name: "Rare & Exotic" },
};

function cleanProductDescription(input: unknown, fallback: string): string {
  const value = String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return fallback;
  return value.length > 220 ? `${value.slice(0, 217).trimEnd()}...` : value;
}

function buildBreadcrumbJson(collectionHandle: string, collectionName: string, productTitle: string, productHandle: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: collectionName, item: absoluteUrl(`/collections/${collectionHandle}`) },
      { "@type": "ListItem", position: 3, name: productTitle, item: absoluteUrl(`/collections/${collectionHandle}/${productHandle}`) },
    ],
  };
}

interface PageParams {
  collectionHandle?: string;
  plantHandle?: string;
}

async function resolveProductByHandle(plantHandle: string) {
  let product = null;

  try {
    product = await fetchProductByHandle(plantHandle);
  } catch (error) {
    console.error("Failed to fetch product by handle:", error);
  }

  if (!product) {
    product = mockProducts.find((item) => item.handle === plantHandle) ?? null;
  }

  return product;
}

export async function generateMetadata({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const collectionHandle = resolvedParams?.collectionHandle ?? "";
  const plantHandle = resolvedParams?.plantHandle ?? "";

  if (!COLLECTION_METADATA[collectionHandle]) {
    return {};
  }

  const product = await resolveProductByHandle(plantHandle);
  if (!product) {
    return {
      title: "Product Not Found",
      description: "This product is currently unavailable.",
    };
  }

  const rawSeoTitle = String(product.seoTitle || "").trim();
  const rawSeoDescription = String(product.seoDescription || "").trim();
  const title = rawSeoTitle || String(product.title || "Succulent Sphere Product").trim();
  const description = rawSeoDescription
    || cleanProductDescription(
      product.description,
      `Buy ${product.title} from our ${COLLECTION_METADATA[collectionHandle].name} collection at Succulent Sphere.`
    );

  console.log("[SEO][Collection Product Metadata]", {
    collectionHandle,
    handle: product.handle || plantHandle,
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
      canonical: `/collections/${collectionHandle}/${product.handle || plantHandle}`,
    },
    openGraph: {
      title,
      description,
      images: product.image ? [product.image] : [],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const collectionHandle = resolvedParams?.collectionHandle ?? "";
  const plantHandle = resolvedParams?.plantHandle ?? "";

  if (!COLLECTION_METADATA[collectionHandle]) {
    notFound();
  }

  const product = await resolveProductByHandle(plantHandle);
  if (!product) {
    notFound();
  }

  const productJson = buildProductStructuredData(product, `/collections/${collectionHandle}/${product.handle || plantHandle}`);
  const collectionName = COLLECTION_METADATA[collectionHandle].name;
  const breadcrumbJson = buildBreadcrumbJson(collectionHandle, collectionName, product.title, product.handle || plantHandle);
  const productFaqs = Array.isArray(product?.faqs) ? product.faqs : [];
  const productFaqJson = buildProductFaqStructuredData(product, `/collections/${collectionHandle}/${product.handle || plantHandle}`);
  const useUnifiedDetail = collectionHandle === "cactus" || collectionHandle === "cacti";

  return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJson) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(productJson) }} />
        {productFaqJson ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(productFaqJson) }} /> : null}

        <section className="min-h-screen" style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}>
        <div className="container mx-auto px-4 py-6">
          <nav className="mb-6 text-xs" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-[var(--color-text)]">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>&rsaquo;</li>
              <li>
                <Link href={`/collections/${collectionHandle}`}>{collectionName}</Link>
              </li>
              <li>&rsaquo;</li>
              <li>
                <span aria-current="page" className="font-medium">
                  {product.title}
                </span>
              </li>
            </ol>
          </nav>

          {useUnifiedDetail ? <UnifiedProductDetail product={product} /> : <RevampedProductDetail product={product} />}

          <div className="mt-6 hidden md:block">
            <ImportantPurchaseNote />
          </div>

          <div className="mt-12">
            <RecommendedProducts currentId={product.id} />
          </div>

          {productFaqs.length > 0 ? (
            <div className="mt-12">
              <ProductFaqs faqs={productFaqs} productTitle={product.title} />
            </div>
          ) : null}

          <div className="mt-8">
            <TrustBar />
          </div>
        </div>
      </section>
    </>
  );
}

function ImportantPurchaseNote() {
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
          <li>Ships bare-rooted across India in 5-7 days for safer transit and fresher arrival.</li>
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
        <Link
          href="/refund-policy"
          className="inline-flex rounded-lg border border-[#ccbba4] bg-white/80 px-3 py-2 text-xs font-semibold text-[#304338] transition hover:bg-white"
        >
          View Refund &amp; Cancellation Policy
        </Link>
      </div>
    </aside>
  );
}
