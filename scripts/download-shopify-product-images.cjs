/*
 * Downloads Shopify CDN images referenced by a Shopify product CSV.
 *
 * Usage:
 *   node scripts/download-shopify-product-images.cjs "C:\path\products.csv" public\recovered-product-images --dry-run
 *   node scripts/download-shopify-product-images.cjs "C:\path\products.csv" public\recovered-product-images --confirm
 */

const fs = require("node:fs");
const path = require("node:path");

function parseCsv(input) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]; const next = input[i + 1];
    if (quoted && char === '"' && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(value); value = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) { if (char === "\r" && next === "\n") i += 1; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ""; }
    else value += char;
  }
  row.push(value); if (row.some(Boolean)) rows.push(row);
  const [headers, ...data] = rows;
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function clean(value) { return String(value || "").trim(); }
function safeSegment(value) { return clean(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image"; }

function buildItems(rows) {
  const seen = new Set();
  return rows.flatMap((row) => {
    const sourceUrl = clean(row["Image Src"]); const handle = safeSegment(row.Handle);
    if (!sourceUrl || !handle || seen.has(sourceUrl)) return [];
    seen.add(sourceUrl);
    let sourceName = "image";
    try { sourceName = safeSegment(path.basename(new URL(sourceUrl).pathname)); } catch {}
    const position = clean(row["Image Position"]) || "0";
    return [{ handle, sourceUrl, altText: clean(row["Image Alt Text"]), relativePath: path.posix.join(handle, `${position}-${sourceName}`) }];
  });
}

async function main() {
  const [csvPath, outputDirectory, mode] = process.argv.slice(2);
  if (!csvPath || !outputDirectory || !["--dry-run", "--confirm"].includes(mode)) throw new Error("Provide a CSV path, output folder, and either --dry-run or --confirm.");
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);
  const items = buildItems(parseCsv(fs.readFileSync(csvPath, "utf8")));
  console.log(JSON.stringify({ images: items.length, products: new Set(items.map((item) => item.handle)).size, outputDirectory }, null, 2));
  if (mode === "--dry-run") return console.log("Dry run complete. No images were downloaded.");

  fs.mkdirSync(outputDirectory, { recursive: true });
  const failures = []; const manifest = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]; const destination = path.join(outputDirectory, item.relativePath);
    process.stdout.write(`[${i + 1}/${items.length}] ${item.relativePath}\n`);
    try {
      const response = await fetch(item.sourceUrl, { redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
      manifest.push(item);
    } catch (error) { failures.push({ ...item, error: error.message }); }
  }
  fs.writeFileSync(path.join(outputDirectory, "image-manifest.json"), JSON.stringify({ downloadedAt: new Date().toISOString(), images: manifest, failures }, null, 2));
  console.log(JSON.stringify({ downloaded: manifest.length, failed: failures.length, manifest: path.join(outputDirectory, "image-manifest.json") }, null, 2));
  if (failures.length) process.exitCode = 2;
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
