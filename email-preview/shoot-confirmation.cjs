#!/usr/bin/env node
/**
 * Renders the order confirmation email to PNGs so the layout can be eyeballed
 * without a mail client. Preview tooling only - not shipped.
 *
 * The HTML is generated here from the SAME compiled template the verifier
 * checks, rather than read from a checked-in file. An earlier version read
 * render/<STATUS>.html from disk, which silently screenshotted a stale build
 * after the template changed - the preview looked fine while the real email
 * was broken. Nothing is written that is not derived from orderConfirmation.js.
 *
 * Both payment shapes are shot, because the cash-on-delivery panel is the one
 * block whose presence changes the whole height of the message, and a preview
 * that only ever showed the prepaid layout would never surface a problem with
 * it.
 *
 * Usage:
 *   npm run order:email:build
 *   node email-preview/shoot-confirmation.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const DIR = __dirname;
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

/** Must match the fixture in verify-confirmation.cjs so the preview shows the
 *  same email the checks ran against. */
const BASE = {
  orderId: "o1",
  orderNumber: 1014,
  customerName: "Rose maria",
  customerEmail: "rosemariaofficial04@gmail.com",
  phone: "9778398376",
  address: "Vellookunnel house, thazepathinaramkandom",
  city: "murickassery p o",
  state: "Kerala",
  pincode: "685604",
  items: [
    {
      title: "Pink Moonstone (Pachyphytum oviferum) - Pearl Pink Egg Leaf",
      quantity: 3,
      price: 139,
      image: "https://cdn.example.com/products/pink-moonstone.jpg",
    },
    {
      title: "Moonstone (Pachyphytum oviferum) - Pearl White Egg Leaf",
      quantity: 3,
      price: 79,
      image: "https://cdn.example.com/products/moonstone.jpg",
    },
  ],
  shipping: 0,
  discount: 0,
  codFee: 0,
};

const VARIANTS = [
  {
    name: "prepaid",
    input: { ...BASE, total: 654, paymentMode: "prepaid", paymentReceived: 654 },
  },
  {
    name: "cod",
    input: {
      ...BASE,
      total: 724,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      paymentReceived: 100,
      codBalance: 624,
      codFee: 50,
    },
  },
];

/**
 * The rendered HTML points at https://succulentsphere.com/images/email/*.
 * Those files only exist after a deploy, so for local review we rewrite the
 * origin to a relative path that resolves against public/ on disk.
 *
 * Product images get the same treatment, as a generated local sample rather
 * than a strip. An earlier version blanked the cdn.example.com URLs outright,
 * on the reasonable-sounding grounds that a preview should not touch the
 * network. The consequence was that every preview showed a broken-image
 * placeholder where the plant thumbnail goes, which is exactly the region
 * whose layout was under review. A preview that cannot show the thing being
 * reviewed is worse than no preview, so the sample is synthesised here and
 * stays offline.
 */
const SAMPLE_THUMB = path.join(DIR, "render", "_sample-thumb.jpg");

function makeSampleThumb() {
  const sharp = require("sharp");
  // Two-tone gradient, so a squeezed or clipped thumbnail is obvious by eye
  // and not just "a grey box, probably fine".
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E8DCC8"/><stop offset="100%" stop-color="#9DB89A"/>
    </linearGradient></defs>
    <rect width="240" height="240" fill="url(#g)"/>
    <circle cx="120" cy="140" r="62" fill="#6E8F72"/>
    <text x="120" y="215" font-family="Arial" font-size="26" fill="#20352A" text-anchor="middle">plant</text>
  </svg>`;
  return sharp(Buffer.from(svg))
    .jpeg()
    .toBuffer()
    .then((buffer) => {
      // sharp is async; this runs before the browser opens, so awaiting it
      // here keeps the sample ready by the time the first page loads.
      require("node:fs").writeFileSync(SAMPLE_THUMB, buffer);
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

function buildHtml() {
  const {
    buildOrderConfirmationEmail,
    buildAdminOrderAlertEmail,
  } = require("./render/orderConfirmation.js");
  for (const variant of VARIANTS) {
    const { html } = buildOrderConfirmationEmail(variant.input);
    fs.writeFileSync(path.join(DIR, "render", `confirmation-${variant.name}.html`), html);
  }
  const { html } = buildAdminOrderAlertEmail(VARIANTS[1].input);
  fs.writeFileSync(path.join(DIR, "render", "admin-alert.html"), html);
}

(async () => {
  buildHtml();
  const sampleThumb = await makeSampleThumb();

  const browser = await chromium.launch({ executablePath: CHROME });

  // Desktop and phone widths. 390 is the narrowest phone in common use, so a
  // layout that survives it survives everything.
  const VIEWPORTS = [
    { name: "desktop", width: 700, height: 1400 },
    { name: "mobile", width: 390, height: 1400 },
  ];

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
    });

    for (const variant of VARIANTS) {
      const file = path.join(DIR, "render", `confirmation-${variant.name}.html`);
      if (!fs.existsSync(file)) continue;
      const out = path.join(DIR, "render", `confirmation-${variant.name}.local.html`);
      fs.writeFileSync(out, localize(fs.readFileSync(file, "utf8"), sampleThumb));
      await page.goto(`file:///${out.replace(/\\/g, "/")}`, { waitUntil: "load" });
      await page.screenshot({
        path: path.join(DIR, "render", `confirmation-${variant.name}-${viewport.name}.png`),
        fullPage: true,
      });
      console.log(`confirmation-${variant.name}-${viewport.name}.png`);
    }

    const adminOut = path.join(DIR, "render", "admin-alert.local.html");
    fs.writeFileSync(
      adminOut,
      localize(fs.readFileSync(path.join(DIR, "render", "admin-alert.html"), "utf8"), sampleThumb),
    );
    await page.goto(`file:///${adminOut.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await page.screenshot({
      path: path.join(DIR, "render", `admin-alert-${viewport.name}.png`),
      fullPage: true,
    });
    console.log(`admin-alert-${viewport.name}.png`);

    await page.close();
  }

  await browser.close();
})();
