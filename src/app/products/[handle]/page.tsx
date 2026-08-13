import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { mockProducts } from "../../../data/mockProducts";
import RecommendedProducts from "../../../components/product/RecommendedProducts";
import ProductFaqs from "../../../components/product/ProductFaqs";
import { fetchProductByHandle } from "../../../lib/commerce";
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
      title: "Product Not Found",
      description: "Explore premium succulents from Succulent Sphere.",
    };
  }

  const rawSeoTitle = String(product.seoTitle || "").trim();
  const rawSeoDescription = String(product.seoDescription || "").trim();
  const title = rawSeoTitle || String(product.title || "Succulent Sphere Product").trim();
  const description = rawSeoDescription
    || cleanProductDescription(product.description, `Buy ${product.title} online in India from Succulent Sphere.`);

  console.log("[SEO][Product Metadata]", {
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
  canonical: `${absoluteUrl(`/products/${product.handle}`)}`,
},
    openGraph: {
      title,
      description,
      images: product.image ? [product.image] : [],
    },
  };
}

function buildBreadcrumbJson(product: any) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Succulent Plants", item: absoluteUrl("/collections/succulents") },
      { "@type": "ListItem", position: 3, name: product.title, item: absoluteUrl(`/products/${product.handle || ""}`) },
    ],
  };
}

export default async function ProductPage({ params }: { params: { handle?: string } | Promise<{ handle?: string }> }) {
  const resolvedParams = await Promise.resolve(params);
  const handle = resolvedParams?.handle ?? "";
  const product = await resolveProductByHandle(handle);

  if (!product) {
    notFound();
  }

  const productJson = buildProductStructuredData(product, `/products/${product.handle || handle}`);
  const breadcrumbJson = buildBreadcrumbJson(product);
  const productFaqs = Array.isArray(product?.faqs) ? product.faqs : [];
  const productFaqJson = buildProductFaqStructuredData(product, `/products/${product.handle || handle}`);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(productJson) }} />
      {productFaqJson ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(productFaqJson) }} /> : null}

      <section
        className="pb-10 md:pb-14"
        style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 20px)" }}
      >
        <div className="container relative mx-auto px-4">
          <nav className="mb-6 text-xs text-gray-600" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-[var(--color-brand)] transition-colors">Home</Link>
              </li>
              <li>&rsaquo;</li>
              <li>
                <Link href="/collections/succulents" className="hover:text-[var(--color-brand)] transition-colors">Succulent Plants</Link>
              </li>
              <li>&rsaquo;</li>
              <li className="font-medium text-[var(--color-text)] truncate max-w-[160px] md:max-w-[280px]">{product.title}</li>
            </ol>
          </nav>

          <UnifiedProductDetail product={product} />

          <div className="mt-10">
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
