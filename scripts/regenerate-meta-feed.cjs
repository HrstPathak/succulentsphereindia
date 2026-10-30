/**
 * regenerate-meta-feed.cjs
 *
 * Standalone script that regenerates the Meta catalog CSV feed directly from
 * Firestore, using the same logic as /api/meta/catalog/route.ts.
 * This ensures corrected product image URLs are included in the feed that
 * Meta/WhatsApp reads.
 *
 * Run: node --env-file=.env.local scripts/regenerate-meta-feed.cjs
 */

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const text = (value) => String(value || "").trim();
const projectId = text(process.env.FIREBASE_PROJECT_ID);
const clientEmail = text(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || "https://succulentsphere.com").trim().replace(/\/$/, "");

const app = getApps()[0] || initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore(app);

function csv(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function textFromHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

function absoluteUrl(value, siteUrl) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, siteUrl).toString();
  } catch {
    return "";
  }
}

function normalizeRetailerId(value) {
  const raw = String(value ?? "").trim();
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "product";
}

async function main() {
  console.log("Fetching all products from Firestore for Meta feed regeneration...");
  const snapshot = await db.collection("products").limit(2000).get();
  const products = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

  console.log(`Found ${products.length} product(s). Generating CSV...\n`);

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
    .filter(
      (product) =>
        String(product.status || "").toLowerCase() !== "draft" &&
        String(product.status || "").toLowerCase() !== "archived" &&
        String(product.status || "").toLowerCase() !== "unlisted"
    )
    .filter(
      (product) =>
        (product.handle || product.id) &&
        (product.title || product.name) &&
        product.image
    )
    .map((product) => {
      const salePrice = Number(product.price);
      const mainPrice = Number(product.compareAtPrice ?? product.price);
      const soldOut =
        String(product.status || "").toLowerCase() === "sold out" ||
        String(product.status || "").toLowerCase() === "out of stock" ||
        product.available === false ||
        Number(product.inventoryQuantity ?? product.quantity ?? 0) <= 0;
      const inStock = !soldOut;
      const displayPrice = Number.isFinite(mainPrice) && mainPrice > 0 ? mainPrice : salePrice;
      const discountedPrice =
        Number.isFinite(salePrice) && salePrice > 0 ? salePrice : displayPrice;
      const retailerId = normalizeRetailerId(
        product.handle || product.id || product.title || product.name
      );

      return [
        retailerId,
        product.title || product.name || "",
        textFromHtml(product.descriptionHtml || product.description || product.title || product.name),
        inStock ? "in stock" : "out of stock",
        "new",
        `${Number.isFinite(displayPrice) ? displayPrice.toFixed(2) : "0.00"} INR`,
        Number.isFinite(discountedPrice) &&
        Number(product.compareAtPrice ?? 0) > 0 &&
        discountedPrice < displayPrice
          ? `${discountedPrice.toFixed(2)} INR`
          : "",
        absoluteUrl(
          `/products/${encodeURIComponent(String(product.handle || product.id || ""))}`,
          siteUrl
        ),
        absoluteUrl(product.image, siteUrl),
        String(product.vendor || "Succulent Sphere"),
        String(product.productType || product.type || "Plants"),
      ].map(csv).join(",");
    });

  const csvText = [columns.join(","), ...rows].join("\n");

  console.log(`Generated CSV with ${rows.length} product row(s).`);
  console.log(`CSV size: ${Buffer.byteLength(csvText, "utf8")} bytes`);
  console.log(`\nSample first 3 rows:`);
  const lines = csvText.split("\n");
  lines.slice(0, 4).forEach((line, i) => {
    console.log(`  ${i}: ${line.substring(0, 200)}${line.length > 200 ? "..." : ""}`);
  });

  // Show a few image_link values to confirm they're valid URLs
  console.log(`\nSample image_link values:`);
  rows.slice(0, 5).forEach((row) => {
    const cols = row.split(",");
    const imageLink = cols[10] ? cols[10].replace(/^"|"$/g, "") : "";
    console.log(`  ${imageLink}`);
  });
}

main().catch((error) => {
  console.error("Error regenerating Meta feed:", error);
  process.exitCode = 1;
});