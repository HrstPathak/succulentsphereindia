#!/usr/bin/env node
/**
 * Renders the welcome email to PNGs so the layout can be eyeballed without a
 * mail client. Preview tooling only - not shipped.
 *
 * The HTML comes from the SAME compiled template the send-test exercises, not
 * from a checked-in file, so the preview can never drift from what is sent.
 *
 * The three artworks are fetched and encoded by the real pipeline and written
 * next to the HTML as files, then the `cid:` references are rewritten to point
 * at them. A browser cannot resolve `cid:`, so without this every screenshot
 * would show three broken-image boxes - the preview would hide exactly the
 * thing under review.
 *
 * Usage:
 *   node email-preview/shoot-welcome.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const DIR = __dirname;
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = path.join(DIR, "render");

function loadTypeScript(file) {
  const ts = require("typescript");
  const Module = require("node:module");
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  loaded._compile(output, file);
  return loaded.exports;
}

function loadTypeScriptWithMocks(file, mocks) {
  const Module = require("node:module");
  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return loadTypeScript(file);
  } finally {
    Module._load = originalLoad;
  }
}

const emailChrome = loadTypeScript(
  path.join(DIR, "..", "src", "lib", "email-templates", "emailChrome.ts"),
);
const template = loadTypeScriptWithMocks(
  path.join(DIR, "..", "src", "lib", "email-templates", "welcomeEmail.ts"),
  { "./emailChrome": emailChrome },
);
const assets = loadTypeScriptWithMocks(
  path.join(DIR, "..", "src", "lib", "welcome-email-assets.ts"),
  {
    "server-only": {},
    "@/lib/email-templates/welcomeEmail": template,
  },
);

/** Writes each embedded JPEG to disk and returns a cid -> file:// map. */
function materialise(artwork) {
  const map = {};
  for (const a of artwork.attachments) {
    const file = path.join(OUT, `${a.cid}.jpg`);
    fs.writeFileSync(file, a.content);
    map[`cid:${a.cid}`] = `file:///${file.replace(/\\/g, "/")}`;
  }
  return map;
}

const VARIANTS = [
  { name: "named", firstName: "Harshit", lastName: "Pathak" },
  { name: "noname", firstName: "", lastName: "" },
];

(async () => {
  const artwork = await assets.buildWelcomeImages();
  if (artwork.skipped.length) {
    console.warn(`artwork skipped: ${artwork.skipped.join(", ")}`);
  }
  const cidMap = materialise(artwork);

  // The trust strip and CTA icon live on the deployed origin, which does not
  // resolve locally, so point them at public/images/email on disk.
  const emailAssetDir = `file:///${path
    .join(DIR, "..", "public", "images", "email")
    .replace(/\\/g, "/")}/`;

  for (const variant of VARIANTS) {
    const built = template.buildWelcomeEmail({
      firstName: variant.firstName,
      lastName: variant.lastName,
      email: "rosemariaofficial04@gmail.com",
      images: artwork.images,
    });
    let html = built.html;
    for (const [cid, file] of Object.entries(cidMap)) {
      html = html.split(cid).join(file);
    }
    html = html.replace(
      /https?:\/\/[^"']*\/images\/email\//g,
      emailAssetDir,
    );
    fs.writeFileSync(path.join(OUT, `welcome-${variant.name}.html`), html);
    console.log(`${variant.name}: ${built.subject}`);
  }

  const browser = await chromium.launch({ executablePath: CHROME });
  // Desktop, the narrowest common phone, and the narrowest screen the previous
  // work guards against.
  const VIEWPORTS = [
    { name: "desktop", width: 700, height: 1600 },
    { name: "mobile", width: 390, height: 1600 },
    { name: "narrow", width: 320, height: 1600 },
  ];

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
    });
    for (const variant of VARIANTS) {
      const file = path.join(OUT, `welcome-${variant.name}.html`);
      await page.goto(`file:///${file.replace(/\\/g, "/")}`, {
        waitUntil: "networkidle",
      });
      const png = path.join(OUT, `welcome-${variant.name}-${viewport.name}.png`);
      await page.screenshot({ path: png, fullPage: true });
      // A horizontal scrollbar is the failure mode that a screenshot hides,
      // so measure it rather than trusting the eye.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      console.log(
        `  ${viewport.name.padEnd(8)} ${variant.name.padEnd(7)} ${overflow <= 0 ? "no overflow" : `OVERFLOW ${overflow}px`}`,
      );
    }
    await page.close();
  }

  await browser.close();
  console.log(`\nwrote screenshots to ${OUT}`);
})();
