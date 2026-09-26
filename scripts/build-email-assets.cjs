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
 *   hero-email.jpg                     1240x760 JPEG  full-bleed status panel
 *                                                 background (scrim baked in)
 *   footer-email.jpg                   1240x231 JPEG  full-bleed trust strip
 *   icon-truck.png / icon-chat.png     2x CTA and support glyphs
 *   icon-truck-white.png               2x CTA glyph, recoloured for the button
 *
 * Usage:
 *   node scripts/build-email-assets.cjs
 *   node scripts/build-email-assets.cjs --source path/to/other.webp
 *
 * The source downloads are cached at public/images/email/_source-hero.webp and
 * public/images/email/_source-footer.png.
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "images", "email");
const SOURCE = path.join(OUT_DIR, "_source-hero.webp");
const FOOTER_SOURCE = path.join(OUT_DIR, "_source-footer.png");

const DEFAULT_SOURCE_URL =
  "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/EmailTemplateImage.webp";
const DEFAULT_FOOTER_SOURCE_URL =
  "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/EmailFooter.png";

/**
 * Panel geometry. The status panel is 620x380 CSS px in the template, so every
 * baked asset is produced at exactly 2x to stay crisp on retina phones while
 * keeping the payload small.
 */
const PANEL_W = 620;
const PANEL_H = 380;

/**
 * Brand forest green. Must stay in sync with BRAND.panelDeep in
 * src/lib/email-templates/orderStatus.ts — the scrim has to disappear into
 * the panel colour, otherwise the photo looks like it sits on a green box.
 */
const SCRIM = "#2F4D3F";

/**
 * The scrim is baked into the JPEG instead of layered in CSS because the
 * status copy is white on top of a photo and email gives us no reliable way
 * to stack a translucent overlay above a background image:
 *   - Outlook renders through the Word engine and drops `background-image`
 *     and every overlay technique except VML.
 *   - Gmail strips `opacity` on most elements.
 * So the two gradients below are composited at build time. Everything that
 * ships is then a single flat JPEG that every client paints identically.
 *
 * `h` runs left to right: the copy occupies the left ~55% of the panel on
 * desktop but the FULL width on a phone, where the status heading and subhead
 * would otherwise sit on top of the succulent box. So the gradient holds near
 * full strength across the whole crop and only lifts off at the far right,
 * where the printed card sits. The photo still reads as a photograph — it just
 * reads as one taken in low light, which suits the palette.
 * `v` runs top to bottom: the bottom of the source shot is a pale cream
 * table surface that would swallow white body copy, so it is sunk back
 * toward the panel colour as a vignette.
 */
