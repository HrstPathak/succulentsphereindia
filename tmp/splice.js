/* Splice the freshly generated dark-mode layer into globals.css, replacing the
   stale generated block (from "/* ====... DARK MODE LAYER -- generated" to EOF)
   while preserving everything above it (the hand-written prose/brand overrides,
   animations, skeleton styles, etc.). */
/* Splice the freshly generated dark-mode layer into globals.css, replacing the
   stale generated block (from "/* ... DARK MODE LAYER -- generated" to EOF)
   while preserving everything above it (prose/brand overrides, animations,
   skeleton styles, etc.). Then report brace balance per-region for diagnostics. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const cssPath = path.join(ROOT, "src/styles/globals.css");
const layerPath = path.join(__dirname, "dark-layer.css");

const g = fs.readFileSync(cssPath, "utf8").split("\n");
const gen = fs.readFileSync(layerPath, "utf8");

function countBraces(text) {
  return {
    open: (text.match(/\{/g) || []).length,
    close: (text.match(/\}/g) || []).length,
  };
}

let cut = g.findIndex((l) => /DARK MODE LAYER.+generated, do not hand-edit/.test(l));
if (cut < 0) throw new Error("could not find generated-block start marker");
// Walk backward to the `/*` banner opener.
let k = cut;
while (k > 0) {
  const t = g[k - 1].trim();
  if (t === "/*" || /^\/\*={3,}/.test(t)) { k--; break; }
  if (t.includes("*/")) break;
  k--;
}

const head = g.slice(0, k);
// Strip trailing blank lines ONLY (after the last non-blank line), not blanks
// that sit inside an unclosed block. We stop stripping at the last line that
// has non-whitespace content.
while (head.length && head[head.length - 1].trim() === "") head.pop();

const out = head.join("\n") + "\n\n" + gen.replace(/\r?\n$/, "") + "\n";
fs.writeFileSync(cssPath, out, "utf8");

const headText = head.join("\n");
const genText = gen;
const hc = countBraces(headText);
const gc = countBraces(genText);
console.log(`head lines kept : ${head.length}  (braces ${hc.open}/${hc.close})`);
console.log(`generated lines : ${gen.split("\n").length}  (braces ${gc.open}/${gc.close})`);
console.log(`total css lines : ${out.split("\n").length}`);

