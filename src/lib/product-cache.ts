import "server-only";
import { cacheDelete, cacheGet, cacheSet } from "./redis";
import { getRedis } from "./redis";
import { fetchProductByHandle, fetchProductHandlesForStaticGeneration, normaliseHandle, invalidateCatalogCache, mapProduct, type Product, type ProductReview } from "./commerce";
import { revalidatePath } from "next/cache";
const PRODUCT_REDIS_KEY = "catalog:product:v1";
const PRODUCT_TTL_SECONDS = 86400;
function redisKey(handle: string): string {
  return `${PRODUCT_REDIS_KEY}:${handle.trim().toLowerCase()}`;
}
export async function readProductFromRedis(handle: string, withReviews = false): Promise<Product | null> {
  const redis = getRedis();
  if (!redis) return null;
  const key = redisKey(handle);
  try {
    const raw = await redis.get(key);
    if (raw == null) return null;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw as string) as Record<string, unknown>;
    } catch {
      return null;
    }
    if (typeof payload.id !== "string") return null;
    const reviews: unknown = payload.reviews;
    let reviewList: ProductReview[] | undefined;
    if (withReviews && Array.isArray(reviews)) {
      reviewList = reviews as ProductReview[];
    }
    return mapProduct(payload.id, payload, reviewList);
  } catch {
    return null;
  }
  return null;
}
export async function fetchProductByHandleRedis(handleInput: unknown, options: { useRedis?: boolean; withReviews?: boolean } = {}): Promise<Product | null> {
  const handle = normaliseHandle(handleInput);
  if (!handle) return null;
  if (options.useRedis !== true) return await fetchProductByHandle(handleInput, options);
  const withReviews = options.withReviews === true;
  const hit = await readProductFromRedis(handle, withReviews);
  if (hit) return hit;
  const product = await fetchProductByHandle(handle);
  if (!product) return null;
  const payload = toRedisPayload(product);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(redisKey(handle), JSON.stringify(payload), { ex: PRODUCT_TTL_SECONDS });
    } catch {
      // Best-effort.
    }
  }
  return product;
}
export async function invalidateProductCaches(
  input: {
    handles?: string[];
    ids?: string[];
    oldHandles?: string[];
    scope: "product" | "stock" | "reviews";
  },
  opts: { includeSitemap?: boolean } = {},
): Promise<{ redis: number; catalog: boolean; paths: string[]; details: { key: string; deleted: number }[] }> {
  const { handles = [], ids = [], oldHandles = [], scope } = input;
  const result: { redis: number; catalog: boolean; paths: string[]; details: { key: string; deleted: number }[] } = {
    redis: 0,
    catalog: false,
    paths: [],
    details: [],
  };
  const allHandles = [...new Set([...(handles as string[]), ...(oldHandles as string[])])];
  if (allHandles.length) {
    const productKeys = allHandles.map((h) => redisKey(h));
    try {
      const deleted = await cacheDelete(...productKeys);
      result.redis += deleted;
      result.details.push(...productKeys.map((k) => ({ key: k, deleted: 1 })));
    } catch {
      // Never fail the write because Redis is unreachable.
    }
  }
  if (scope === "reviews" || scope === "product") {
    const reviewKeys = ids.map((id) => `catalog:reviews:v1:${id}`);
    if (reviewKeys.length) {
      try {
        const deleted = await cacheDelete(...reviewKeys);
        result.redis += deleted;
        result.details.push(...reviewKeys.map((k) => ({ key: k, deleted: 1 })));
      } catch {
        // Never fail the write because Redis is unreachable.
      }
  }
  if (scope === "product" || scope === "stock") {
    try {
      invalidateCatalogCache();
      result.catalog = true;
    } catch {
      // invalidateCatalogCache never throws.
    }
  }
  const paths = new Set<string>();
  const productPages = new Set<string>();
  for (const h of allHandles) {
    productPages.add(`/collections/succulents/${h}`);
    productPages.add(`/products/${h}`);
  }
  for (const p of [
    "/",
    "/shop",
    "/collections",
    "/collections/succulents",
    "/collections/beginner-friendly",
    "/collections/cactus",
    "/collections/pots",
    "/collections/succulents-under-40",
    "/combo",
    "/combo-builder",
    "/api/products",
    "/api/filters",
  ] as string[];
  for (const p of productPages) {
    paths.add(p);
  }
  for (const h of allHandles) {
    paths.add(`/collections/${h}`);
    paths.add(`/collections/${h}/:path*`);
  }
  for (const p of paths) {
    result.paths.push(p);
    try {
      revalidatePath(p);
    } catch {
      // Non-critical.
    }
  }
  return result;
}
export async function fetchProductHandlesForStaticGenerationFromRedis(): Promise<string[]> {
  try {
    const cached = await cacheGet<ReturnType<typeof mapProduct>[]>("catalog:products:v1");
    if (Array.isArray(cached) && cached.length) {
      const handles = cached.map((item) => string(item?.handle).trim()).filter(Boolean);
      if (handles.length) return handles;
    }
  } catch {
    // Fall through to Firestore.
  }
  try {
    return await fetchProductHandlesForStaticGeneration();
  } catch {
    return [];
  }
  return [];
}
export async function flushProductCatalogCache(): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del("catalog:product:v1", "catalog:products:v1");
    } catch {
      // Non-critical.
    }
  }
  return;
}