function scrimSvg(w, h) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="${SCRIM}" stop-opacity="0.93"/>
          <stop offset="32%"  stop-color="${SCRIM}" stop-opacity="0.91"/>
          <stop offset="46%"  stop-color="${SCRIM}" stop-opacity="0.87"/>
          <stop offset="58%"  stop-color="${SCRIM}" stop-opacity="0.76"/>
          <stop offset="72%"  stop-color="${SCRIM}" stop-opacity="0.64"/>
          <stop offset="86%"  stop-color="${SCRIM}" stop-opacity="0.56"/>
          <stop offset="100%" stop-color="${SCRIM}" stop-opacity="0.54"/>
        </linearGradient>
        <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${SCRIM}" stop-opacity="0.14"/>
          <stop offset="42%"  stop-color="${SCRIM}" stop-opacity="0"/>
          <stop offset="78%"  stop-color="${SCRIM}" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="${SCRIM}" stop-opacity="0.60"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#h)"/>
      <rect width="${w}" height="${h}" fill="url(#v)"/>
    </svg>`,
  );
}

/** Brand ink used for every glyph, matching the preview's #4A6A55. */
const INK = "#4A6A55";

/**
 * The only glyphs the template still needs are the CTA truck and the support
 * chat bubble. The per-status badge and trust-strip glyphs were dropped when
 * both of those blocks became single images (the hero background and
 * footer-email.jpg), and every extra <img> in an email is another URL that can
 * 404 in someone's inbox.
 *
 * @type {{file: string, w: number, h: number, strokes: string, vb?: string}[]}
 */
const ICONS = [
  {
    // CTA glyph — also rendered white below, since it sits on the dark button.
    file: "icon-truck.png",
    w: 21,
    h: 15,
    strokes:
      '<path d="M2 7h23v18H2z"/><path d="M25 13h9l7 7v5H25z"/><circle cx="12" cy="27" r="3"/><circle cx="33" cy="27" r="3"/>',
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

/**
 * Finds the bounding box of the drawn artwork in a flat-background image.
 *
 * sharp's own `trim()` cannot be used here: the supplied strip is not a single
 * exact colour (it carries a faint gradient between #f8f7f3 and #f8f8f3), so
 * trim measures the whole canvas as content and returns it untouched. Sampling
 * the corner and taking everything that differs from it by a tolerance gives a
 * stable box, and keeps the crop correct if the artwork is ever re-exported at
 * a different size.
 *
 * @returns {Promise<{left:number, top:number, width:number, height:number}>}
 */
async function contentBox(file, tolerance = 10) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const at = (x, y) => {
    const i = (y * info.width + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const [br, bg, bb] = at(0, 0);

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const [r, g, b] = at(x, y);
      if (
        Math.abs(r - br) > tolerance ||
        Math.abs(g - bg) > tolerance ||
        Math.abs(b - bb) > tolerance
      ) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`no artwork found in ${file}`);

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
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
  if (!fs.existsSync(FOOTER_SOURCE)) {
    process.stdout.write(`downloading footer source -> ${DEFAULT_FOOTER_SOURCE_URL}\n`);
    await download(DEFAULT_FOOTER_SOURCE_URL, FOOTER_SOURCE);
  }

  // HERO. It is painted as the status panel's full-bleed background, so the
  // crop is chosen to match the panel's own 620x380 aspect (1.63:1) as closely
  // as the source allows. The source is a 1983x793 landscape shot (2.5:1) of
  // a succulent box against a dark green wall: the subject sits on the RIGHT
  // and the empty wall on the LEFT, which is exactly where the copy goes.
  // `position: "right"` therefore keeps the box and the printed card in frame
  // and trims only dead wall, so `background-size: cover` in the template has
  // almost nothing left to crop.
  const heroW = PANEL_W * 2;
  const heroH = PANEL_H * 2;
  await sharp(source)
    .resize(heroW, heroH, { fit: "cover", position: "right" })
    .composite([{ input: scrimSvg(heroW, heroH), blend: "over" }])
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toFile(path.join(OUT_DIR, "hero-email.jpg"));
  process.stdout.write(`hero-email.jpg            ${heroW}x${heroH} jpeg (scrimmed)\n`);

  // TRUST STRIP. Supplied as a 1600x535 PNG whose artwork only occupies
  // y145-366 / x111-1540 — the rest is a flat cream field. Shipping it as-is
  // would add ~50% dead weight to every send, so it is cropped to the art plus
  // an even margin and emitted as JPEG. JPEG is deliberate: the strip is
  // mostly one flat cream tone, which mozjpeg compresses to a fraction of the
  // PNG's size, and the artwork is smooth curves that survive q90 cleanly.
  //
  // The margin is the full width of the strip's own side padding plus a little
  // extra, because the strip is rendered full-bleed: crop any tighter and the
  // "BRINGING NATURE" caption sits flush against the edge of the panel.
  const footerW = PANEL_W * 2;
  const strip = await sharp(FOOTER_SOURCE).metadata();
  const box = await contentBox(FOOTER_SOURCE);
  const padX = Math.round(box.width * 0.06);
  const padY = Math.round(box.height * 0.16);
  // The offset is clamped first, then the extent is capped against whatever is
  // left of the canvas — capping the size independently would let the right
  // or bottom edge run past the image and sharp rejects the whole crop.
  const left = Math.max(0, box.left - padX);
  const top = Math.max(0, box.top - padY);
  const crop = {
    left,
    top,
    width: Math.min(strip.width - left, box.width + padX * 2),
    height: Math.min(strip.height - top, box.height + padY * 2),
  };
  await sharp(FOOTER_SOURCE)
    .extract(crop)
    .resize({ width: footerW })
    .jpeg({ quality: 90, progressive: true, mozjpeg: true })
    .toFile(path.join(OUT_DIR, "footer-email.jpg"));
  const footerMeta = await sharp(path.join(OUT_DIR, "footer-email.jpg")).metadata();
  process.stdout.write(
    `footer-email.jpg          ${footerMeta.width}x${footerMeta.height} jpeg ` +
      `(art ${box.width}x${box.height} + margin)\n`,
  );

  for (const icon of ICONS) {
    await writeIcon(icon, INK, 2.2, icon.file);
  }

  // CTA glyph is white because it sits on the dark green button.
  const truck = ICONS.find((i) => i.file === "icon-truck.png");
  await writeIcon(truck, "#FFFFFF", 2.8, "icon-truck-white.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

