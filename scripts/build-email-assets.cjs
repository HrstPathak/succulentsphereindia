#!/usr/bin/env node
/**
 * Generates the email-safe image assets used by the order status email
 * (src/lib/email-templates/orderStatus.ts).
 *
 * Why this script exists
 * ----------------------
 * Two hard email-client facts forced it:
 *
 *   1. The supplied hero is WebP. Outlook 2007-2021 and Windows Mail cannot
 *      decode WebP at all, so those clients show a broken/empty frame. Every
 *      hero we email must be JPEG (or PNG). This script transcodes the source
 *      once and commits the result, so no runtime conversion is needed.
 *   2. Inline <svg> is stripped by Gmail and unsupported by Outlook desktop.
 *      Icons therefore have to be real, hosted raster files. We render the
 *      exact same vector paths used in the design preview to 2x PNG so they
 *      stay crisp on retina phones.
 *
 * Output (all committed to public/images/email/):
 *   hero-email.jpg                     1200x1200 JPEG   right-hand hero column
 *   icon-truck.png / icon-van.png /
 *   icon-check.png / icon-box.png      2x status badge glyphs
 *   icon-leaf.png / icon-shield.png /
 *   icon-sprout.png / icon-chat.png     2x trust-strip glyphs
 *   icon-truck-white.png               2x CTA glyph
 *
 * Usage:
 *   node scripts/build-email-assets.cjs
 *   node scripts/build-email-assets.cjs --source path/to/other.webp
 *
 * The source download is cached at public/images/email/_source-hero.webp.
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "images", "email");
const SOURCE = path.join(OUT_DIR, "_source-hero.webp");

const DEFAULT_SOURCE_URL =
  "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/EmailTemplateImage.webp";

/** Brand ink used for every glyph, matching the preview's #4A6A55. */
const INK = "#4A6A55";

/** @type {{file: string, w: number, h: number, strokes: string, vb?: string}[]} */
const ICONS = [
  {
    file: "icon-truck.png",
    w: 21,
    h: 15,
    strokes:
      '<path d="M2 7h23v18H2z"/><path d="M25 13h9l7 7v5H25z"/><circle cx="12" cy="27" r="3"/><circle cx="33" cy="27" r="3"/>',
  },
  {
    file: "icon-van.png",
    w: 20,
    h: 20,
    vb: "0 0 24 24",
    strokes:
      '<path d="M1.5 16.5V6.8c0-.7.6-1.3 1.3-1.3h11.4c.7 0 1.3.6 1.3 1.3v9.7"/><path d="M15.5 9.5h3.2l2.8 3.4v3.6"/>' +
      '<circle cx="6.5" cy="17" r="2.2"/><circle cx="17.5" cy="17" r="2.2"/><path d="M8.7 17h6.6"/><path d="M2.5 17h1.8"/>',
  },
  {
    file: "icon-check.png",
    w: 20,
    h: 20,
    vb: "0 0 24 24",
    strokes: '<circle cx="12" cy="12" r="9.5"/><path d="M7.8 12.2l3 3 5.4-5.6"/>',
  },
  {
    file: "icon-box.png",
    w: 20,
    h: 20,
    vb: "0 0 24 24",
    strokes:
      '<path d="M21 8.2v7.6a1.6 1.6 0 0 1-.85 1.41l-7 3.65a1.6 1.6 0 0 1-1.5 0l-7-3.65A1.6 1.6 0 0 1 3.8 15.8V8.2"/>' +
      '<path d="M3.6 7.6L12 3.2l8.4 4.4L12 12 3.6 7.6z"/><path d="M12 12v9.2"/><path d="M16.4 5.3l-8.8 4.6"/>',
  },
  {
    file: "icon-leaf.png",
    w: 20,
    h: 20,
    vb: "0 0 24 24",
    strokes: '<path d="M20 3C10 3 4 8 4 15c0 3 1.6 5 1.6 5C8 12 13 9 20 8c0 7-3 12-9 12-2 0-3.5-.6-3.5-.6"/>',
  },
  {
    file: "icon-shield.png",
    w: 19,
    h: 19,
    vb: "0 0 32 32",
    strokes: '<path d="M16 2 27 6v9c0 7-4.7 12.5-11 15C9.7 27.5 5 22 5 15V6z"/><path d="M11 16.5l3.4 3.4L21.5 12.8"/>',
  },
  {
    file: "icon-sprout.png",
    w: 20,
    h: 20,
    vb: "0 0 24 24",
    strokes: '<path d="M12 21V11"/><path d="M12 13c0-4 3-7 8-7 0 5-3 8-8 7z"/><path d="M12 16c0-3-2.4-5-6-5 0 3.6 2.4 5.6 6 5z"/>',
  },
  {
    file: "icon-chat.png",
    w: 19,
    h: 19,
    vb: "0 0 24 24",
    strokes: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.3-4A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/>',
  },
];

function svgFor({ w, h, strokes, vb }, stroke, strokeWidth) {
  const viewBox = vb || `0 0 ${Math.max(48, w * 2)} ${Math.max(32, h * 2)}`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="${viewBox}" ` +
      `fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">` +
      `${strokes}</svg>`,
  );
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https
      .get(url, { headers: { "User-Agent": "SucculentSphere/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(destination);
          return resolve(download(res.headers.location, destination));
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destination);
          return reject(new Error(`GET ${url} -> ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(destination)));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

async function writeIcon(icon, stroke, strokeWidth, file) {
  await sharp(svgFor(icon, stroke, strokeWidth))
    .resize(icon.w * 2, icon.h * 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, file));
  process.stdout.write(`${file.padEnd(24)} ${icon.w * 2}x${icon.h * 2} png\n`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const argSource = process.argv.includes("--source")
    ? process.argv[process.argv.indexOf("--source") + 1]
    : "";
  const source = argSource ? path.resolve(argSource) : SOURCE;

  if (!fs.existsSync(source)) {
    process.stdout.write(`downloading hero source -> ${DEFAULT_SOURCE_URL}\n`);
    await download(DEFAULT_SOURCE_URL, source);
  }

  // The hero fills a PORTRAIT column on the right of the status panel, next to
  // a block of text that is roughly 1.35x taller than it is wide. The source is
  // a 1983x793 landscape shot whose subject (the box) sits on the right, so we
  // resize with fit:"cover" anchored to the right edge: that keeps the box and
  // the printed card in frame instead of letterboxing the empty green wall.
  //
  // 248x334 is exactly 2x the rendered size in the template, so the photo stays
  // crisp on retina phones without paying for a larger download.
  await sharp(source)
    .resize(496, 668, { fit: "cover", position: "right" })
    .jpeg({ quality: 78, progressive: true, mozjpeg: true })
    .toFile(path.join(OUT_DIR, "hero-email.jpg"));
  process.stdout.write("hero-email.jpg            496x668 jpeg\n");

  for (const icon of ICONS) {
    const heavy = icon.file === "icon-shield.png" || icon.file === "icon-check.png";
    await writeIcon(icon, INK, heavy ? 2.1 : 2.2, icon.file);
  }

  // CTA glyph is white because it sits on the dark green button.
  const truck = ICONS.find((i) => i.file === "icon-truck.png");
  await writeIcon(truck, "#FFFFFF", 2.8, "icon-truck-white.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

