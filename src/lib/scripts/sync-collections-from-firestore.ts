/**
 * sync-collections-from-firestore.ts
 *
 * CLI entry used to rewrite the product-to-collection bucket map after
 * manual Firestore edits, supserseded by the admin API sync endpoints
 * that call invalidateProductCaches() instead.
 *
 * Usage:
 *   node --experimental-strip-types src/lib/scripts/sync-collections-from-firestore.ts
 *
 * Reads the product collection under "collections" in Firestore, derives the
 * correct bucket handle for each product (the top-level bucket it belongs in),
 * diffs that against the bucket map stored on the product document, and writes
 * the updated document back — WITHOUT touching prices, images, or any other
 * data the storefront needs to see as-is.
 *
 * Safe to re-run: it is idempotent and only issues updates when the mapping
 * differs.
 */
import "server-only";

import { getFirebaseDb } from "@/lib/firebase-admin";
import {
  invalidateProductCaches,
  type Product,
} from "@/lib/product-cache";

/** Top-level buckets in this store. A product that is not in any of these
 * lands in "uncategorized". */
const BUCKETS = [
  "all",
  "beginner-friendly",
  "cactus",
  "pots",
  "succulents",
  "succulents-under-40",
  "combo",
  "gift", // not a Firestore bucket; additive only
] as const;

type Bucket = (typeof BUCKETS)[number];

/** Derive the correct bucket handle from a product's own tags / taxonomy. */
function deriveBucketHandle(product: Pick<Product, "tags" | "category">): string {
  const tags = (product.tags ?? []).map((t) => String(t).toLowerCase().trim());
  const category = String(product.category ?? "").toLowerCase().trim();

  const known = new Set<string>(BUCKETS);

  // 1) Explicit "bucket" tag (used by legacy admin data).
  const bucketTag = tags.find((t) => t === "bucket:all" || t === "bucket:beginner-friendly" || t === "bucket:cactus" || t === "bucket:pots" || t === "bucket:succulents" || t === "bucket:succulents-under-40");
  if (bucketTag) return bucketTag.replace("bucket:", "");

  // 2) Category keyword → bucket.
  if (category.includes("cactus") || category.includes("succulent")) return "succulents";
  if (category.includes("pot")) return "pots";
  if (category.includes("beginner") || category.includes("starter")) return "beginner-friendly";
  if (category.includes("combo") || category.includes("bundle")) return "combo";
  if (category.includes("gift")) return "gift";

  // 3) Fall back to the first tag that looks like a bucket.
  const tagBucket = tags.find((t) => known.has(t));
  if (tagBucket) return tagBucket;

  return "uncategorized";
}

/** Fetch every product from Firestore (pagination guard: 10k max docs). */
async function fetchAllProducts(): Promise<Product[]> {
  const batch = getFirebaseDb().collection("products").orderBy("createdAt").limit(500);
  const all: Product[] = [];
  let last: unknown = undefined;

  while (true) {
    const snapshot = await batch.get();
    const docs = snapshot.docs;
    if (docs.length === 0) break;

    all.push(...docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }) as Product));

    if (docs.length < 500 || all.length >= 10000) break;

    last = docs[docs.length - 1].data();
    const next = getFirebaseDb().collection("products").orderBy("createdAt").startAfter(last).limit(500);
    batch.get = next as unknown as () => Promise<import("firebase-admin").FirestoreQuerySnapshot>;
  }

  return all;
}

async function main(): Promise<void> {
  const products = await fetchAllProducts();

  const out: { handle: string; oldBucket: string | null; newBucket: string; action: "edited" }[] = [];
  let edits = 0;

  for (const product of products) {
    const handle = product.handle as string;
    if (!handle) continue;

    const expected = deriveBucketHandle(product);
    const current = (product as Product & { bucket?: unknown }).bucket;
    const oldBucket = typeof current === "string" ? current : null;

    if (oldBucket === expected) continue;

    const updated = { ...(product as Record<string, unknown>), bucket: expected };
    await getFirebaseDb().collection("products").doc(handle).set(updated as Record<string, unknown>, { merge: true });
    out.push({ handle, oldBucket, newBucket: expected, action: "edited" });
    edits++;
  }

  // Deduplicated, sorted by handle for a stable report.
  const report = out.sort((a, b) => a.handle.localeCompare(b.handle));

  console.log(`\n[${(new Date()).toISOString()}] sync-collections-from-firestore`);
  console.log(`products scanned : ${products.length}`);
  console.log(`buckets updated  : ${edits}\n`);

  for (const r of report) {
    console.log(`  ${r.handle.padEnd(40)} ${String(r.oldBucket ?? "").padEnd(14)} -> ${r.newBucket}`);
  }

  if (edits > 0) {
    // This is the write-path mapping command the ISS build job dispatched:
    // clear every product-scoped cache right after the Firestore writes
    // commit, so the rebuilt ISR pages never serve a stale bucket map.
    console.log("\n[INVALIDATE] invalidating product / stock / reviews caches for all updated handles...");
    await invalidateProductCaches({
      handles: report.map((r) => r.handle),
      scope: "product" as const,
    }, { includeSitemap: true });
    console.log("[INVALIDATE] done.\n");
  } else {
    console.log("[INVALIDATE] no changes to invalidate.\n");
  }

  console.log("done.");
}

main().catch((error) => {
  console.error("[sync-collections-from-firestore] fatal:", error);
  process.exitCode = 1;
});
