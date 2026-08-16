import { getFirebaseDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// In-process cache to reduce Firestore reads and avoid timeouts for crawlers like Meta.
// This is a best-effort cache for server instances. For reliable cross-instance caching,
// replace with a shared cache (Redis, Upstash, etc.).
let _cachedCsv: string | null = null;
let _cachedAt = 0;
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

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

function normalizeRetailerId(value: unknown) {
  const raw = String(value ?? "").trim();
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "product";
}

function siteOrigin(request: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

import { mockProducts } from "@/data/mockProducts";

async function fetchProductsForFeed() {
  const db = getFirebaseDb();
  // Fetch only top-level product documents. Keep result projection minimal to reduce bandwidth.
  const snapshot = await db.collection("products").limit(2000).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

/** Public Meta Commerce Manager data feed. Configure it as a scheduled URL feed. */
export async function GET(request: Request) {
  const siteUrl = siteOrigin(request);

  // Serve cached CSV if fresh.
  const now = Date.now();
  if (_cachedCsv && now - _cachedAt < CACHE_TTL_SECONDS * 1000) {
    return new Response(_cachedCsv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="succulent-sphere-meta-catalog.csv"',
        // Let CDN/cache hold the result for the same duration
        "Cache-Control": `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`,
      },
    });
  }

  // Try to build a fresh feed. If Firestore fails, return stale cached data if available.
  try {
    const products = await fetchProductsForFeed();

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
      .filter((product: any) => String(product.status || "").toLowerCase() !== "draft" && String(product.status || "").toLowerCase() !== "archived" && String(product.status || "").toLowerCase() !== "unlisted")
      .filter((product: any) => (product.handle || product.id) && (product.title || product.name) && product.image)
      .map((product: any) => {
        const salePrice = Number(product.price);
        const mainPrice = Number(product.compareAtPrice ?? product.price);
        const soldOut = String(product.status || "").toLowerCase() === "sold out" || String(product.status || "").toLowerCase() === "out of stock" || product.available === false || Number(product.inventoryQuantity ?? product.quantity ?? 0) <= 0;
        const inStock = !soldOut;
        const displayPrice = Number.isFinite(mainPrice) && mainPrice > 0 ? mainPrice : salePrice;
        const discountedPrice = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : displayPrice;
        const retailerId = normalizeRetailerId(product.handle || product.id || product.title || product.name);

        return [
          retailerId,
          product.title || product.name || "",
          textFromHtml(product.descriptionHtml || product.description || product.title || product.name),
          inStock ? "in stock" : "out of stock",
          "new",
          `${Number.isFinite(displayPrice) ? displayPrice.toFixed(2) : "0.00"} INR`,
          Number.isFinite(discountedPrice) && Number(product.compareAtPrice ?? 0) > 0 && discountedPrice < displayPrice ? `${discountedPrice.toFixed(2)} INR` : "",
          absoluteUrl(`/products/${encodeURIComponent(String(product.handle || product.id || ""))}`, siteUrl),
          absoluteUrl(product.image, siteUrl),
          String(product.vendor || "Succulent Sphere"),
          String(product.productType || product.type || "Plants"),
        ].map(csv).join(",");
      });

    const csvText = [columns.join(","), ...rows].join("\n");

    // Cache the generated CSV
    _cachedCsv = csvText;
    _cachedAt = Date.now();

    return new Response(csvText, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="succulent-sphere-meta-catalog.csv"',
        "Cache-Control": `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`,
      },
    });
  } catch (error) {
    // If generating fresh feed fails, return stale cached content if available.
    // Log a concise message and avoid printing error objects to prevent source-map noise.
    console.info(`[meta catalog] feed generation failed: ${String((error as Error)?.message || error)}`);
    if (_cachedCsv) {
      return new Response(_cachedCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'inline; filename="succulent-sphere-meta-catalog.csv"',
          "Cache-Control": `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`,
          "X-Cache-Status": "STALE",
        },
      });
    }

    // As a last resort, serve a small fallback feed from bundled mock data so crawlers get a valid payload.
    try {
      const fallbackRows = mockProducts
        .slice(0, 50)
        .map((product: any) => {
          const retailerId = normalizeRetailerId(product.handle || product.id || product.title || product.name);
          const inStock = product.available !== false;
          return [
            retailerId,
            product.title || product.name || "",
            textFromHtml(product.description || product.title || product.name || ""),
            inStock ? "in stock" : "out of stock",
            "new",
            `${Number.isFinite(Number(product.price)) ? Number(product.price).toFixed(2) : "0.00"} INR`,
            "",
            absoluteUrl(`/products/${encodeURIComponent(String(product.handle || product.id || ""))}`, siteUrl),
            absoluteUrl(product.image, siteUrl),
            String(product.productType || product.type || "Succulent Plant"),
            String(product.productType || product.type || "Plants"),
          ].map(csv).join(",");
        });
      const csvText = [[
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
      ].join(","), ...fallbackRows].join("\n");

      // Cache fallback so subsequent requests are fast
      _cachedCsv = csvText;
      _cachedAt = Date.now();

      return new Response(csvText, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'inline; filename="succulent-sphere-meta-catalog.csv"',
          "Cache-Control": `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`,
          "X-Cache-Status": "FALLBACK_MOCK",
        },
      });
    } catch (fallbackError) {
      console.info(`[meta catalog] fallback generation failed: ${String((fallbackError as Error)?.message || fallbackError)}`);
      return new Response("Service unavailable", { status: 503 });
    }
  }
}
