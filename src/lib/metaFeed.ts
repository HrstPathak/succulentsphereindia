import { getFirebaseDb } from "@/lib/firebase-admin";
import { mockProducts } from "@/data/mockProducts";
import { Redis } from "@upstash/redis";

// TTL for caches
export const CACHE_TTL_SECONDS = 60 * 60; // 1 hour
export const REDIS_KEY = "meta:catalog:csv";

let redisClient: Redis | null = null;
try {
  const url = String(process.env.KV_REST_API_URL || "").trim();
  const token = String(process.env.KV_REST_API_TOKEN || "").trim();
  if (url && token) redisClient = new Redis({ url, token });
} catch {
  redisClient = null;
}

async function readRedisCsv() {
  if (!redisClient) return null;
  try {
    const v = await redisClient.get(REDIS_KEY);
    return typeof v === "string" ? v : null;
  } catch (_e) {
    return null;
  }
}

async function writeRedisCsv(value: string) {
  if (!redisClient) return;
  try {
    await redisClient.set(REDIS_KEY, value, { ex: CACHE_TTL_SECONDS });
  } catch (_e) {
    // ignore write failures
  }
}

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

export async function fetchProductsForFeed(limit = 2000) {
  const db = getFirebaseDb();
  const snapshot = await db.collection("products").limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

/** Generate CSV for the given site origin */
export async function generateCsv(siteUrl: string) {
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
  return csvText;
}

/** Try to get CSV from Redis or from a user-provided presigned upload URL (GET). */
export async function getCachedCsv() {
  // Prefer Redis if available
  const r = await readRedisCsv();
  if (r) return { source: "redis", csv: r };

  // No Redis value. If a presigned getter URL is provided, try fetching it.
  const presignedGet = String(process.env.META_CSV_GET_URL || "").trim();
  if (presignedGet) {
    try {
      const res = await fetch(presignedGet);
      if (res.ok) {
        const text = await res.text();
        return { source: "remote", csv: text };
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/** Write CSV to Redis and optionally upload to a presigned PUT URL if provided. */
export async function writeCaches(csvText: string) {
  await writeRedisCsv(csvText);

  // If a presigned upload URL is configured, PUT the CSV there so it becomes a durable static file.
  const presignedPut = String(process.env.META_CSV_PRESIGNED_PUT_URL || "").trim();
  if (presignedPut) {
    try {
      await fetch(presignedPut, {
        method: "PUT",
        headers: { "Content-Type": "text/csv; charset=utf-8" },
        body: csvText,
      });
    } catch (e) {
      console.info("[metaFeed] presigned PUT failed:", String((e as Error)?.message || e));
    }
  }
}

/** Generate and write caches; fall back to mock CSV if generation fails */
export async function generateAndCache(siteUrl: string) {
  try {
    const csvText = await generateCsv(siteUrl);
    await writeCaches(csvText);
    return { ok: true, csv: csvText, source: "generated" };
  } catch (e) {
    console.info("[metaFeed] generation failed:", String((e as Error)?.message || e));
    // Try to return any cached CSV
    const cached = await getCachedCsv();
    if (cached) return { ok: true, csv: cached.csv, source: cached.source };

    // As last resort, build a small fallback from bundled mockProducts
    try {
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
      const rows = mockProducts.slice(0, 50).map((product: any) => {
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
      const csvText = [[...columns].join(","), ...rows].join("\n");
      // Cache fallback
      await writeCaches(csvText);
      return { ok: true, csv: csvText, source: "fallback_mock" };
    } catch (fallbackError) {
      console.info("[metaFeed] fallback failed:", String((fallbackError as Error)?.message || fallbackError));
      return { ok: false, error: String((e as Error)?.message || e) };
    }
  }
}
