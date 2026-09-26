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
 *   hero-confirmation.jpg              1240x600 JPEG  full-bleed confirmation
 *                                                 panel background (cream veil
 *                                                 baked in)
 *   footer-email.jpg                   1240x231 JPEG  full-bleed trust strip
 *   icon-truck.png / icon-chat.png     2x CTA and support glyphs
 *   icon-truck-white.png               2x CTA glyph, recoloured for the button
 *   icon-user.png / icon-card.png      2x info-card glyphs
 *   icon-leaf.png                      2x footer leaf mark
 *   logo-mark.png                      2x circular succulent masthead mark
 *
 * Usage:
 *   node scripts/build-email-assets.cjs
 *   node scripts/build-email-assets.cjs --source path/to/other.webp
 *
 * The source downloads are cached at public/images/email/_source-hero.webp,
 * public/images/email/_source-order-confirmation.webp and
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
const CONFIRMATION_SOURCE = path.join(OUT_DIR, "_source-order-confirmation.webp");

const DEFAULT_SOURCE_URL =
  "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/EmailTemplateImage.webp";
const DEFAULT_FOOTER_SOURCE_URL =
  "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/EmailFooter.png";
const DEFAULT_CONFIRMATION_SOURCE_URL =
  "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/OrderConfirmationImage.webp";

/**
 * Panel geometry. The status panel is 620x380 CSS px in the template, so every
 * baked asset is produced at exactly 2x to stay crisp on retina phones while
 * keeping the payload small.
 */
const PANEL_W = 620;
const PANEL_H = 380;

/**
 * The confirmation hero is a 620x300 CSS px band. It is the same 620px measure
 * as the status panel so the two templates line up in an inbox, but shorter:
 * the confirmation copy is a short greeting, not a status headline, and the
 * extra height went on the order summary below instead of empty photo.
 */
const CONFIRMATION_PANEL_W = 620;
const CONFIRMATION_PANEL_H = 300;

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
 * The confirmation hero is the INVERSE of the status hero and needs the
 * opposite treatment, so it gets its own scrim function.
 *
 * The status panel is a dark, low-key photo that white copy sits on, so it is
 * sunk under a heavy brand-green scrim. The confirmation hero is the supplied
 * OrderConfirmationImage: a bright cream wall (rgb 248,244,238) with a potted
 * succulent on the RIGHT and empty wall on the LEFT, i.e. 3:1 of flat field
 * reserved for copy. Measured across that field, the darkest pixel is
 * rgb(235,230,220) — still 10.5:1 against BRAND.ink, four times the WCAG AAA
 * threshold. So the copy is DARK ink on natural light and the scrim here is a
 * veil, not a darkener: it can only ever lift the field, never fight it.
 *
 * It stays deliberately weak (12% at the very left edge, gone by 70%). That is
 * insurance, not design: if this artwork is ever re-exported darker or with the
 * plant's shadow reaching further left, the copy column keeps its headroom
 * instead of silently dropping to 3:1. Anything heavier would print as a
 * visible wash over a wall that is already the right colour, and the cream has
 * to meet the white masthead above it without a seam.
 */
const VEIL = "#FBFAF6";

