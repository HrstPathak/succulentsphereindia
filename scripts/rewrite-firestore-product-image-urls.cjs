/*
 * Replaces the Shopify CDN URLs in Firestore product documents with the
 * recovered files hosted on a static site.
 *
 * Usage:
 *   node --env-file=.env.local scripts/rewrite-firestore-product-image-urls.cjs --base-url=https://example.com --dry-run
 *   node --env-file=.env.local scripts/rewrite-firestore-product-image-urls.cjs --base-url=https://example.com --confirm
 *
 * The script only rewrites URLs found in image-manifest.json. Shopify URLs
 * without a downloaded local copy are left unchanged and reported.
 */

const fs = require("node:fs");
const path = require("node:path");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const manifestPath = path.join(process.cwd(), "public", "recovered-product-images", "image-manifest.json");

function text(value) {
  return String(value || "").trim();
}

function firebaseDb() {
  const projectId = text(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = text(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in .env.local.");
  }

  const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getFirestore(app);
}

function parseArgs(args) {
  const baseArg = args.find((arg) => arg.startsWith("--base-url="));
  const mode = args.find((arg) => arg === "--dry-run" || arg === "--confirm");
  const baseUrl = text(baseArg?.slice("--base-url=".length)).replace(/\/+$/, "");
  if (!baseUrl || !/^https:\/\//i.test(baseUrl) || !mode) {
    throw new Error("Provide --base-url=https://your-media-host and either --dry-run or --confirm.");
  }
  return { baseUrl, mode };
}

function sourceMap(baseUrl) {
  if (!fs.existsSync(manifestPath)) throw new Error(`Image manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const mapping = new Map();
  for (const image of manifest.images || []) {
    if (text(image.sourceUrl) && text(image.relativePath)) {
      mapping.set(text(image.sourceUrl), `${baseUrl}/products/${image.relativePath.split("/").map(encodeURIComponent).join("/")}`);
    }
  }
  return mapping;
}

function rewriteUrl(url, mapping, baseUrl) {
  const value = text(url);
  const mapped = mapping.get(value);
  if (mapped) return mapped;

  // A later run can move the same /products/... files from a temporary host
  // to a permanent media domain without needing the original Shopify URL.
  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith("/products/")) return `${baseUrl}${parsed.pathname}`;
  } catch {
    // Not a URL we can rewrite.
  }
  return value;
}

function isShopifyUrl(value) {
  return /(^|\.)cdn\.shopify\.com\//i.test(text(value));
}

async function main() {
  const { baseUrl, mode } = parseArgs(process.argv.slice(2));
  const mapping = sourceMap(baseUrl);
  const db = firebaseDb();
  const snapshot = await db.collection("products").get();
  const updates = [];
  let matchedImages = 0;
  let unresolvedShopifyImages = 0;

  for (const document of snapshot.docs) {
    const product = document.data();
    const nextImage = rewriteUrl(product.image, mapping, baseUrl);
    const currentImages = Array.isArray(product.images) ? product.images : [];
    const nextImages = currentImages.map((image) => {
      const url = rewriteUrl(image?.url, mapping, baseUrl);
      if (url !== text(image?.url)) matchedImages += 1;
      if (isShopifyUrl(image?.url) && url === text(image?.url)) unresolvedShopifyImages += 1;
      return { ...image, url };
    });
    const primaryChanged = nextImage !== text(product.image);
    if (primaryChanged) matchedImages += 1;
    if (isShopifyUrl(product.image) && !primaryChanged) unresolvedShopifyImages += 1;

    if (primaryChanged || JSON.stringify(nextImages) !== JSON.stringify(currentImages)) {
      updates.push({ reference: document.ref, image: nextImage, images: nextImages });
    }
  }

  console.log(JSON.stringify({
    baseUrl,
    manifestMappings: mapping.size,
    firestoreProducts: snapshot.size,
    productsToUpdate: updates.length,
    imageFieldsRewritten: matchedImages,
    unresolvedShopifyImageFields: unresolvedShopifyImages,
    mode,
  }, null, 2));

  if (mode === "--dry-run") {
    console.log("Dry run complete. No Firestore documents were changed.");
    return;
  }

  for (let index = 0; index < updates.length; index += 400) {
    const batch = db.batch();
    for (const update of updates.slice(index, index + 400)) {
      batch.update(update.reference, {
        image: update.image,
        images: update.images,
        imageStorage: "hostinger-temporary",
        imageStorageUpdatedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }
  console.log(`Updated image URLs for ${updates.length} Firestore products.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
