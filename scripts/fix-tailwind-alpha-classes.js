/**
 * One-off codemod: repair Tailwind v3 classes whose alpha channel is silently
 * DROPPED, so they emit no CSS at all. Two independent causes:
 *
 *   1. var() colour + opacity modifier.
 *      Tailwind must statically resolve a colour to inject alpha, and
 *      `var(--color-brand)` is opaque at build time, so the whole rule is
 *      dropped (there is no color-mix() fallback in v3).
 *          bg-[var(--color-secondary)]/25 -> bg-[rgb(var(--ss-secondary-rgb)/0.25)]
 *      Even the bracket form `/[0.25]` is dropped -- only the RGB-triplet
 *      form works. See the --ss-*-rgb block in globals.css.
 *
 *   2. Bare opacity modifier outside the scale.
 *      The default scale is multiples of 5 only, and this project does not
 *      extend it, so `/62` (etc.) matches no value and emits nothing.
 *          bg-white/62 -> bg-white/[0.62]
 *
 * Usage: node scripts/fix-tailwind-alpha-classes.js            (report only)
 *        node scripts/fix-tailwind-alpha-classes.js --write    (apply)
 */
const fs = require("fs");
const path = require("path");

/** Theme colour variable -> variable holding its space-separated RGB channels. */
const TRIPLET = {
  "--color-brand": "--ss-brand-rgb",
  "--color-secondary": "--ss-secondary-rgb",
  "--color-accent": "--ss-accent-rgb",
  "--color-text": "--ss-text-rgb",
  "--color-bg": "--ss-bg-rgb",
  "--auth-border": "--ss-border-rgb",
};

const UTILITIES =
  "bg|text|border|border-t|border-b|border-l|border-r|from|via|to|ring|divide|outline|shadow|fill|stroke|decoration|placeholder|caret|accent";

/** A colour token: a named colour or an arbitrary [ ... ] value. */
const COLOUR =
  "(?:inherit|current|transparent|black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}|\\[[^\\]]+\\])";

/** 1. var() colour + opacity modifier. */
const VAR_OPACITY = new RegExp(
  "\\b(" + UTILITIES + ")-\\[var\\((--[a-z0-9-]+)\\)\\]\\/([0-9]+(?:\\.[0-9]+)?)\\b",
  "g"
);

/** 2. Bare numeric opacity modifier on a colour utility. */
const BARE_OPACITY = new RegExp(
  "\\b(" + UTILITIES + ")-(" + COLOUR + ")\\/(\\d{1,3})\\b",
  "g"
);

/** "25" -> "0.25"; "0.25" -> "0.25"; "5" -> "0.05" */
function toAlpha(raw) {
  if (raw.includes(".")) return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? String(n / 100) : null;
}

const ROOT = process.cwd();
const WRITE = process.argv.includes("--write");

/** Recursively collect .tsx/.ts files under src/. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const stats = { triplet: 0, bracket: 0 };
const touched = [];
const skipped = [];

for (const file of walk(path.join(ROOT, "src"))) {
  const original = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");

  // Pass 1: var() colour + modifier -> rgb(var(--triplet)/alpha).
  let updated = original.replace(VAR_OPACITY, (match, util, cssVar, alpha) => {
    const triplet = TRIPLET[cssVar];
    const a = alpha.includes(".") ? alpha : toAlpha(alpha);
    if (!triplet || a === null) {
      skipped.push(`${rel}: ${match}`);
      return match;
    }
    stats.triplet += 1;
    return `${util}-[rgb(var(${triplet})/${a})]`;
  });

  // Pass 2: out-of-scale bare modifier -> bracket form (always emitted).
  updated = updated.replace(BARE_OPACITY, (match, util, colour, raw) => {
    const n = Number(raw);
    if (n % 5 === 0 && n <= 100) return match; // already in scale - leave it
    const a = toAlpha(raw);
    if (a === null) {
      skipped.push(`${rel}: ${match}`);
      return match;
    }
    stats.bracket += 1;
    return `${util}-${colour}/[${a}]`;
  });

  if (updated !== original) {
    touched.push(rel);
    if (WRITE) fs.writeFileSync(file, updated, "utf8");
  }
}

for (const s of skipped) console.log(`SKIP (unmapped) ${s}`);
console.log(
  `${WRITE ? "REWROTE" : "WOULD REWRITE"} ${stats.triplet} var()-opacity + ${stats.bracket} bracket-opacity classes in ${touched.length} files`
);
for (const f of touched) console.log("  " + f);
