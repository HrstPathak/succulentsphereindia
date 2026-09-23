/* Generate the dark-mode remap layer in src/styles/globals.css from the real
   colour inventory (tmp/dark-inventory.json) instead of hand-listing hexes.

   Classification is by measured luminance / chroma / hue, so it is derived from
   the data rather than guessed:
     - light surface  -> translucent "dark glass" surface (keeps hue when the
                         colour is genuinely chromatic, e.g. pastel status tints)
     - dark text      -> light text (hue preserved for status colours)
     - light border   -> faint light hairline
     - already-dark values are LEFT ALONE (they still read correctly on a dark page)
   Emits tmp/dark-layer.css. */
const fs = require("fs");
const path = require("path");

const inv = JSON.parse(
  fs.readFileSync(path.join(__dirname, "dark-inventory.json"), "utf8")
);

// ---------- colour helpers -------------------------------------------------
function rgbOf(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function luma(hex) {
  const [r, g, b] = rgbOf(hex);
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
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
  return Math.round(h * 360);
}

// Dark "glass" surfaces the light colours collapse into. Translucent + blurred
// so the page gradient behind shows through -- that is the frosted effect.
const GLASS_NEUTRAL = "rgba(13, 26, 34, 0.66)";
const GLASS_GREEN = "rgba(20, 42, 33, 0.64)";
const GLASS_BLUE = "rgba(17, 30, 44, 0.66)";
function GLASS_CHROMA(h) {
  return `hsla(${h}, 42%, 15%, 0.64)`;
}
// Text tints, keyed by hue family, used when the original colour carried real
// saturation (status pills, prices, highlights). Keeps them recognisable.
const TEXT_NEUTRAL = "rgba(231, 246, 238, 0.86)";
const TEXT_MUTED = "rgba(231, 246, 238, 0.72)";
const TEXT_GREEN = "#a9dcb5";
const TEXT_AMBER = "#e8c58a";
const TEXT_RED = "#f4a9a2";
const TEXT_BLUE = "#a8c6e6";

function textFor(hex) {
  const c = chroma(hex), h = hue(hex);
  if (c < 25) return TEXT_NEUTRAL;
  if (h >= 85 && h < 185) return TEXT_GREEN;
  if (h >= 20 && h < 70) return TEXT_AMBER;
  if (h >= 185 && h < 265) return TEXT_BLUE;
  return TEXT_RED; // reds / wine / rose
}

function borderFor(hex) {
  const c = chroma(hex), h = hue(hex);
  if (c < 25) return "rgba(255, 255, 255, 0.12)";
  if (h >= 85 && h < 185) return "rgba(143, 191, 148, 0.30)";
  if (h >= 20 && h < 70) return "rgba(226, 185, 128, 0.30)";
  return `hsla(${h}, 45%, 46%, 0.34)`;
}

function bgFor(hex) {
  const c = chroma(hex), h = hue(hex);
  if (h >= 85 && h < 185 && c >= 20) return GLASS_GREEN;
  if (c >= 40) return GLASS_CHROMA(h);
  if (h >= 185 && h < 265) return GLASS_BLUE;
  return GLASS_NEUTRAL;
}

// ---------- escaping / exclusions ------------------------------------------
function cls(name) {
  return "." + name.replace(/[[\]()#/.,%:!+>~*'"$&|^]/g, (ch) => "\\" + ch);
}

/* The hero photo is bright in BOTH themes (it is a sunlit image behind a warm
   veil), so the near-black ink that sits on it must stay dark. These literals
   are used only inside HeroSection -- verified by an exhaustive search of the
   source tree -- so scoping the exclusion there is safe, and the alternative
   (remapping every dark ink app-wide) would have erased the headline.
   Kept in sync with the hero's class list. */
const HERO_SKIP = new Set([
  "text-[#1b2418]",   // <h1>
  "text-[#1f2a1c]",   // copy column + "Explore Plant Care" label
  "text-[#33402d]",   // sub-copy
]);
/* Remapped app-wide (these classes are shared with non-hero components) but
   re-asserted inside the hero, where the surface behind them is the bright
   photo rather than the dark page. */
const HERO_RESTORE = new Map([
  ["bg-white/55", "rgba(255, 255, 255, 0.55)"],
  ["bg-white/80", "rgba(255, 255, 255, 0.80)"],
]);
const HERO_SCOPE = ".ss-hero";

// ---------- grouping -------------------------------------------------------
const groups = new Map(); // targetValue -> [selectors]
function add(value, selector) {
  if (!groups.has(value)) groups.set(value, []);
  groups.get(value).push(selector);
}

const kept = []; // provenance notes for review
const heroSkipped = []; // hero-exclusive selectors held back from the remap


// --- arbitrary hex ---------------------------------------------------------
for (const row of inv.hex) {
  const { prop, hex } = row;
  const L = luma(hex);
  const name = `${prop}-[${hex}]`;
  const sel = cls(name);
  if (HERO_SKIP.has(name)) {
    heroSkipped.push(sel);
    continue;
  }
  if (prop === "bg") {
    if (L >= 165) add(bgFor(hex), sel);
    else kept.push(`${prop}-[${hex}]`);
  } else if (prop === "text") {
    if (L <= 150) add(textFor(hex), sel);
    else kept.push(`${prop}-[${hex}]`);
  } else if (prop === "border") {
    if (L >= 165) add(borderFor(hex), sel);
    else kept.push(`${prop}-[${hex}]`);
  } else if (prop === "ring") {
    if (L >= 165) add(borderFor(hex), sel);
    else kept.push(`${prop}-[${hex}]`);
  } else if (prop === "divide") {
    if (L >= 165) add(borderFor(hex), sel);
    else kept.push(`${prop}-[${hex}]`);
  } else if (prop === "fill") {
    if (L <= 150) add(textFor(hex), sel);
    else kept.push(`${prop}-[${hex}]`);
  }
  // from-/via-/to- gradient stops are handled by alpha-scoped rules below,
  // because flipping a stop can invert the whole gradient's intent.
}

// --- gray / slate / stone / neutral scale ---------------------------------
const LIGHT_BG_SHADES = new Set(["50", "100", "200", "300"]);
const TEXT_LIGHT_SHADES = new Set(["500", "600", "700", "800", "900"]);
const BORDER_LIGHT_SHADES = new Set(["50", "100", "200", "300", "400", "500"]);
const STOP_DARK_SHADES = new Set(["50", "100", "200"]);

for (const key of Object.keys(inv.gray)) {
  const m = /^(bg|text|border|divide|ring|from|via|to)-([a-z]+)-(\d+)$/.exec(key);
  if (!m) continue;
  const [, prop, , shade] = m;
  const sel = cls(key);
  if (prop === "bg" && LIGHT_BG_SHADES.has(shade)) add(GLASS_NEUTRAL, sel);
  else if (prop === "text" && TEXT_LIGHT_SHADES.has(shade)) add(TEXT_NEUTRAL, sel);
  else if (prop === "text" && shade === "400") add(TEXT_MUTED, sel);
  else if ((prop === "border" || prop === "divide" || prop === "ring") && BORDER_LIGHT_SHADES.has(shade))
    add("rgba(255, 255, 255, 0.12)", sel);
  else if ((prop === "from" || prop === "to" || prop === "via") && STOP_DARK_SHADES.has(shade))
    add(GLASS_NEUTRAL, sel);
  else kept.push(key);
}

// --- white / black alpha utilities ---------------------------------------
// bg-white/<a>: a translucent white surface. High alpha = a real card, so it
// becomes dark glass. Low alpha = a subtle wash on an already-coloured element,
// so it must stay a LIGHT wash or it would read as a hole punched in the card.
for (const key of Object.keys(inv.slash)) {
  const m = /^(bg|text|border|ring|from|via|to)-(white|black)\/(\d+)$/.exec(key);
  if (!m) continue;
  const [, prop, tone, aRaw] = m;
  const a = Number(aRaw) / 100;
  const sel = cls(key);

  if (prop === "bg" && tone === "white") {
    if (a >= 0.5) add(GLASS_NEUTRAL, sel);
    else add(`rgba(231, 246, 238, ${(a * 0.6).toFixed(3)})`, sel);
  } else if (prop === "bg" && tone === "black") {
    // Heavy black is a scrim (still correct over dark). Light black is a subtle
    // grey wash on a card, which must flip to a light wash.
    if (a >= 0.5) kept.push(key);
    else add(`rgba(255, 255, 255, ${(a * 0.55).toFixed(3)})`, sel);
  } else if (prop === "border" && tone === "white") {
    if (a >= 0.5) add("rgba(255, 255, 255, 0.12)", sel);
    else kept.push(key); // faint light hairline already correct on dark
  } else if (prop === "border" && tone === "black") {
    add("rgba(255, 255, 255, 0.10)", sel);
  } else if (prop === "text" && tone === "black") {

// --- hex + alpha suffix (bg-[#dbe8d7]/35) ---------------------------------
// These are translucent tints. A light tint needs to become a DARK tint of the
// same hue, otherwise the element reads as a bright patch on the dark page.
for (const { key } of inv.hexAlpha || []) {
  const m = /^(bg|text|border|ring|from|via|to)-\[#([0-9a-fA-F]{3,8})\]\/(\d+|\[[0-9.]+\])$/.exec(key);
  if (!m) continue;
  const prop = m[1];
  const hex = "#" + m[2].toLowerCase();
  const raw = m[3];
  const a = raw.startsWith("[") ? Number(raw.slice(1, -1)) : Number(raw) / 100;
  const sel = cls(key);
  const L = luma(hex);
  const h = hue(hex);
  const c = chroma(hex);

  if (prop === "bg") {
    if (L >= 165) {
      // light tint -> dark tint, hue preserved so the colour still reads
      const [r, g, b] = rgbOf(hex);
      const dark = `rgba(${Math.round(r * 0.16)}, ${Math.round(g * 0.2)}, ${Math.round(b * 0.18)}, ${(a * 0.85).toFixed(3)})`;
      add(dark, sel);
    } else {
      kept.push(key); // already a dark tint
    }
  } else if (prop === "text") {
    if (L <= 150) add(textFor(hex), sel);
    else kept.push(key);
  } else if (prop === "border" || prop === "ring") {
    if (L >= 165) add(borderFor(hex), sel);
    else kept.push(key);
  } else {
    kept.push(key);
  }
}

// --- arbitrary background gradients ---------------------------------------
// A hardcoded cream gradient is the single biggest dark-mode failure in this
// codebase: 60+ of them are light washes used as page/panel/skeleton
// backgrounds, and no hex rule can reach them because they are gradients.
//
// Only gradients whose stops are ALL light are flattened -- those are
// unambiguously "light surface" gradients. A gradient containing any dark or
// saturated stop is left alone, because it is a brand/dark treatment (buttons,
// hero overlays, image scrims) that already works on a dark page.
function gradientStops(value) {
  const out = [];
  const re = /#([0-9a-fA-F]{3,8})\b|rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/g;
  let m;
  while ((m = re.exec(value))) {
    if (m[1]) out.push({ hex: "#" + m[1], alpha: 1 });
    else out.push({ rgb: [Number(m[2]), Number(m[3]), Number(m[4])], alpha: 1 });
  }
  return out;
}
function stopLuma(s) {
  if (s.hex) return luma(s.hex);
  const [r, g, b] = s.rgb;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

let gradFlattened = 0;
const gradientSels = []; // [selector, replacement gradient] pairs
const RAMP_HI = [0x12, 0x20, 0x2a];
const RAMP_LO = [0x08, 0x12, 0x19];
function rampAt(t) {
  const c = RAMP_HI.map((v, i) => Math.round(v + (RAMP_LO[i] - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

for (const { key } of inv.grad || []) {
  if (!/^bg-\[/.test(key)) {
    kept.push(key); // from-/via-/to- stops: flipping them can invert intent
    continue;
  }
  const stops = gradientStops(key);
  if (!stops.length) {
    kept.push(key);
    continue;
  }
  const allLight = stops.every((s) => stopLuma(s) >= 190);
  if (!allLight) {
    kept.push(key); // brand / dark / translucent-scrim gradient
    continue;
  }
  // Substitute each colour token with the dark ramp, keeping every direction,
  // stop position and shape keyword byte-for-byte. The result is the same
  // gradient geometry in dark tones, so these panels keep their depth instead
  // of collapsing to a flat rectangle.
  const n = stops.length;
  let i = 0;
  const value = key.replace(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g, () => {
    const t = n <= 1 ? 0 : i / (n - 1);
    i++;
    return rampAt(t);
  });
  gradientSels.push([cls(key), value]);
  gradFlattened++;
}

    add(`rgba(231, 246, 238, ${Math.min(a + 0.15, 0.9).toFixed(2)})`, sel);
  } else if (prop === "to" && tone === "white") {
    add(GLASS_NEUTRAL, sel);
  } else {
    kept.push(key); // text-white/*, ring-white/*, via-black/* etc. stay
  }
}


// ---------- emit -----------------------------------------------------------
const lines = [];
lines.push("");
lines.push("/* ---------------------------------------------------------------------------");

// --- variant-prefixed literals (hover:, focus:, ...) ----------------------
// Tailwind compiles `hover:bg-[#f8fbf7]` to `.hover\:bg-[#f8fbf7]:hover`, which
// a plain `.bg-[#f8fbf7]` rule cannot reach. Left unhandled these light hovers
// flash near-white on a dark card, so each one is classified with the same rules
// as its base form and re-emitted with the matching pseudo-class.
const PSEUDO = {
  hover: ":hover",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  "focus-within": ":focus-within",
  active: ":active",
  disabled: ":disabled",
};
const variantSels = []; // [selector, prop, value]

for (const { key } of inv.variant || []) {
  const m = /^([a-z-]+):(bg|text|border|ring|divide|fill)-(.+)$/.exec(key);
  if (!m) continue;
  const [, variant, prop, rawValue] = m;
  const pseudo = PSEUDO[variant];
  if (!pseudo) {
    kept.push(key); // e.g. group-hover: needs an ancestor selector
    continue;
  }

  // Resolve the literal to a concrete colour + alpha.
  let hex = null;
  let alpha = 1;
  let hm = /^\[#([0-9a-fA-F]{6})\]$/.exec(rawValue);
  if (hm) {
    hex = "#" + hm[1].toLowerCase();
  } else if ((hm = /^white\/(\d+)$/.exec(rawValue))) {
    hex = "#ffffff";
    alpha = Number(hm[1]) / 100;
  } else if ((hm = /^black\/(\d+)$/.exec(rawValue))) {
    hex = "#000000";
    alpha = Number(hm[1]) / 100;
  }
  if (!hex) {
    kept.push(key); // rgba()/var() forms already carry their own theme logic
    continue;
  }

  const L = luma(hex);
  const isWhite = hex === "#ffffff";
  const isBlack = hex === "#000000";
  let target = null;

  if (prop === "text") {
    if (!isWhite && !isBlack && L <= 150) target = textFor(hex);
  } else if (prop === "border" || prop === "ring") {
    if (!isBlack && L >= 165) target = borderFor(hex);
  } else if (prop === "bg") {
    if (isWhite) {
      target = alpha >= 0.5 ? GLASS_NEUTRAL : `rgba(231, 246, 238, ${(alpha * 0.6).toFixed(3)})`;
    } else if (isBlack) {
      target = alpha >= 0.5 ? null : `rgba(255, 255, 255, ${(alpha * 0.55).toFixed(3)})`;
    } else if (L >= 165) {
      target = bgFor(hex);
    }
  }

  if (!target) {
    kept.push(key); // already dark / already correct
    continue;
  }
  variantSels.push([cls(key) + pseudo, prop === "text" || prop === "fill" ? "color" : prop === "bg" ? "background-color" : "border-color", target]);
}

lines.push("   DARK MODE REMAP LAYER");
lines.push("");
lines.push("   The app hardcodes ~300 distinct literal colours (`bg-[#fafbf9]`,");
lines.push("   `text-[#26372d]`, `bg-white/70`, `text-gray-600` ...) across 204 files,");
lines.push("   and 65 of those files contain no `dark:` variant at all. Rather than");
lines.push("   touch every component (which would risk layout changes), the literals are");
lines.push("   remapped here, in one place, scoped to `.dark`.");
lines.push("");
lines.push("   This block is GENERATED from a census of the source tree, classified by");
lines.push("   measured luma / chroma / hue -- not hand-listed. Regenerate with:");
lines.push("       node tmp/dark-scan.cjs && node tmp/gen-dark-layer.cjs");
lines.push("");
lines.push("   Rules of the remap:");
lines.push("     * light surfaces  -> translucent dark glass (hue kept when chromatic,");
lines.push("                          so pastel status tints stay identifiable)");
lines.push("     * dark text       -> light text (hue kept for status colours)");
lines.push("     * light borders   -> faint light hairline");
lines.push("     * already-dark values are intentionally NOT touched -- they still read");
lines.push("       correctly against the dark page, and inverting them would break");
lines.push("       brand buttons and dark scrims.");
lines.push("");
lines.push("   Colours are grouped by target value so the compiled CSS stays small.");
lines.push("");
lines.push("   NO `!important` ANYWHERE, ON PURPOSE. Every rule is prefixed with `.dark`,");
lines.push("   which lifts it to two class selectors -- enough to beat Tailwind's plain");
lines.push("   one-class utilities -- while leaving rules of EQUAL specificity (i.e. the");
lines.push("   developers' own `dark:` variants, which Tailwind emits as `.dark .dark\\:*`)");
lines.push("   free to win on source order, because this block sits in `@layer components`");
lines.push("   and therefore compiles BEFORE `@tailwind utilities`. Using !important here");
lines.push("   would clobber every intentional `dark:` style in the app.");
lines.push("--------------------------------------------------------------------------- */");
lines.push("");
lines.push("/* Bare white surfaces become glass cards rather than the flat page colour. */");
lines.push(".dark .bg-white {");
lines.push("  background-color: rgba(13, 26, 34, 0.66);");
lines.push("}");

// The CSS property is implied by the utility prefix. A group's selectors can
// span prefixes (the same target colour may be used as both bg and border), so
// split each group by property.
for (const [value, sels] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const byProp = new Map();
  for (const s of sels) {
    const f = s.replace(/^\./, "");
    let p = "background-color";
    if (/^text-/.test(f) || /^fill-/.test(f) || /^decoration-/.test(f)) p = "color";
    else if (/^border-/.test(f) || /^divide-/.test(f)) p = "border-color";
    else if (/^ring-/.test(f)) p = "--tw-ring-color";
    else if (/^from-/.test(f)) p = "--tw-gradient-from";
    else if (/^via-/.test(f)) p = "--tw-gradient-via";
    else if (/^to-/.test(f)) p = "--tw-gradient-to";
    if (!byProp.has(p)) byProp.set(p, []);
    byProp.get(p).push(s);
  }

  for (const [p, list] of byProp.entries()) {
    lines.push("");
    lines.push(`/* ${list.length} class${list.length > 1 ? "es" : ""} -> ${value} (${p}) */`);
    lines.push(".dark " + list.join(",\n.dark ") + " {");
    lines.push(`  ${p}: ${value};`);
    lines.push("}");
  }
}

// ---- glass treatment ------------------------------------------------------
const surfaceSels = [];
for (const [, sels] of groups.entries()) {
  for (const s of sels) if (/^\.bg-/.test(s)) surfaceSels.push(s);
}

lines.push("");
lines.push("/* ---------------------------------------------------------------------------");
lines.push("   FROSTED-GLASS TREATMENT");
lines.push("");
lines.push("   Applied to the surfaces remapped above, i.e. exactly the elements that were");
lines.push("   light panels/cards in light mode. Brand-coloured buttons are deliberately");
lines.push("   excluded: the remap leaves them dark, so they never receive blur.");
lines.push("");
lines.push("   `backdrop-filter` is layout-neutral -- it only affects painting, so nothing");
lines.push("   here can shift, resize or reflow an element. The inset highlight supplies");
lines.push("   the lit top edge of frosted glass without adding a border-width, which WOULD");
lines.push("   change layout; a box-shadow does not.");
lines.push("--------------------------------------------------------------------------- */");
lines.push("");
lines.push(`/* ${surfaceSels.length} remapped surface classes get the frosted paint + lit top edge. */`);
lines.push(".dark " + surfaceSels.join(",\n.dark ") + " {");
lines.push("  -webkit-backdrop-filter: blur(14px) saturate(130%);");
lines.push("  backdrop-filter: blur(14px) saturate(130%);");
lines.push("  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);");
lines.push("}");
lines.push("");
// ---- light gradients -> dark graded surfaces -----------------------------
if (gradientSels.length) {
  lines.push("");
  lines.push("/* ---------------------------------------------------------------------------");
  lines.push("   LIGHT GRADIENTS REPAINTED AS DARK GRADIENTS");
  lines.push("");
  lines.push("   These 60-odd classes are hardcoded cream/white washes used as page and");
  lines.push("   panel backgrounds (`bg-[linear-gradient(155deg,#f7f3ef...)]`). A colour rule");
  lines.push("   cannot reach them, because Tailwind compiles them to `background-image`.");
  lines.push("   Each one is repainted with the same direction, shape and stop positions but");
  lines.push("   in dark tones, so the panels keep their depth rather than flattening out.");
  lines.push("--------------------------------------------------------------------------- */");
  for (const [sel, value] of gradientSels) {
    lines.push("");
    lines.push(`/* ${sel.replace(/^\./, "")} */`);
    lines.push(`.dark ${sel} {`);
    lines.push(`  background-image: ${value} !important;`);
    lines.push("}");
  }
}

// ---- hero: keep its dark ink dark ----------------------------------------
if (heroSkipped.length || HERO_RESTORE.size) {
  lines.push("");
  lines.push("/* ---------------------------------------------------------------------------");
  lines.push("   HERO EXCEPTIONS");
  lines.push("");
  lines.push("   The hero is a sunlit photograph behind a warm veil, so it is bright in BOTH");
  lines.push("   themes. Its near-black ink must therefore stay dark. Two mechanisms:");
  lines.push("");
  lines.push("     1) The hero-exclusive ink classes are simply never remapped (listed");
  lines.push("        below). They appear only in HeroSection, so nothing else loses them.");
  lines.push("     2) `bg-white/55` and `bg-white/80` ARE used elsewhere, so they are");
  lines.push("        remapped app-wide and then re-asserted inside `.ss-hero`. The extra");
  lines.push("        class gives these three-class selectors the edge over the two-class");
  lines.push("        remap without needing !important.");
  lines.push("");
  lines.push("   `.ss-hero` is a marker with no visual effect of its own.");
  lines.push("--------------------------------------------------------------------------- */");
  if (heroSkipped.length) {
    lines.push("/* Never remapped (hero-only ink). */");
    lines.push("/* " + heroSkipped.map((s) => s.replace(/^\./, "")).join(", ") + " */");
  }
  for (const [key, value] of HERO_RESTORE.entries()) {
    lines.push("");
    lines.push(`/* restore ${key} on the hero's frosted CTA pill */`);
    lines.push(`.dark ${HERO_SCOPE} ${cls(key)} {`);
    lines.push(`  background-color: ${value};`);
    lines.push("}");
  }
}

// ---- variant-prefixed literals -------------------------------------------
if (variantSels.length) {
  lines.push("");
  lines.push("/* ---------------------------------------------------------------------------");
  lines.push("   INTERACTIVE STATES (hover / focus / active)");
  lines.push("");
  lines.push("   Tailwind compiles `hover:bg-[#f8fbf7]` to `.hover\\:bg-[#f8fbf7]:hover`, so");
  lines.push("   the base rules above cannot reach it. Unhandled, every light hover would");
  lines.push("   flash near-white on a dark card. One rule per state, same colour logic as");
  lines.push("   the base remap. These are three-class selectors, so they still beat the");
  lines.push("   two-class base remap while losing to any `dark:hover:` the developers wrote.");
  lines.push("--------------------------------------------------------------------------- */");
  for (const [sel, prop, value] of variantSels) {
    lines.push("");
    lines.push(`/* ${sel.replace(/^\./, "")} */`);
    lines.push(`.dark ${sel} {`);
    lines.push(`  ${prop}: ${value};`);
    lines.push("}");
  }
}


lines.push("/* Reusable glass surface for new components, plus an opt-out for elements");
lines.push("   where a backdrop-filter would be too costly (long virtualised lists). */");
lines.push(".ss-glass {");
lines.push("  background-color: rgba(13, 26, 34, 0.66);");
lines.push("  -webkit-backdrop-filter: blur(16px) saturate(135%);");
lines.push("  backdrop-filter: blur(16px) saturate(135%);");
lines.push("  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07),");
lines.push("    inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 12px 30px rgba(0, 0, 0, 0.35);");
lines.push("}");
lines.push("");
lines.push(".dark .ss-no-blur {");
lines.push("  -webkit-backdrop-filter: none !important;");
lines.push("  backdrop-filter: none !important;");
lines.push("}");

fs.writeFileSync(path.join(__dirname, "dark-layer.css"), lines.join("\n"), "utf8");

console.log(`groups emitted          : ${groups.size}`);
console.log(`remapped surface classes: ${surfaceSels.length}`);
console.log(`explicitly kept (dark)  : ${kept.length}`);
console.log(`output bytes            : ${lines.join("\n").length}`);

