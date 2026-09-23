/* Dark-mode audit: which hardcoded colours exist in components, and which of
   them the globals.css `.dark ...` patch layer actually covers.
   Run: node tmp/dark-audit.cjs */
const fs = require("fs");
const path = require("path");

const ROOTS = ["src/app", "src/components"];
const EXT = new Set([".tsx", ".ts"]);
const files = [];

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.has(path.extname(e.name))) files.push(p);
  }
}
ROOTS.forEach(walk);

// --- what the CSS patch layer already covers -----------------------------
const css = fs.readFileSync("src/styles/globals.css", "utf8");
const coveredBg = new Set();
const coveredText = new Set();
const coveredBorder = new Set();
const ruleRe = /\.dark\s+\.(bg|text|border)-\\\[\\#([0-9a-fA-F]{3,8})\\\]/g;
let m;
while ((m = ruleRe.exec(css))) {
  const key = m[2].toLowerCase();
  (m[1] === "bg" ? coveredBg : m[1] === "text" ? coveredText : coveredBorder).add(key);
}

// --- scan components ------------------------------------------------------
const hexRe = /(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|placeholder|accent|caret|shadow)-\[(#[0-9a-fA-F]{3,8})\]/g;
const bgRe = /\bbg-\[#[0-9a-fA-F]{3,8}\]/g;
const textRe = /\btext-\[#[0-9a-fA-F]{3,8}\]/g;
const borderRe = /\bborder-\[#[0-9a-fA-F]{3,8}\]/g;
/* capture-group twins, used only for tallying distinct hex values */
const bgCap = /\bbg-\[#([0-9a-fA-F]{3,8})\]/g;
const textCap = /\btext-\[#([0-9a-fA-F]{3,8})\]/g;
const borderCap = /\bborder-\[#([0-9a-fA-F]{3,8})\]/g;
const grayRe = /\b(?:bg|text|border|divide)-(?:gray|slate|zinc|neutral|stone)-\d{2,3}\b/g;
const whiteRe = /\bbg-white(?:\/\d{1,3})?\b/g;
const darkVariantRe = /\bdark:/g;
const backdropRe = /\bbackdrop-blur/g;
const roundedBgRe = /rounded-[a-z0-9\[\]\/.]+\s[^"']*\bbg-|bg-[^"']*\brounded-/g;

const perFile = [];
const bgHexCount = new Map();
const textHexCount = new Map();
const borderHexCount = new Map();
const bgHexFiles = new Map();

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = f.split(path.sep).join("/");
  const count = (re) => (src.match(re) || []).length;
  const bgHex = count(bgRe);
  const textHex = count(textRe);
  const borderHex = count(borderRe);
  const gray = count(grayRe);
  const white = count(whiteRe);
  const darkV = count(darkVariantRe);
  const blur = count(backdropRe);
  const rows = bgHex + textHex + borderHex + gray + white;
  if (rows > 0) {
    perFile.push({
      file: rel,
      bgHex,
      textHex,
      borderHex,
      gray,
      white,
      total: rows,
      darkV,
      blur,
      roundedBg: count(roundedBgRe),
    });
  }
  let h;
  const collect = (re, map) => {
    re.lastIndex = 0;
    while ((h = re.exec(src))) {
      const hex = h[1].replace("#", "").toLowerCase();
      map.set(hex, (map.get(hex) || 0) + 1);
      if (!bgHexFiles.has(hex)) bgHexFiles.set(hex, new Set());
      bgHexFiles.get(hex).add(rel);
    }
  };
  collect(bgCap, bgHexCount);
  collect(textCap, textHexCount);
  collect(borderCap, borderHexCount);
}

const covered = (hex, set) => set.has(hex) || set.has(hex.slice(0, 3));

console.log("=".repeat(78));
console.log("DISTINCT bg-[#hex] IN COMPONENTS vs PATCH-LAYER COVERAGE");
console.log("=".repeat(78));
const bgSorted = [...bgHexCount.entries()].sort((a, b) => b[1] - a[1]);
let uncoveredBg = [];
for (const [hex, n] of bgSorted) {
  const ok = covered(hex, coveredBg);
  if (!ok) uncoveredBg.push([hex, n]);
  console.log(
    `${ok ? "  covered" : ">> MISSING"}  bg-[#${hex}]  x${String(n).padStart(3)}  ` +
      `(${[...bgHexFiles.get(hex)].slice(0, 3).join(", ")}${bgHexFiles.get(hex).size > 3 ? ", ..." : ""})`
  );
}
console.log(`\nbg-[#hex] distinct: ${bgSorted.length}, MISSING from .dark layer: ${uncoveredBg.length}`);

console.log("\n" + "=".repeat(78));
console.log("DISTINCT text-[#hex] : count of uncovered");
console.log("=".repeat(78));
const textSorted = [...textHexCount.entries()].sort((a, b) => b[1] - a[1]);
const uncoveredText = textSorted.filter(([hex]) => !covered(hex, coveredText));
console.log(`text-[#hex] distinct: ${textSorted.length}, MISSING: ${uncoveredText.length}`);
console.log("top uncovered: " + uncoveredText.slice(0, 25).map(([h, n]) => `#${h}(x${n})`).join(" "));

console.log("\n" + "=".repeat(78));
console.log("DISTINCT border-[#hex] : count of uncovered");
console.log("=".repeat(78));
const borderSorted = [...borderHexCount.entries()].sort((a, b) => b[1] - a[1]);
const uncoveredBorder = borderSorted.filter(([hex]) => !covered(hex, coveredBorder));
console.log(`border-[#hex] distinct: ${borderSorted.length}, MISSING: ${uncoveredBorder.length}`);
console.log(borderSorted.map(([h, n]) => `#${h}(x${n})${covered(h, coveredBorder) ? "" : "*"}`).join(" "));

console.log("\n" + "=".repeat(78));
console.log("FILES BY HARDCODED-COLOUR VOLUME  (* = has NO dark: variants at all)");
console.log("=".repeat(78));
perFile.sort((a, b) => b.total - a.total);
console.log(
  ["TOTAL", "bg#", "txt#", "bdr#", "gray", "white", "dark:", "blur", "file"].join("\t")
);
for (const r of perFile) {
  console.log(
    [
      r.total,
      r.bgHex,
      r.textHex,
      r.borderHex,
      r.gray,
      r.white,
      r.darkV + (r.darkV === 0 ? "*" : ""),
      r.blur,
      r.file,
    ].join("\t")
  );
}
console.log(`\nfiles with hardcoded colours: ${perFile.length} / ${files.length} scanned`);
console.log(`files with ZERO dark: variants: ${perFile.filter((r) => r.darkV === 0).length}`);