function confirmationVeilSvg(w, h) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="${VEIL}" stop-opacity="0.12"/>
          <stop offset="36%"  stop-color="${VEIL}" stop-opacity="0.11"/>
          <stop offset="54%"  stop-color="${VEIL}" stop-opacity="0.07"/>
          <stop offset="72%"  stop-color="${VEIL}" stop-opacity="0.02"/>
          <stop offset="100%" stop-color="${VEIL}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#v)"/>
    </svg>`,
  );
}

/**
 * The glyphs the shipped templates need. The per-status badge and trust-strip
 * glyphs were dropped when both of those blocks became single images (the hero
 * background and footer-email.jpg), and every extra <img> in an email is another
 * URL that can 404 in someone's inbox.
 *
 * `vb` is the SVG viewBox the strokes below are authored in. It is stated
 * explicitly for every glyph because writeIcon() scales by
 * rendered_px / viewBox_px, so a stroke drawn for one viewBox and reused at
 * another comes out visibly bolder or thinner. Each stroke-width here is chosen
 * to land at ~1.5px once displayed at its nominal size in the template.
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
  {
    // Customer card glyph: head + shoulders, the Lucide "user" geometry.
    file: "icon-user.png",
    w: 20,
    h: 20,
    vb: "0 0 24 24",
    strokes: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5"/>',
  },
  {
    // Payment card glyph: a card with its magnetic-stripe gap.
    file: "icon-card.png",
    w: 20,
    h: 15,
    vb: "0 0 24 24",
    strokes: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/>',
  },
  {
    // Footer leaf mark. Same Lucide "leaf" path the site itself renders, so the
    // emailed wordmark and the website footer are the same drawing.
    file: "icon-leaf.png",
    w: 17,
    h: 17,
    vb: "0 0 24 24",
    strokes:
      '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  },
];

/**
 * Glyphs that only ever appear in WHITE, because they sit on the dark green
 * footer band rather than on cream.
 *
 * Separate from ICONS rather than an extra colour per entry: none of these are
 * used on a light surface, and an ink variant that nothing references is an
 * asset a future change might reach for and get wrong.
 *
 * The two trust glyphs complete the footer's four claims. `icon-leaf-white.png`
 * and `icon-truck-white.png` are already produced in white from ICONS, so only
 * the shield and the heart are new here.
 *
 * @type {{file: string, w: number, h: number, vb?: string, strokes: string}[]}
 */
const WHITE_ICONS = [
  {
    // "Carefully packed". Shield plus check, the Lucide "shield-check" outline.
    file: "icon-shield-white.png",
    w: 18,
    h: 18,
    vb: "0 0 24 24",
    strokes:
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  },
  {
    // "Plant care support". Heart, the Lucide "heart" outline.
    file: "icon-heart-white.png",
    w: 18,
    h: 18,
    vb: "0 0 24 24",
    strokes:
      '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  },
];

/**
 * Social glyphs for the footer's follow row.
 *
 * Only the two networks the brand actually publishes to are drawn. The
 * reference design shows four circles, but a "YouTube" or "Pinterest" link
 * aimed at a handle nobody has registered is a dead link in a customer's
 * inbox, which is worse than a two-icon row. Add a glyph here when the brand
 * opens an account, and it joins the row automatically.
 *
 * @type {{file: string, w: number, h: number, vb?: string, strokes: string}[]}
 */
const SOCIAL_ICONS = [
  {
    file: "icon-social-instagram.png",
    w: 16,
    h: 16,
    vb: "0 0 24 24",
    // The single "line" whose two ends coincide is drawn round-capped, so it
    // renders as the lens dot rather than as nothing.
    strokes:
      '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.6" y1="6.4" x2="17.6" y2="6.4"/>',
  },
  {
    file: "icon-social-facebook.png",
    w: 16,
    h: 16,
    vb: "0 0 24 24",
    strokes:
      '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  },
];

/** Footer glyphs sit on dark green, so they are stroked heavier than the ink set. */
const FOOTER_STROKE_WIDTH = 1.7;

/**
 * The circular rosette that sits beside the wordmark in the confirmation
 * masthead.
 *
 * Built here as a PNG for the same reason as every other glyph: Gmail strips
 * inline <svg> outright and Outlook desktop cannot draw it at all, so a logo
 * shipped as inline markup simply does not appear in a large share of inboxes.
 * Drawn as five ellipses rotated around a common centre, which reads as a
 * succulent rosette at 44px without needing the real logo artwork.
 */
const LOGO_MARK = {
  file: "logo-mark.png",
  w: 44,
  h: 44,
  vb: "0 0 48 48",
  strokes: [
    '<circle cx="24" cy="24" r="21.5"/>',
    ...[0, 72, 144, 216, 288].map(
      (deg) =>
        `<ellipse cx="24" cy="13.5" rx="4" ry="8" transform="rotate(${deg} 24 24)"/>`,
    ),
    '<circle cx="24" cy="24" r="2.4"/>',
  ].join(""),
};

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
  if (!fs.existsSync(CONFIRMATION_SOURCE)) {
    process.stdout.write(
      `downloading confirmation hero source -> ${DEFAULT_CONFIRMATION_SOURCE_URL}\n`,
    );
    await download(DEFAULT_CONFIRMATION_SOURCE_URL, CONFIRMATION_SOURCE);
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

  // The rosette is drawn on a 48-unit viewBox and displayed at 44px, so it
  // needs a thinner nominal stroke than the 24-unit glyphs to land at the same
  // optical weight; 1.7 here is ~1.5px on screen.
  await writeIcon(LOGO_MARK, INK, 1.7, LOGO_MARK.file);

  // CTA glyph is white because it sits on the dark green button.
  const truck = ICONS.find((i) => i.file === "icon-truck.png");
  await writeIcon(truck, "#FFFFFF", 2.8, "icon-truck-white.png");

  // Dark footer band: trust glyphs and social glyphs, all white.
  for (const icon of [...WHITE_ICONS, ...SOCIAL_ICONS]) {
    await writeIcon(icon, "#FFFFFF", FOOTER_STROKE_WIDTH, icon.file);
  }

  // CONFIRMATION HERO. Painted as the confirmation panel's full-bleed
  // background, so the crop has to satisfy two opposing constraints at once:
  //   - the left ~330px must stay FLAT, because that is where the copy column
  //     sits, and
  //   - the succulent must stay in frame on the right, because it is the whole
  //     reason the panel is a photo and not a flat colour.
  // The source is 2172x724 (3:1) and the panel is 620x300 (2.07:1), so
  // `fit: cover` cannot keep the whole width: it scales to the target height
  // and crops the width down to ~1496px. `position: "right"` then keeps the
  // RIGHTMOST 1496px, which is the only anchor that satisfies both rules —
  // anchoring left would push the plant out of frame, and centre would clip
  // ~150px off the empty wall the copy needs. What survives is ~990px (66%) of
  // flat cream on the left and the full plant on the right.
  const confW = CONFIRMATION_PANEL_W * 2;
  const confH = CONFIRMATION_PANEL_H * 2;
  await sharp(CONFIRMATION_SOURCE)
    .resize(confW, confH, { fit: "cover", position: "right" })
    .composite([{ input: confirmationVeilSvg(confW, confH), blend: "over" }])
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(path.join(OUT_DIR, "hero-confirmation.jpg"));
  process.stdout.write(
    `hero-confirmation.jpg     ${confW}x${confH} jpeg (veiled)\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

