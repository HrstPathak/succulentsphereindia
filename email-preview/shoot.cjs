#!/usr/bin/env node
/**
 * Renders the order status email to PNGs so the layout can be eyeballed
 * without a mail client. Preview tooling only — not shipped.
 *
 * The HTML is generated here from the SAME compiled template the verifier
 * checks, rather than read from a checked-in file. An earlier version read
 * render/<STATUS>.html from disk, which silently screenshotted a stale build
 * after the template changed — the preview looked fine while the real email
 * was broken. Nothing is written that is not derived from orderStatus.js.
 *
 * Usage:
 *   npm run order:email:verify
 *   node email-preview/shoot.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const DIR = __dirname;
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const STATUSES = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

/** Must match the fixture in verify.cjs so the preview shows the same email. */
const BASE = {
  orderNumber: 1009,
  customerName: "Harshit Pathak",
  trackingNumber: "1234567890123",
  trackingUrl: "https://www.delhivery.com/track/package/1234567890123",
  carrier: "Delhivery",
};

/**
 * The rendered HTML points at https://succulentsphere.com/images/email/*.
 * Those files only exist after a deploy, so for local review we rewrite the
 * origin to a relative path that resolves against public/ on disk.
 */
function localize(html) {
  return html.replace(
    /https?:\/\/[^"']*\/images\/email\//g,
    (m) => `file:///${path.join(__dirname, "..", "public", "images", "email").replace(/\\/g, "/")}/`,
  );
}

function buildHtml() {
  const { buildOrderStatusEmail } = require("./render/orderStatus.js");
  for (const status of STATUSES) {
    const { html } = buildOrderStatusEmail({
      ...BASE,
      status,
      amountDue: status === "OUT_FOR_DELIVERY" ? 249 : 0,
    });
    fs.writeFileSync(path.join(DIR, "render", `${status}.html`), html);
  }
}

(async () => {
  buildHtml();

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

    for (const status of STATUSES) {
      const file = path.join(DIR, "render", `${status}.html`);
      if (!fs.existsSync(file)) continue;
      const out = path.join(DIR, "render", `${status}.local.html`);
      fs.writeFileSync(out, localize(fs.readFileSync(file, "utf8")));
      await page.goto(`file:///${out.replace(/\\/g, "/")}`, { waitUntil: "load" });
      await page.screenshot({
        path: path.join(DIR, "render", `${status}-${viewport.name}.png`),
        fullPage: true,
      });
      console.log(`${status}-${viewport.name}.png`);
    }

    await page.close();
  }

  await browser.close();
})();
