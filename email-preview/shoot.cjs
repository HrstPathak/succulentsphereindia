#!/usr/bin/env node
/**
 * Renders email-preview/render/<STATUS>.html to a PNG so the layout can be
 * eyeballed without a mail client. Preview tooling only — not shipped.
 *
 * Usage:
 *   npx tsc src/lib/email-templates/orderStatus.ts --outDir email-preview/render \
 *     --module commonjs --target ES2019 --skipLibCheck --lib es2020,dom
 *   node email-preview/shoot.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const DIR = __dirname;
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const STATUSES = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

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

(async () => {
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
