/* Generate the dark-mode remap layer for src/styles/globals.css.
 *
 * Input : tmp/dark-inventory.json  (census of every colour literal in src/)
 * Output: tmp/dark-layer.css
 *
 * Nothing is hand-listed. Every colour is classified from measured luma,
 * chroma and hue, so the rules below stay honest as the codebase changes.
 */
const fs = require("fs");
const path = require("path");

const inv = JSON.parse(fs.readFileSync(path.join(__dirname, "dark-inventory.json"), "utf8"));

/* The census emits some buckets as keyed objects and some as arrays; normalise
   both shapes to `[{ key, count, files }]` so the passes can stay uniform. */
function rows(bucket) {
  if (!bucket) return [];
  if (Array.isArray(bucket)) return bucket;
  return Object.entries(bucket).map(([key, v]) => ({ key, ...v }));
}

// ---------- colour maths ---------------------------------------------------
function rgbOf(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function luma(hex) {
  const [r, g, b] = rgbOf(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function chroma(hex) {
  const c = rgbOf(hex);
  return Math.max(...c) - Math.min(...c);
}
function hue(hex) {
  const [r0, g0, b0] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r0) h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0)) / 6;
  else if (max === g0) h = ((b0 - r0) / d + 2) / 6;
  else h = ((r0 - g0) / d + 4) / 6;
  return h * 360;
}

// ---------- the dark palette ----------------------------------------------
// Surfaces are translucent so the page's own gradient reads through the card;
// that is what makes them read as frosted glass rather than flat panels.
const GLASS_NEUTRAL = "rgba(13, 26, 34, 0.66)";
const GLASS_GREEN = "rgba(20, 42, 33, 0.64)";
const GLASS_BLUE = "rgba(17, 30, 44, 0.66)";
const GLASS_CHROMA = (h) => `hsla(${Math.round(h)}, 42%, 15%, 0.64)`;

const TEXT = "rgba(231, 246, 238, 0.86)";
const TEXT_MUTED = "rgba(231, 246, 238, 0.72)";
const TEXT_GREEN = "#a9dcb5";
const TEXT_AMBER = "#e8c58a";
const TEXT_RED = "#f4a9a2";
const TEXT_BLUE = "#a8c6e6";

const BORDER_NEUTRAL = "rgba(255, 255, 255, 0.12)";
const BORDER_GREEN = "rgba(143, 191, 148, 0.30)";
const BORDER_AMBER = "rgba(226, 185, 128, 0.30)";
const BORDER_CHROMA = (h) => `hsla(${Math.round(h)}, 45%, 46%, 0.34)`;

function textFor(hex) {
  const c = chroma(hex), h = hue(hex);
  if (c < 25) return TEXT;
  if (h >= 85 && h < 185) return TEXT_GREEN;
  if (h >= 20 && h < 70) return TEXT_AMBER;
  if (h >= 185 && h < 265) return TEXT_BLUE;
  return TEXT_RED;
}
function borderFor(hex) {
  const c = chroma(hex), h = hue(hex);
  if (c < 25) return BORDER_NEUTRAL;
  if (h >= 85 && h < 185) return BORDER_GREEN;
  if (h >= 20 && h < 70) return BORDER_AMBER;
  return BORDER_CHROMA(h);
}
function bgFor(hex) {
  const c = chroma(hex), h = hue(hex);
  if (c >= 25 && h >= 85 && h < 185) return GLASS_GREEN;
  if (c >= 40) return GLASS_CHROMA(h);
  if (h >= 185 && h < 265) return GLASS_BLUE;
  return GLASS_NEUTRAL;
}

/* Single entry point used by every pass: given a utility prefix and a literal
   colour, return [cssProperty, darkValue] or null to leave it alone. */
const PROP_OF = {
  bg: "background-color",
  text: "color",
  fill: "color",
  decoration: "color",
  border: "border-color",
  divide: "border-color",
  ring: "--tw-ring-color",
  from: "--tw-gradient-from",
  via: "--tw-gradient-via",
  to: "--tw-gradient-to",
};
function classify(prop, hex) {
  const cssProp = PROP_OF[prop];
  if (!cssProp) return null;
  const L = luma(hex);
  if (prop === "bg") {
    // Dark backgrounds are already correct on a dark page (brand buttons,
    // scrims). Inverting them would destroy the brand and the overlays.
    return L >= 165 ? [cssProp, bgFor(hex)] : null;
  }
  if (prop === "text" || prop === "fill" || prop === "decoration") {
    return L <= 150 ? [cssProp, textFor(hex)] : null;
  }
  return L >= 165 ? [cssProp, borderFor(hex)] : null;
}

