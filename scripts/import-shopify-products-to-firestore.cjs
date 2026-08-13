/*
 * Imports a Shopify product CSV into Firestore.
 *
 * Usage:
 *   node scripts/import-shopify-products-to-firestore.cjs "C:\path\products.csv" --dry-run
 *   node scripts/import-shopify-products-to-firestore.cjs "C:\path\products.csv" --confirm
 *
 * Active products receive an initial inventory quantity of 100. Unlisted products
 * are retained but unavailable. The source inventory is saved for later review.
 */

const fs = require("node:fs");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function parseCsv(input) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted && char === '"' && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(value);
      value = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.length > 0)) rows.push(row);

  const [headers, ...dataRows] = rows;
  return dataRows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function text(value) {
  return String(value || "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tags(value) {
  return text(value).split(",").map((tag) => tag.trim()).filter(Boolean);
}

function plainText(html) {
  return text(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseFaqs(value) {
  const source = text(value);
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toProduct(handle, rows) {
  const primary = rows.find((row) => text(row.Title) || text(row["Variant Price"])) || rows[0];
  const status = text(primary.Status).toLowerCase() || "active";
  const imageRows = rows.filter((row) => text(row["Image Src"]));
  const images = imageRows.map((row) => ({ url: text(row["Image Src"]), altText: text(row["Image Alt Text"]) || text(primary.Title) }));
  const sourceInventory = number(primary["Variant Inventory Qty"]);
  const active = status === "active";

  return {
    id: handle,
    handle,
    title: text(primary.Title),
    description: plainText(primary["Body (HTML)"]),
    descriptionHtml: text(primary["Body (HTML)"]),
    price: number(primary["Variant Price"]),
    compareAtPrice: text(primary["Variant Compare At Price"]) ? number(primary["Variant Compare At Price"]) : null,
    currency: "INR",
    image: images[0]?.url || "",
    imageAlt: images[0]?.altText || text(primary.Title),
    images,
    inventoryQuantity: active ? 100 : 0,
    sourceInventoryQuantity: sourceInventory,
    available: active,
    status,
    productType: text(primary.Type) || "General",
    type: text(primary.Type) || "General",
    category: text(primary["Product Category"]),
    tags: tags(primary.Tags),
    collections: [],
    vendor: text(primary.Vendor),
    plantGenus: text(primary["Plant Genus (product.metafields.custom.plant_genus)"]),
    careLevel: tags(primary.Tags).some((tag) => tag.toLowerCase() === "beginner") ? "beginner" : "",
    faqs: parseFaqs(primary["Product FAQs (product.metafields.custom.product_faqs)"]),
    seoTitle: text(primary["SEO Title"]),
    seoDescription: text(primary["SEO Description"]),
    source: "shopify-csv",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
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

async function main() {
  const [csvPath, mode] = process.argv.slice(2);
  if (!csvPath || !["--dry-run", "--confirm"].includes(mode)) {
    throw new Error("Provide a CSV path and either --dry-run or --confirm.");
  }
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const grouped = new Map();
  for (const row of rows) {
    const handle = text(row.Handle);
    if (!handle) continue;
    grouped.set(handle, [...(grouped.get(handle) || []), row]);
  }

  const products = [...grouped.entries()].map(([handle, productRows]) => toProduct(handle, productRows));
  const active = products.filter((product) => product.available).length;
  const unlisted = products.length - active;
  const imageCount = products.reduce((count, product) => count + product.images.length, 0);
  console.log(JSON.stringify({ csvRows: rows.length, products: products.length, active, unlisted, imageCount, temporaryInventory: 100 }, null, 2));

  if (mode === "--dry-run") {
    console.log("Dry run complete. No Firestore documents were written.");
    return;
  }

  const db = firebaseDb();
  for (let index = 0; index < products.length; index += 400) {
    const batch = db.batch();
    for (const product of products.slice(index, index + 400)) {
      batch.set(db.collection("products").doc(product.id), product, { merge: true });
    }
    await batch.commit();
  }
  console.log(`Imported ${products.length} products into Firestore.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
