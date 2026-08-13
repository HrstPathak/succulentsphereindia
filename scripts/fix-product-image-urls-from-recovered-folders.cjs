const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const WORKSPACE = process.cwd();
const OUT_DIR = path.join(WORKSPACE, "tmp", "product-image-url-fix");

const IMAGE_ROOTS = [
  {
    label: "recovered-product-images-2-products",
    dir: path.join(WORKSPACE, "public", "recovered-product-images-2-products"),
    publicBase: "/recovered-product-images-2-products",
  },
  {
    label: "recovered-product-images-2",
    dir: path.join(WORKSPACE, "public", "recovered-product-images-2"),
    publicBase: "/recovered-product-images-2",
  },
  {
    label: "recovered-product-images",
    dir: path.join(WORKSPACE, "public", "recovered-product-images"),
    publicBase: "/recovered-product-images",
  },
];

const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const options = {
  apply: hasFlag("--apply"),
  verifyRemote: hasFlag("--verify-remote"),
  limit: Number(argValue("--limit", "0")) || 0,
  mediaBaseUrl: clean(
    argValue("--media-base-url", process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://whitesmoke-cattle-754161.hostingersite.com")
  ).replace(/\/+$/, ""),
};

const remoteOkCache = new Map();

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

function clean(value) {
  return String(value || "").trim();
}

function publicUrlFor(root, relativePath) {
  return `${options.mediaBaseUrl}/products/${relativePath}`;
}

async function remoteUrlLoads(url) {
  if (!options.verifyRemote) return true;
  if (remoteOkCache.has(url)) return remoteOkCache.get(url);

  let ok = false;
  try {
    const response = await fetch(url, { method: "HEAD" });
    ok = response.ok;
  } catch {
    ok = false;
  }

  remoteOkCache.set(url, ok);
  return ok;
}

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile() && isImageFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeRelativePath(value) {
  return clean(value).replace(/\\/g, "/").replace(/^\/+/, "");
}

function fileSortKey(publicUrl) {
  const filename = path.posix.basename(publicUrl);
  const match = filename.match(/^(\d+)[-_]/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function buildImageIndex() {
  const byRelativePath = new Map();
  const byHandle = new Map();

  for (const root of IMAGE_ROOTS) {
    for (const fullPath of walkFiles(root.dir)) {
      const relativePath = normalizeRelativePath(path.relative(root.dir, fullPath));
      const publicUrl = publicUrlFor(root, relativePath);
      const handle = relativePath.split("/")[0] || "";
      const entry = { ...root, relativePath, publicUrl, handle };

      if (!byRelativePath.has(relativePath)) byRelativePath.set(relativePath, entry);
      if (!byHandle.has(handle)) byHandle.set(handle, []);
      byHandle.get(handle).push(entry);
    }
  }

  for (const entries of byHandle.values()) {
    entries.sort((a, b) => fileSortKey(a.publicUrl) - fileSortKey(b.publicUrl) || a.publicUrl.localeCompare(b.publicUrl));
  }

  return { byRelativePath, byHandle };
}

function extractRelativeCandidates(value) {
  const raw = clean(value);
  if (!raw) return [];
  const candidates = [];

  try {
    const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw, "https://local.invalid");
    const pathname = decodeURIComponent(parsed.pathname).replace(/\\/g, "/");
    const publicRoot = IMAGE_ROOTS.find((root) => pathname.startsWith(`${root.publicBase}/`));
    if (publicRoot) candidates.push(pathname.slice(publicRoot.publicBase.length + 1));
    if (pathname.startsWith("/products/")) candidates.push(pathname.slice("/products/".length));
  } catch {
    // Keep going with the raw value below.
  }

  const normalized = normalizeRelativePath(raw);
  for (const root of IMAGE_ROOTS) {
    if (normalized.startsWith(`${root.publicBase.slice(1)}/`)) {
      candidates.push(normalized.slice(root.publicBase.length));
    }
  }
  if (normalized.startsWith("products/")) candidates.push(normalized.slice("products/".length));

  return [...new Set(candidates.map(normalizeRelativePath).filter(Boolean))];
}

async function firstLoadingEntry(entries) {
  for (const entry of entries) {
    if (await remoteUrlLoads(entry.publicUrl)) return entry;
  }
  return null;
}

async function resolveImageUrl(value, product, imageIndex) {
  for (const candidate of extractRelativeCandidates(value)) {
    const exact = imageIndex.byRelativePath.get(candidate);
    if (exact && (await remoteUrlLoads(exact.publicUrl))) {
      return { url: exact.publicUrl, source: exact.label, matched: candidate };
    }
  }

  const handle = clean(product.handle || product.id).toLowerCase();
  const firstForHandle = await firstLoadingEntry(imageIndex.byHandle.get(handle) || []);
  if (firstForHandle) {
    return { url: firstForHandle.publicUrl, source: firstForHandle.label, matched: firstForHandle.relativePath };
  }

  return null;
}

async function normalizeImageEntry(entry, product, imageIndex) {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const resolved = await resolveImageUrl(entry.url, product, imageIndex);
    if (!resolved) return { next: entry, resolved: null };
    return { next: { ...entry, url: resolved.url }, resolved };
  }

  const resolved = await resolveImageUrl(entry, product, imageIndex);
  return { next: resolved?.url || entry, resolved };
}

function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function buildProductPatch(product, imageIndex) {
  const images = Array.isArray(product.images) ? product.images : [];
  const normalizedImages = [];
  for (const entry of images) {
    normalizedImages.push(await normalizeImageEntry(entry, product, imageIndex));
  }
  const nextImages = normalizedImages.map((item) => item.next).filter((item) => {
    if (item && typeof item === "object") return clean(item.url);
    return clean(item);
  });

  const primaryResolved = await resolveImageUrl(product.image, product, imageIndex);
  const firstImageUrl = nextImages[0] && typeof nextImages[0] === "object" ? nextImages[0].url : nextImages[0];
  const nextImage = primaryResolved?.url || clean(firstImageUrl) || product.image;

  const patch = {};
  if (clean(product.image) !== clean(nextImage)) patch.image = nextImage;
  if (nextImages.length && !valuesEqual(product.images, nextImages)) patch.images = nextImages;

  if (!Object.keys(patch).length) return null;

  patch.updatedAt = new Date().toISOString();
  return {
    patch,
    resolved: [primaryResolved, ...normalizedImages.map((item) => item.resolved)].filter(Boolean),
  };
}

async function main() {
  const imageIndex = buildImageIndex();
  const snapshot = await getDb().collection("products").get();
  let products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (options.limit > 0) products = products.slice(0, options.limit);

  const updates = [];
  const unresolved = [];

  for (const product of products) {
    const result = await buildProductPatch(product, imageIndex);
    if (result) {
      updates.push({
        id: product.id,
        handle: product.handle || "",
        title: product.title || "",
        before: { image: product.image, images: product.images || [] },
        after: result.patch,
        resolved: result.resolved,
      });
      continue;
    }

    if (!(await resolveImageUrl(product.image, product, imageIndex))) {
      unresolved.push({
        id: product.id,
        handle: product.handle || "",
        title: product.title || "",
        image: product.image || "",
      });
    }
  }

  if (options.apply && updates.length) {
    const db = getDb();
    let batch = db.batch();
    let count = 0;
    for (const update of updates) {
      batch.set(db.collection("products").doc(update.id), update.after, { merge: true });
      count += 1;
      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count) await batch.commit();
  }

  const runDir = path.join(OUT_DIR, new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "updates.json"), JSON.stringify(updates, null, 2));
  fs.writeFileSync(path.join(runDir, "unresolved.json"), JSON.stringify(unresolved, null, 2));

  const summary = {
    applied: options.apply,
    verifiedRemoteUrls: options.verifyRemote,
    mediaBaseUrl: options.mediaBaseUrl,
    productsChecked: products.length,
    productsToUpdate: updates.length,
    unresolvedProducts: unresolved.length,
    imageRoots: IMAGE_ROOTS.map((root) => ({
      label: root.label,
      exists: fs.existsSync(root.dir),
      files: walkFiles(root.dir).length,
    })),
    runDir,
  };
  fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
