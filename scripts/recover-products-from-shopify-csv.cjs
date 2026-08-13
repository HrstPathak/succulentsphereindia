const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const DEFAULT_CSV = "C:\\Users\\hpath\\Downloads\\products_updated_seo_faq.csv";
const WORKSPACE = process.cwd();
const DEFAULT_IMAGE_DIR = path.join(WORKSPACE, "public", "recovered-product-images-2");
const DEFAULT_OUT_DIR = path.join(WORKSPACE, "tmp", "product-recovery");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const options = {
  csvPath: argValue("--csv", DEFAULT_CSV),
  imageDir: argValue("--image-dir", DEFAULT_IMAGE_DIR),
  outDir: argValue("--out-dir", DEFAULT_OUT_DIR),
  downloadImages: hasFlag("--download-images"),
  apply: hasFlag("--apply"),
  createMissing: hasFlag("--create-missing"),
  limit: Number(argValue("--limit", "0")) || 0,
  mediaBaseUrl: String(process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "").replace(/\/$/, ""),
};

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: required("FIREBASE_PROJECT_ID"),
        clientEmail: required("FIREBASE_CLIENT_EMAIL"),
        privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((values) => values.some((value) => String(value || "").trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function clean(value, fallback = "") {
  const text = value == null ? fallback : String(value);
  return text.replace(/\r/g, "").trim();
}

function cleanHtml(html) {
  return clean(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function number(value, fallback = 0) {
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value) {
  const text = clean(value);
  if (!text) return null;
  const parsed = number(text, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolFromCsv(value, fallback = true) {
  const text = clean(value).toLowerCase();
  if (!text) return fallback;
  return ["true", "1", "yes", "active"].includes(text);
}

function listFromCsv(value) {
  return clean(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugPart(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function filenameForImage(handle, sourceUrl, position) {
  let basename = "";
  try {
    basename = decodeURIComponent(path.basename(new URL(sourceUrl).pathname));
  } catch {
    basename = `${handle}-${position}.jpg`;
  }
  const ext = path.extname(basename) || ".jpg";
  const stem = slugPart(path.basename(basename, ext)) || `${handle}-${position}`;
  return `${position}-${stem}${ext.toLowerCase()}`;
}

function publicProductUrl(handle, filename) {
  if (!options.mediaBaseUrl) return `/recovered-product-images-2/${handle}/${filename}`;
  return `${options.mediaBaseUrl}/products/${handle}/${filename}`;
}

function parseFaqs(value) {
  const text = clean(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        question: clean(item && item.question).slice(0, 300),
        answer: clean(item && item.answer).slice(0, 2000),
      }))
      .filter((item) => item.question && item.answer)
      .slice(0, 10);
  } catch {
    return [];
  }
}

function firstNonEmpty(rows, column) {
  for (const row of rows) {
    const value = clean(row[column]);
    if (value) return value;
  }
  return "";
}

function groupProducts(rows) {
  const byHandle = new Map();
  for (const row of rows) {
    const handle = clean(row.Handle).toLowerCase();
    if (!handle) continue;
    if (!byHandle.has(handle)) byHandle.set(handle, []);
    byHandle.get(handle).push(row);
  }

  return [...byHandle.entries()].map(([handle, rowsForHandle]) => {
    const title = firstNonEmpty(rowsForHandle, "Title");
    const imageRows = rowsForHandle
      .map((row, index) => ({
        sourceUrl: clean(row["Image Src"]),
        altText: clean(row["Image Alt Text"]),
        position: number(row["Image Position"], index + 1) || index + 1,
      }))
      .filter((image) => image.sourceUrl);

    const seen = new Set();
    const images = imageRows
      .sort((a, b) => a.position - b.position)
      .filter((image) => {
        if (seen.has(image.sourceUrl)) return false;
        seen.add(image.sourceUrl);
        return true;
      })
      .map((image, index) => {
        const position = index + 1;
        const filename = filenameForImage(handle, image.sourceUrl, position);
        return {
          ...image,
          position,
          filename,
          relativePath: `${handle}/${filename}`,
          finalUrl: publicProductUrl(handle, filename),
        };
      });

    const status = clean(firstNonEmpty(rowsForHandle, "Status"), "active").toLowerCase();
    const inventoryQuantity = Math.max(0, Math.floor(number(firstNonEmpty(rowsForHandle, "Variant Inventory Qty"), 0)));
    const productType = firstNonEmpty(rowsForHandle, "Type") || "General";

    return {
      handle,
      title,
      descriptionHtml: firstNonEmpty(rowsForHandle, "Body (HTML)"),
      description: cleanHtml(firstNonEmpty(rowsForHandle, "Body (HTML)")),
      vendor: firstNonEmpty(rowsForHandle, "Vendor") || "Succulent Sphere",
      productCategory: firstNonEmpty(rowsForHandle, "Product Category"),
      productType,
      type: productType,
      tags: listFromCsv(firstNonEmpty(rowsForHandle, "Tags")),
      published: boolFromCsv(firstNonEmpty(rowsForHandle, "Published"), true),
      price: number(firstNonEmpty(rowsForHandle, "Variant Price"), 0),
      compareAtPrice: nullableNumber(firstNonEmpty(rowsForHandle, "Variant Compare At Price")),
      inventoryQuantity,
      quantity: inventoryQuantity,
      totalInventory: inventoryQuantity,
      available: inventoryQuantity > 0 && status !== "draft" && status !== "archived",
      status: ["active", "draft", "archived", "unlisted"].includes(status) ? status : "active",
      currency: "INR",
      image: images[0]?.finalUrl || "",
      imageAlt: images[0]?.altText || title,
      images: images.map((image) => ({ url: image.finalUrl, altText: image.altText || title })),
      imageAlts: images.map((image) => image.altText || title),
      seoTitle: firstNonEmpty(rowsForHandle, "SEO Title"),
      seoDescription: firstNonEmpty(rowsForHandle, "SEO Description"),
      faqs: parseFaqs(firstNonEmpty(rowsForHandle, "Product FAQs (product.metafields.custom.product_faqs)")),
      plantGenus: firstNonEmpty(rowsForHandle, "Plant Genus (product.metafields.custom.plant_genus)"),
      plantClass: firstNonEmpty(rowsForHandle, "Plant class (product.metafields.shopify.plant-class)"),
      suitableSpace: firstNonEmpty(rowsForHandle, "Suitable space (product.metafields.shopify.suitable-space)"),
      sunlight: firstNonEmpty(rowsForHandle, "Sunlight (product.metafields.shopify.sunlight)"),
      recoveredImageSources: images.map((image) => ({
        sourceUrl: image.sourceUrl,
        altText: image.altText,
        relativePath: image.relativePath,
        finalUrl: image.finalUrl,
      })),
      source: {
        type: "shopify-csv-recovery",
        csvFile: path.basename(options.csvPath),
      },
    };
  });
}

async function fetchFirebaseProducts() {
  const snapshot = await getDb().collection("products").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function indexCurrent(products) {
  const byHandle = new Map();
  const byTitle = new Map();
  for (const product of products) {
    const handle = clean(product.handle || product.id).toLowerCase();
    const title = clean(product.title).toLowerCase();
    if (handle) byHandle.set(handle, product);
    if (title) byTitle.set(title, product);
  }
  return { byHandle, byTitle };
}

function buildUpdate(product) {
  return {
    title: product.title,
    handle: product.handle,
    description: product.description,
    descriptionHtml: product.descriptionHtml,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    inventoryQuantity: product.inventoryQuantity,
    quantity: product.quantity,
    totalInventory: product.totalInventory,
    available: product.available,
    status: product.status,
    tags: product.tags,
    vendor: product.vendor,
    productType: product.productType,
    type: product.type,
    productCategory: product.productCategory,
    image: product.image,
    imageAlt: product.imageAlt,
    images: product.images,
    imageAlts: product.imageAlts,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    faqs: product.faqs,
    plantGenus: product.plantGenus,
    plantClass: product.plantClass,
    suitableSpace: product.suitableSpace,
    sunlight: product.sunlight,
    recoveredImageSources: product.recoveredImageSources,
    recoverySource: product.source,
    updatedAt: new Date().toISOString(),
  };
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] || {});
  const escape = (value) => `"${String(value == null ? "" : value).replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

async function downloadImages(products, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];
  let downloaded = 0;
  let reused = 0;
  let failed = 0;

  for (const product of products) {
    for (const image of product.recoveredImageSources) {
      const target = path.join(outDir, image.relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (fs.existsSync(target) && fs.statSync(target).size > 0) {
        reused += 1;
        manifest.push({ handle: product.handle, ...image, localPath: target, status: "reused" });
        continue;
      }
      try {
        const response = await fetch(image.sourceUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(target, buffer);
        downloaded += 1;
        manifest.push({ handle: product.handle, ...image, localPath: target, bytes: buffer.length, status: "downloaded" });
      } catch (error) {
        failed += 1;
        manifest.push({ handle: product.handle, ...image, localPath: target, status: "failed", error: error.message });
      }
    }
  }

  const manifestPath = path.join(outDir, "image-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ downloadedAt: new Date().toISOString(), images: manifest }, null, 2));
  return { downloaded, reused, failed, manifestPath };
}

async function commitUpdates(matches) {
  const db = getDb();
  let batch = db.batch();
  let batchCount = 0;
  let written = 0;
  for (const match of matches) {
    const ref = db.collection("products").doc(match.docId);
    const payload = {
      ...buildUpdate(match.csvProduct),
      createdAt: match.exists ? match.current.createdAt || FieldValue.serverTimestamp() : new Date().toISOString(),
    };
    if (match.exists && clean(match.current.handle)) {
      payload.handle = clean(match.current.handle);
    }
    batch.set(ref, payload, { merge: true });
    batchCount += 1;
    written += 1;
    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount) await batch.commit();
  return written;
}

async function main() {
  if (!fs.existsSync(options.csvPath)) throw new Error(`CSV not found: ${options.csvPath}`);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(options.outDir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const csvRows = parseCsv(fs.readFileSync(options.csvPath, "utf8"));
  let csvProducts = groupProducts(csvRows).filter((product) => product.handle && product.title);
  if (options.limit > 0) csvProducts = csvProducts.slice(0, options.limit);

  const currentProducts = await fetchFirebaseProducts();
  fs.writeFileSync(path.join(runDir, "firebase-products-before.json"), JSON.stringify(currentProducts, null, 2));
  fs.writeFileSync(path.join(runDir, "csv-products-parsed.json"), JSON.stringify(csvProducts, null, 2));

  const currentIndex = indexCurrent(currentProducts);
  const report = [];
  const exactMatches = [];
  const titleMatches = [];
  const missing = [];

  for (const csvProduct of csvProducts) {
    const exact = currentIndex.byHandle.get(csvProduct.handle);
    const byTitle = currentIndex.byTitle.get(csvProduct.title.toLowerCase());
    const current = exact || byTitle || null;
    const matchType = exact ? "handle" : byTitle ? "title" : "missing";
    const row = {
      handle: csvProduct.handle,
      title: csvProduct.title,
      matchType,
      firebaseId: current?.id || "",
      currentHandle: current?.handle || "",
      currentTitle: current?.title || "",
      imageCount: csvProduct.recoveredImageSources.length,
      faqCount: csvProduct.faqs.length,
      price: csvProduct.price,
      compareAtPrice: csvProduct.compareAtPrice ?? "",
      status: csvProduct.status,
    };
    report.push(row);
    if (exact) exactMatches.push({ csvProduct, current, docId: exact.id, exists: true });
    else if (byTitle) titleMatches.push({ csvProduct, current, docId: byTitle.id, exists: true });
    else missing.push({ csvProduct, current: null, docId: csvProduct.handle, exists: false });
  }

  fs.writeFileSync(path.join(runDir, "match-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(runDir, "match-report.csv"), toCsv(report));

  let imageResult = null;
  if (options.downloadImages) {
    imageResult = await downloadImages(csvProducts, options.imageDir);
  }

  let written = 0;
  if (options.apply) {
    const updates = [...exactMatches, ...titleMatches, ...(options.createMissing ? missing : [])];
    written = await commitUpdates(updates);
  }

  const summary = {
    csvRows: csvRows.length,
    csvProducts: csvProducts.length,
    firebaseProductsBefore: currentProducts.length,
    exactHandleMatches: exactMatches.length,
    titleOnlyMatches: titleMatches.length,
    missingProducts: missing.length,
    createMissing: options.createMissing,
    applied: options.apply,
    firebaseWrites: written,
    imageResult,
    runDir,
    imageDir: options.imageDir,
  };
  fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
