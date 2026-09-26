/**
 * Layout probe. Reports the geometry that the full-page screenshots can only
 * hint at: does the panel overflow its viewport horizontally, is the product
 * thumbnail rendered at its intended box, and is the whole image visible inside
 * it or is it being cropped.
 *
 * The sample thumbnail is deliberately NOT square. A square sample hides a
 * squashed or clipped thumbnail, which is precisely the failure being chased.
 *
 * Usage:
 *   npm run order:email:build
 *   node email-preview/probe-layout.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const DIR = __dirname;
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SAMPLE_THUMB = path.join(DIR, "render", "_probe-thumb.jpg");

const VIEWPORTS = [
  { name: "desktop", width: 700, height: 1400 },
  { name: "mobile", width: 390, height: 1400 },
  { name: "narrow", width: 320, height: 1400 },
];

function makeSampleThumb() {
  const sharp = require("sharp");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">
    <rect width="300" height="400" fill="#E8DCC8"/>
    <rect x="0" y="0" width="300" height="40" fill="#C0392B"/>
    <rect x="0" y="360" width="300" height="40" fill="#2471A3"/>
    <circle cx="150" cy="200" r="90" fill="#6E8F72"/>
  </svg>`;
  return sharp(Buffer.from(svg))
    .jpeg()
    .toBuffer()
    .then((buffer) => {
      fs.writeFileSync(SAMPLE_THUMB, buffer);
      return `file:///${SAMPLE_THUMB.replace(/\\/g, "/")}`;
    });
}

function localize(html, sampleThumb) {
  return html
    .replace(
      /https?:\/\/[^"']*\/images\/email\//g,
      `file:///${path.join(__dirname, "..", "public", "images", "email").replace(/\\/g, "/")}/`,
    )
    .replace(/https?:\/\/cdn\.example\.com\/[^"']*/g, sampleThumb);
}

const PROBE = () => {
  const out = { overflow: null, images: [] };
  const docWidth = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > docWidth + 1) {
    out.overflow = {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: docWidth,
    };
  }
  for (const img of document.querySelectorAll("img")) {
    const r = img.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) continue; // icons, not thumbnails
    const parent = img.parentElement.getBoundingClientRect();
    out.images.push({
      src: (img.currentSrc || img.src).split("/").pop(),
      natural: `${img.naturalWidth}x${img.naturalHeight}`,
      box: `${Math.round(r.width)}x${Math.round(r.height)}`,
      loaded: img.complete && img.naturalWidth > 0,
      clipped: r.right > parent.right + 0.5 || r.bottom > parent.bottom + 0.5,
      left: Math.round(r.left),
      right: Math.round(r.right),
      docWidth,
    });
  }
  return out;
};

const BAND_PROBE = () => {
  const out = { pads: [] };  for (const td of document.querySelectorAll("td.ss-pad")) {
    const cs = getComputedStyle(td);
    const r = td.getBoundingClientRect();
    out.pads.push({
      style: (td.getAttribute("style") || "").slice(0, 42),
      padL: cs.paddingLeft,
      padR: cs.paddingRight,
      left: Math.round(r.left),
      right: Math.round(r.right),
    });
  }
  // The cell that wraps the whole items band.
  const bandCell = [...document.querySelectorAll("td.ss-pad")].find(
    (td) => (td.getAttribute("style") || "").includes("26px"),
  );
  if (bandCell) {
    const panel = bandCell.closest("table");
    const cs = getComputedStyle(panel);
    out.bandPanel = {
      left: Math.round(panel.getBoundingClientRect().left),
      right: Math.round(panel.getBoundingClientRect().right),
      background: cs.backgroundColor,
    };
  }
  // The greeting's card, for comparison: the two must agree or the seam shows.
  const greetCell = [...document.querySelectorAll("td.ss-pad")].find((td) =>
    (td.getAttribute("style") || "").includes("30px"),
  );
  if (greetCell) {
    const panel = greetCell.closest("table");
    out.cardPanel = {
      left: Math.round(panel.getBoundingClientRect().left),
      right: Math.round(panel.getBoundingClientRect().right),
      background: getComputedStyle(panel).backgroundColor,
    };
  }
  const heading = [...document.querySelectorAll("div")].find(
    (d) => d.textContent.trim() === "Items ordered",
  );
  if (heading) {
    out.headingLeft = Math.round(heading.getBoundingClientRect().left);
    // Walk up and report each ancestor, to find where the inset is lost.
    out.chain = [];
    for (let n = heading; n && n.tagName !== "BODY"; n = n.parentElement) {
      const cs = getComputedStyle(n);
      out.chain.push(`${n.tagName}.${n.className || "-"}[padL=${cs.paddingLeft}]`);
    }
  }
  return out;
};

/** Prints the ancestor chain of the key blocks, to see where the card breaks. */
const TREE_PROBE = () => {
  const info = (el) => {
    const out = [];
    for (let n = el; n && n.tagName !== "HTML"; n = n.parentElement) {
      out.push(n.tagName + (n.className ? "." + n.className : ""));
    }
    return out.join(" < ");
  };
  const byText = (t) =>
    [...document.querySelectorAll("td,div")].find((e) => e.textContent.trim() === t);
  const res = {
    totalTables: document.querySelectorAll("table").length,
    ssPadCount: document.querySelectorAll(".ss-pad").length,
  };
  for (const [key, label] of [
    ["greeting", "Hi Rose maria,"],
    ["itemsHeading", "Items ordered"],
    ["summary", "Order summary"],
    ["cta", "Track your order"],
  ]) {
    const el = byText(label);
    if (el) res[key] = info(el);
  }
  return res;
};

(async () => {
  const { buildOrderConfirmationEmail } = require("./render/orderConfirmation.js");
  const sampleThumb = await makeSampleThumb();
  const base = JSON.parse(fs.readFileSync(path.join(DIR, "probe-input.json"), "utf8"));
  const { html } = buildOrderConfirmationEmail(base);
  const out = path.join(DIR, "render", "probe.local.html");
  fs.writeFileSync(out, localize(html, sampleThumb));

  const browser = await chromium.launch({ executablePath: CHROME });
  for (const v of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: v.width, height: v.height } });
    await page.goto(`file:///${out.replace(/\\/g, "/")}`, { waitUntil: "load" });
    const result = await page.evaluate(PROBE);
    const band = await page.evaluate(BAND_PROBE);
    const tree = await page.evaluate(TREE_PROBE);
    console.log(`\n=== ${v.name} (${v.width}px) ===`);
    console.log("  overflow:", JSON.stringify(result.overflow));
    console.log("  band:", JSON.stringify(band));
    console.log("  tree:", JSON.stringify(tree, null, 1));
    for (const im of result.images) console.log("  thumb:", JSON.stringify(im));
    await page.screenshot({
      path: path.join(DIR, "render", `probe-${v.name}.png`),
      fullPage: true,
    });
    await page.close();
  }
  await browser.close();
})();
