const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const workspace = process.cwd();
const oldDir = path.join(workspace, "public", "recovered-product-images");
const newDir = path.join(workspace, "public", "recovered-product-images-2");
const outBase = path.join(workspace, "tmp", "product-recovery", "filtered-images-2");
const oldManifestPath = path.join(oldDir, "image-manifest.json");
const newManifestPath = path.join(newDir, "image-manifest.json");

function assertInsideWorkspace(target) {
  const resolved = path.resolve(target);
  const root = path.resolve(workspace);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to modify path outside workspace: ${resolved}`);
  }
  return resolved;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else files.push(full);
  }
  return files;
}

function isImageFile(file) {
  const name = path.basename(file).toLowerCase();
  if (name === "image-manifest.json" || name === "products.zip") return false;
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(path.extname(name));
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function copyFileWithDirs(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function removeChildren(dir) {
  const resolved = assertInsideWorkspace(dir);
  for (const entry of fs.readdirSync(resolved)) {
    fs.rmSync(path.join(resolved, entry), { recursive: true, force: true });
  }
}

function main() {
  assertInsideWorkspace(oldDir);
  assertInsideWorkspace(newDir);
  assertInsideWorkspace(outBase);

  const oldManifest = fs.existsSync(oldManifestPath) ? readJson(oldManifestPath) : { images: [] };
  const newManifest = fs.existsSync(newManifestPath) ? readJson(newManifestPath) : { images: [] };

  const oldSourceUrls = new Set((oldManifest.images || []).map((item) => normalizeUrl(item.sourceUrl)).filter(Boolean));
  const oldHashes = new Set(walkFiles(oldDir).filter(isImageFile).map(hashFile));

  const runDir = path.join(outBase, new Date().toISOString().replace(/[:.]/g, "-"));
  const filteredDir = path.join(runDir, "recovered-product-images-2");
  fs.mkdirSync(filteredDir, { recursive: true });

  const kept = [];
  const skipped = [];

  for (const item of newManifest.images || []) {
    const relativePath = String(item.relativePath || "").replaceAll("\\", "/");
    if (!relativePath || relativePath.includes("..")) {
      skipped.push({ ...item, reason: "invalid-relative-path" });
      continue;
    }

    const source = path.join(newDir, relativePath);
    if (!fs.existsSync(source)) {
      skipped.push({ ...item, reason: "missing-local-file" });
      continue;
    }

    const sourceUrl = normalizeUrl(item.sourceUrl);
    const hash = hashFile(source);
    if (oldSourceUrls.has(sourceUrl)) {
      skipped.push({ ...item, reason: "source-url-already-in-original" });
      continue;
    }
    if (oldHashes.has(hash)) {
      skipped.push({ ...item, reason: "file-hash-already-in-original" });
      continue;
    }

    copyFileWithDirs(source, path.join(filteredDir, relativePath));
    kept.push({ ...item, status: "kept-new" });
  }

  const filteredManifest = {
    filteredAt: new Date().toISOString(),
    comparedAgainst: "public/recovered-product-images",
    images: kept,
    skipped,
  };
  fs.writeFileSync(path.join(filteredDir, "image-manifest.json"), JSON.stringify(filteredManifest, null, 2));
  fs.writeFileSync(path.join(runDir, "filter-summary.json"), JSON.stringify({
    oldImageFiles: walkFiles(oldDir).filter(isImageFile).length,
    originalImages2: (newManifest.images || []).length,
    kept: kept.length,
    skipped: skipped.length,
    skippedByReason: skipped.reduce((acc, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
      return acc;
    }, {}),
    runDir,
    filteredDir,
  }, null, 2));

  removeChildren(newDir);
  for (const file of walkFiles(filteredDir)) {
    const relative = path.relative(filteredDir, file);
    copyFileWithDirs(file, path.join(newDir, relative));
  }

  console.log(fs.readFileSync(path.join(runDir, "filter-summary.json"), "utf8"));
}

main();
