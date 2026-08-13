/*
 * Recovers hardcoded Shopify CDN images and videos used by site components.
 *
 * Usage:
 *   node scripts/download-shopify-site-assets.cjs --dry-run
 *   node scripts/download-shopify-site-assets.cjs --confirm
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const sourceRoot = path.join(process.cwd(), "src");
const outputRoot = path.join(process.cwd(), "public", "recovered-site-assets");
const assetPattern = /https:\/\/cdn\.shopify\.com\/[^\s"'`)]+/g;

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function cleanUrl(value) {
  return value.replace(/[;,]+$/, "");
}

function destinationFor(url) {
  const parsed = new URL(url);
  const extension = path.extname(parsed.pathname) || ".bin";
  const basename = path.basename(parsed.pathname, extension).replace(/[^a-zA-Z0-9._-]+/g, "-") || "asset";
  const digest = crypto.createHash("sha256").update(url).digest("hex").slice(0, 10);
  const isVideo = /\.(mp4|webm|mov)$/i.test(extension);
  return path.posix.join(isVideo ? "videos" : "images", `${digest}-${basename}${extension.toLowerCase()}`);
}

function discoverAssets() {
  const references = new Map();
  for (const sourceFile of sourceFiles(sourceRoot)) {
    const text = fs.readFileSync(sourceFile, "utf8");
    for (const match of text.matchAll(assetPattern)) {
      const url = cleanUrl(match[0]);
      references.set(url, [...(references.get(url) || []), path.relative(process.cwd(), sourceFile)]);
    }
  }
  return [...references.entries()].map(([sourceUrl, sources]) => ({ sourceUrl, sources, relativePath: destinationFor(sourceUrl) }));
}

async function main() {
  const mode = process.argv[2];
  if (!["--dry-run", "--confirm"].includes(mode)) throw new Error("Use --dry-run or --confirm.");
  const assets = discoverAssets();
  console.log(JSON.stringify({ assets: assets.length, outputDirectory: outputRoot }, null, 2));
  if (mode === "--dry-run") return console.log("Dry run complete. No assets were downloaded.");

  fs.mkdirSync(outputRoot, { recursive: true });
  const downloaded = []; const failures = [];
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index]; const destination = path.join(outputRoot, asset.relativePath);
    process.stdout.write(`[${index + 1}/${assets.length}] ${asset.relativePath}\n`);
    try {
      const response = await fetch(asset.sourceUrl, { redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
      downloaded.push(asset);
    } catch (error) { failures.push({ ...asset, error: error.message }); }
  }
  fs.writeFileSync(path.join(outputRoot, "site-asset-manifest.json"), JSON.stringify({ downloadedAt: new Date().toISOString(), assets: downloaded, failures }, null, 2));
  console.log(JSON.stringify({ downloaded: downloaded.length, failed: failures.length }, null, 2));
  if (failures.length) process.exitCode = 2;
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