// ---------- selector escaping ---------------------------------------------
function cls(name) {
  return "." + name.replace(/[[\]()#/.,%:!+>~*'"$&|^]/g, (ch) => "\\" + ch);
}

// ---------- hero exceptions ----------------------------------------------
/* The hero is a sunlit photograph behind a warm veil, so it is bright in BOTH
   themes; its near-black ink must stay dark. These three classes appear only in
   HeroSection.tsx, so simply never remapping them is safe and exact. Verified
   by searching the whole tree -- re-check with:
       rg -n "text-\\[#1b2418\\]|text-\\[#1f2a1c\\]|text-\\[#33402d\\]" src */
const HERO_SCOPE = ".ss-hero";
const HERO_ONLY_INK = new Set(["text-[#1b2418]", "text-[#1f2a1c]", "text-[#33402d]"]);

/* `bg-white/55` and `bg-white/80` are used elsewhere, so they DO get remapped;
   the hero's frosted CTA pill then re-asserts the light values. The extra
   `+ 1` compound gives the scoped rule higher specificity without !important. */
const HERO_RESTORE = new Map([
  ["bg-white/55", "rgba(255, 255, 255, 0.55)"],
  ["bg-white/80", "rgba(255, 255, 255, 0.80)"],
]);
const HERO_VARIANT_SKIP = new Set(["hover:bg-white/80", "hover:border-[#2f4a3a]/70"]);

// ---------- grouping -------------------------------------------------------
const groups = new Map(); // darkValue -> [selector]
const kept = [];
const variantSels = [];  // [selector, prop, value]
const gradientSels = []; // [selector, value]
function add(value, selector, prop) {
  const key = `${prop}||${value}`;
  if (!groups.has(key)) groups.set(key, { prop, value, sels: [] });
  groups.get(key).sels.push(selector);
}

// ---------- pass 1: arbitrary hex colours ---------------------------------
for (const row of rows(inv.hex)) {
  if (HERO_ONLY_INK.has(row.key)) {
    kept.push(`${row.key} (hero ink, deliberately preserved)`);
    continue;
  }
  const m = /^([a-z]+)-\[#([0-9a-fA-F]{3,8})\]$/.exec(row.key);
  if (!m) { kept.push(row.key); continue; }
  const res = classify(m[1], "#" + m[2]);
  if (res) add(res[1], cls(row.key), res[0]);
  else kept.push(row.key);
}

// ---------- pass 2: gray / slate / stone / neutral ramp -------------------
const LIGHT_BG = new Set(["50", "100", "200", "300"]);
const DARK_TEXT = new Set(["500", "600", "700", "800", "900"]);
const LIGHT_BORDER = new Set(["50", "100", "200", "300", "400", "500"]);
for (const row of rows(inv.gray)) {
  const m = /^(bg|text|border|divide|ring|from|via|to)-[a-z]+-(\d+)$/.exec(row.key);
  if (!m) { kept.push(row.key); continue; }
  const [prop, shade] = [m[1], m[2]];
  const sel = cls(row.key);
  if (prop === "bg" && LIGHT_BG.has(shade)) add(GLASS_NEUTRAL, sel, "background-color");
  else if (prop === "text" && DARK_TEXT.has(shade)) add(TEXT, sel, "color");
  else if (prop === "text" && shade === "400") add(TEXT_MUTED, sel, "color");
  else if ((prop === "border" || prop === "divide" || prop === "ring") && LIGHT_BORDER.has(shade))
    add(BORDER_NEUTRAL, sel, prop === "ring" ? "--tw-ring-color" : "border-color");
  else kept.push(row.key);
}

// ---------- pass 3: white / black alpha utilities -------------------------
for (const row of rows(inv.slash)) {
  const m = /^(bg|text|border|ring|from|via|to)-(white|black)\/(\d+)$/.exec(row.key);
  if (!m) { kept.push(row.key); continue; }
  const [prop, tone] = [m[1], m[2]];
  const a = Number(m[3]) / 100;
  const sel = cls(row.key);
  const cssProp = PROP_OF[prop];
  if (!cssProp) { kept.push(row.key); continue; }

  if (prop === "bg" && tone === "white") {
    // A high alpha is a real card surface -> glass. A low alpha is a subtle
    // wash sitting ON a card, which must stay light or it reads as a hole.
    if (a >= 0.5) add(GLASS_NEUTRAL, sel, "background-color");
    else add(`rgba(231, 246, 238, ${(a * 0.6).toFixed(3)})`, sel, "background-color");
  } else if (prop === "bg" && tone === "black") {
    if (a < 0.5) add(`rgba(255, 255, 255, ${(a * 0.55).toFixed(3)})`, sel, "background-color");
    else kept.push(row.key); // heavy black is a scrim, still correct on dark
  } else if (prop === "border" && tone === "white") {
    if (a >= 0.5) add(BORDER_NEUTRAL, sel, "border-color");
    else kept.push(row.key); // faint light hairline already reads on dark
  } else if (prop === "border" && tone === "black") {
    add("rgba(255, 255, 255, 0.10)", sel, "border-color");
  } else if (prop === "text" && tone === "black") {
    add(`rgba(231, 246, 238, ${Math.min(a + 0.15, 0.9).toFixed(2)})`, sel, "color");
  } else if (prop === "to" && tone === "white") {
    add(GLASS_NEUTRAL, sel, "--tw-gradient-to");
  } else {
    kept.push(row.key);
  }
}

// ---------- pass 4: hex colours carrying an alpha suffix ------------------
/* `bg-[#dbe8d7]/35` is a pale tint laid over a surface. The base colour is
   already light, and the alpha makes it lighter still, so it becomes a faint
   LIGHT wash -- the same treatment as low-alpha white, never a dark panel. */
for (const row of rows(inv.hexAlpha)) {
  const m = /^([a-z]+)-\[#([0-9a-fA-F]{3,8})\]\/(\d+|\[([0-9.]+)\])$/.exec(row.key);
  if (!m) { kept.push(row.key); continue; }
  const prop = m[1];
  const hex = "#" + m[2];
  const a = m[4] !== undefined ? Number(m[4]) : Number(m[3]) / 100;
  const sel = cls(row.key);
  const L = luma(hex);

  if (prop === "bg") {
    if (L < 165) { kept.push(row.key); continue; } // dark tint, already fine
    // Preserve the tint's hue so warm and cool washes stay distinguishable.
    const c = chroma(hex), h = hue(hex);
    const value =
      c < 12
        ? `rgba(231, 246, 238, ${(a * 0.55).toFixed(3)})`
        : `hsla(${Math.round(h)}, 34%, 78%, ${(a * 0.5).toFixed(3)})`;
    add(value, sel, "background-color");
  } else if (prop === "text" || prop === "fill") {
    if (L > 150) { kept.push(row.key); continue; }
    add(textFor(hex), sel, "color");
  } else if (PROP_OF[prop]) {
    if (L < 165) { kept.push(row.key); continue; }
    add(borderFor(hex), sel, PROP_OF[prop]);
  } else {
    kept.push(row.key);
  }
}

// ---------- pass 5: arbitrary background gradients ------------------------
/* A hardcoded cream gradient is the biggest single dark-mode failure here:
   60+ of them are light washes used as page, panel and skeleton backgrounds,
   and no hex rule can reach them because they are gradients.

   Only gradients whose stops are ALL opaque AND light are rewritten, and every
   colour token is swapped for a stop on a dark ramp in document order. The
   direction, shape keywords and stop positions survive byte-for-byte, so these
   panels keep their depth instead of collapsing into flat rectangles.
   Brand gradients, dark scrims and translucent washes are left untouched. */
const HEX_TOKEN = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/g;
const RGB_TOKEN = /rgba?\(\s*[\d.]+[,\s]+[\d.]+[,\s]+[\d.]+(?:[,/\s]+[\d.]+%?)?\s*\)/g;
const RAMP_HI = [0x12, 0x20, 0x2a];
const RAMP_LO = [0x08, 0x12, 0x19];
function rampAt(t) {
  const c = RAMP_HI.map((v, i) => Math.round(v + (RAMP_LO[i] - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function gradientStops(value) {
  const out = [];
  const re = new RegExp(`${HEX_TOKEN.source}|${RGB_TOKEN.source}`, "g");
  let m;
  while ((m = re.exec(value))) {
    if (m[0][0] === "#") out.push({ hex: m[0] });
    else {
      const nums = (m[0].match(/[\d.]+/g) || []).map(Number);
      out.push({ rgb: nums.slice(0, 3), alpha: nums.length > 3 ? nums[3] : 1 });
    }
  }
  return out;
}
for (const row of rows(inv.grad)) {
  if (!/^bg-\[/.test(row.key)) { kept.push(row.key); continue; }
  const stops = gradientStops(row.key);
  if (!stops.length) { kept.push(row.key); continue; }
  const allOpaqueLight = stops.every((s) => {
    if ((s.alpha === undefined ? 1 : s.alpha) < 0.9) return false;
    return (s.hex ? luma(s.hex) : 0.299 * s.rgb[0] + 0.587 * s.rgb[1] + 0.114 * s.rgb[2]) >= 190;
  });
  if (!allOpaqueLight) { kept.push(row.key); continue; }

  const inner = row.key.slice(row.key.indexOf("[") + 1, -1);
  const n = stops.length;
  let i = 0;
  const next = () => rampAt(n <= 1 ? 0 : i++ / (n - 1));
  const value = inner
    .replace(HEX_TOKEN, next)
    .replace(RGB_TOKEN, next)
    .replace(/_/g, " "); // Tailwind escapes spaces inside arbitrary values
  gradientSels.push([cls(row.key), value]);
}

// ---------- pass 6: hover / focus / active literals -----------------------
/* Tailwind compiles `hover:bg-[#f8fbf7]` to `.hover\:bg-[#f8fbf7]:hover`, which
   a bare `.bg-[#f8fbf7]` rule cannot reach. Unhandled, every light hover would
   flash near-white on a dark card. Each state is classified exactly like its
   base form. These selectors carry one extra compound, so they beat the base
   remap while still losing to any `dark:hover:` the developers already wrote. */
const PSEUDO = {
  hover: ":hover",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  "focus-within": ":focus-within",
  active: ":active",
  disabled: ":disabled",
};
for (const row of rows(inv.variant)) {
  const m = /^(hover|focus|focus-visible|focus-within|active|disabled):(.+)$/.exec(row.key);
  if (!m) { kept.push(row.key); continue; }
  if (HERO_VARIANT_SKIP.has(row.key)) continue;
  const state = m[1], base = m[2];

  let prop = null, value = null;
  let hm = /^([a-z]+)-\[#([0-9a-fA-F]{3,8})\](?:\/(\d+))?$/.exec(base);
  if (hm) {
    const res = classify(hm[1], "#" + hm[2]);
    if (res) [prop, value] = res;
    if (prop && hm[3]) {
      // alpha-suffixed state: keep the same faint-wash logic as pass 4
      const a = Number(hm[3]) / 100;
      if (prop === "background-color")
        value = `hsla(${Math.round(hue("#" + hm[2]))}, 34%, 78%, ${(a * 0.5).toFixed(3)})`;
    }
  } else if ((hm = /^(bg|text|border|ring)-(white|black)\/(\d+)$/.exec(base))) {
    prop = PROP_OF[hm[1]];
    const a = Number(hm[3]) / 100;
    if (hm[1] === "bg" && hm[2] === "white")
      value = a >= 0.5 ? GLASS_NEUTRAL : `rgba(231, 246, 238, ${(a * 0.6).toFixed(3)})`;
    else if (hm[1] === "bg" && hm[2] === "black")
      value = a >= 0.5 ? null : `rgba(255, 255, 255, ${(a * 0.55).toFixed(3)})`;
    else if (hm[1] === "text" && hm[2] === "black")
      value = `rgba(231, 246, 238, ${Math.min(a + 0.15, 0.9).toFixed(2)})`;
    else if (hm[1] === "border" && hm[2] === "black") value = "rgba(255, 255, 255, 0.10)";
    else value = null;
  } else if ((hm = /^bg-(gray|slate|stone|neutral|zinc)-(\d+)$/.exec(base))) {
    const L = Number(hm[2]);
    if (L <= 300) { prop = "background-color"; value = GLASS_NEUTRAL; }
  } else if ((hm = /^text-(gray|slate|stone|neutral|zinc)-(\d+)$/.exec(base))) {
    const L = Number(hm[2]);
    if (L >= 500) { prop = "color"; value = TEXT; }
  }

  if (!prop || !value) { kept.push(row.key); continue; }
  variantSels.push([`${cls(row.key)}${PSEUDO[state]}`, prop, value]);
}

// ---------- emit -----------------------------------------------------------
const lines = [];
const push = (...xs) => lines.push(...xs);

push("");
push("/* ===========================================================================");
push("   DARK MODE LAYER  --  generated, do not hand-edit");
push("");
push("   The app hardcodes its colours as literals (`bg-[#fafbf9]`, `text-[#26372d]`,");
push("   `bg-white/70`, `text-gray-600`) in 200+ files, and dozens of those files");
push("   contain no `dark:` variant at all. Remapping them here, once, in a layer");
push("   scoped to `.dark`, fixes dark mode everywhere without touching a single");
push("   component -- so no layout, spacing or markup can shift.");
push("");
push("   Regenerate after changing colours in the app:");
push("       node tmp/dark-scan.cjs && node tmp/gen-dark-layer.cjs");
push("");
push("   Rules of the remap:");
push("     * light surfaces -> translucent dark glass, hue preserved when the");
push("                         original was genuinely chromatic (pastel status");
push("                         tints stay identifiable instead of turning grey)");
push("     * dark ink       -> light ink, same hue-preservation rule");
push("     * light borders  -> faint light hairline");
push("     * ALREADY-DARK values are deliberately left alone: they still read");
push("       correctly against a dark page, and inverting them would break brand");
push("       buttons, dark scrims and the always-bright hero photograph.");
push("");
push("   Selectors are two compounds deep (`.dark .x`), so any `dark:` variant a");
push("   component already declares (`.dark .x:is(.dark *)`, specificity 0-3-0)");
push("   still wins. No !important is used anywhere.");
push("=========================================================================== */");
push("");
push("/* Bare white surfaces become glass cards rather than the flat page colour. */");
push(".dark .bg-white {");
push("  background-color: rgba(13, 26, 34, 0.66);");
push("}");

// --- remapped literals ----------------------------------------------------
const ordered = [...groups.values()].sort((a, b) => b.sels.length - a.sels.length);
let surfaceSels = [];
for (const g of ordered) {
  if (g.prop === "background-color") surfaceSels.push(...g.sels);
  push("");
  push(`/* ${g.sels.length} class${g.sels.length > 1 ? "es" : ""} -> ${g.value} */`);
  push(".dark " + g.sels.join(",\n.dark ") + " {");
  push(`  ${g.prop}: ${g.value};`);
  push("}");
}

// --- frosted glass --------------------------------------------------------
push("");
push("/* ===========================================================================");
push("   FROSTED GLASS");
push("");
push("   Applied to exactly the surfaces the remap above turned into dark panels,");
push("   i.e. the elements that were light cards in light mode. Brand-coloured");
push("   buttons are excluded automatically: the remap leaves them dark, so they");
push("   never enter this list.");
push("");
push("   `backdrop-filter` affects painting only -- it cannot move or resize");
push("   anything, so this is layout-safe by construction. The inset highlight");
push("   supplies the lit top edge of frosted glass as a box-shadow rather than a");
push("   border, because a border would add width and shift layout.");
push("=========================================================================== */");
push("");
push(`/* ${surfaceSels.length} remapped surface classes */`);
push(".dark " + surfaceSels.join(",\n.dark ") + " {");
push("  -webkit-backdrop-filter: blur(14px) saturate(130%);");
push("  backdrop-filter: blur(14px) saturate(130%);");
push("  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);");
push("}");
push("");
push("/* Reusable glass surface for new work, and an opt-out for elements where a");
push("   backdrop-filter is too costly (long virtualised lists, sticky headers). */");
push(".ss-glass {");
push("  background-color: rgba(13, 26, 34, 0.66);");
push("  -webkit-backdrop-filter: blur(16px) saturate(135%);");
push("  backdrop-filter: blur(16px) saturate(135%);");
push("  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07),");
push("    inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 12px 30px rgba(0, 0, 0, 0.35);");
push("}");
push("");
push(".dark .ss-no-blur {");
push("  -webkit-backdrop-filter: none;");
push("  backdrop-filter: none;");
push("}");
push("");
push("/* Without backdrop-filter the translucent panels would look merely washed");
push("   out, so fall back to a solid colour for those engines only. */");
push("@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {");
push("  .dark .bg-white,");
push("  .ss-glass {");
push("    background-color: rgba(11, 22, 29, 0.96);");
push("  }");
push("}");

// --- light gradients -> dark graded panels --------------------------------
if (gradientSels.length) {
  push("");
  push("/* ===========================================================================");
  push("   LIGHT GRADIENTS -> DARK GRADED PANELS");
  push("");
  push("   A cream gradient cannot be reached by any background-color rule, and this");
  push("   app leans on them heavily for page shells, panels and skeleton placeholders.");
  push("   Each one keeps its original direction, shape and stop positions and simply");
  push("   gets dark stops, so the surface keeps its shading and depth instead of");
  push("   flattening into a rectangle.");
  push("=========================================================================== */");
  for (const [sel, value] of gradientSels) {
    push("");
    push(`/* ${sel.replace(/^\./, "")} */`);
    push(`.dark ${sel} {`);
    push(`  background-image: ${value};`);
    push("}");
  }
}

// --- hero exceptions ------------------------------------------------------
push("");
push("/* ===========================================================================");
push("   HERO EXCEPTIONS");
  push("");
  push("   The hero is a sunlit photograph behind a warm veil, so it is bright in BOTH");
  push("   themes and its near-black ink must stay dark. Two mechanisms:");
push("");
push("     1) Its three ink classes are simply never remapped. They appear only in");
push("        HeroSection.tsx, so nothing else in the app loses them.");
push("     2) `bg-white/55` and `bg-white/80` ARE used elsewhere, so they are remapped");
push("        app-wide and then re-asserted inside `.ss-hero` (a marker class on the");
push("        hero <section> with no visual effect of its own). The extra compound");
push("        gives those rules higher specificity, so no !important is needed.");
push("=========================================================================== */");
for (const [key, value] of HERO_RESTORE.entries()) {
  push("");
  push(`/* the hero's frosted CTA pill must stay light */`);
  push(`.dark ${HERO_SCOPE} ${cls(key)},`);
  push(`.dark ${HERO_SCOPE} ${cls("hover:" + key)}:hover {`);
  push(`  background-color: ${value};`);
  push("}");
}
push("");
push("/* The hero's ink, for reference -- these are never remapped anywhere. */");
push("/* " + [...HERO_ONLY_INK].join(", ") + " */");

// --- interactive states ---------------------------------------------------
if (variantSels.length) {
  push("");
  push("/* ===========================================================================");
  push("   INTERACTIVE STATES (hover / focus / active / disabled)");
  push("");
  push("   `hover:bg-[#f8fbf7]` compiles to `.hover\\:bg-[#f8fbf7]:hover`, which the base");
  push("   rules above cannot match. Left alone, every light hover would flash");
  push("   near-white on a dark card. Same colour logic as the base remap, emitted");
  push("   with the matching pseudo-class.");
  push("=========================================================================== */");
  for (const [sel, prop, value] of variantSels) {
    push("");
    push(`/* ${sel.replace(/^\./, "")} */`);
    push(`.dark ${sel} {`);
    push(`  ${prop}: ${value};`);
    push("}");
  }
}

fs.writeFileSync(path.join(__dirname, "dark-layer.css"), lines.join("\n"), "utf8");

console.log(`groups (distinct target values) : ${groups.size}`);
console.log(`remapped surface classes        : ${surfaceSels.length}`);
console.log(`light gradients rewritten       : ${gradientSels.length}`);
console.log(`interactive states rewritten    : ${variantSels.length}`);
console.log(`left untouched (already dark)   : ${kept.length}`);
console.log(`output                          : ${lines.join("\n").length} bytes`);





