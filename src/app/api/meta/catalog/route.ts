import { fetchAllProductsList } from "@/lib/commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csv(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function textFromHtml(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

function absoluteUrl(value: unknown, siteUrl: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, siteUrl).toString();
  } catch {
    return "";
  }
}

function siteOrigin(request: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

/** Public Meta Commerce Manager data feed. Configure it as a scheduled URL feed. */
export async function GET(request: Request) {
  const siteUrl = siteOrigin(request);
  const products = await fetchAllProductsList({ sortKey: "TITLE" });
  const columns = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "sale_price",
    "link",
    "image_link",
    "brand",
    "product_type",
  ];

  const rows = products
    .filter((product: any) => product.status !== "draft" && product.status !== "archived" && product.status !== "unlisted")
    .filter((product: any) => product.handle && product.title && product.image)
    .map((product: any) => {
      const salePrice = Number(product.price);
      const mainPrice = Number(product.compareAtPrice ?? product.price);
      const soldOut = String(product.status || "").toLowerCase() === "sold out" || String(product.status || "").toLowerCase() === "out of stock" || product.available === false || Number(product.inventoryQuantity ?? product.quantity ?? 0) <= 0;
      const inStock = !soldOut;
      const displayPrice = Number.isFinite(mainPrice) && mainPrice > 0 ? mainPrice : salePrice;
      const discountedPrice = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : displayPrice;

      return [
        `succulent-sphere-${product.id}`,
        product.title,
        textFromHtml(product.descriptionHtml || product.description || product.title),
        inStock ? "in stock" : "out of stock",
        "new",
        `${Number.isFinite(displayPrice) ? displayPrice.toFixed(2) : "0.00"} INR`,
        Number.isFinite(discountedPrice) && Number(product.compareAtPrice ?? 0) > 0 && discountedPrice < displayPrice ? `${discountedPrice.toFixed(2)} INR` : "",
        absoluteUrl(`/products/${encodeURIComponent(String(product.handle))}`, siteUrl),
        absoluteUrl(product.image, siteUrl),
        String(product.vendor || "Succulent Sphere"),
        String(product.productType || product.type || "Plants"),
      ].map(csv).join(",");
    });

  return new Response([columns.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="succulent-sphere-meta-catalog.csv"',
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
    },
  });
}
