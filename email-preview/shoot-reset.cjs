#!/usr/bin/env node
/**
 * Renders the password-reset email to PNGs so the layout can be eyeballed
 * without a mail client. Preview tooling only - not shipped.
 *
 * The HTML comes from the SAME template the send-test exercises, not from a
 * checked-in file, so the preview can never drift from what is sent.
 *
 * No real oobCode is used. Unlike the send-test this does not need a working
 * link - a preview is about layout, and a long realistic token exercises the
 * same wrapping as a real one without minting a live credential.
 *
 * Usage:
 *   node email-preview/shoot-reset.cjs
 *   npm run reset:email:preview
 *
 * Exits non-zero on horizontal overflow, so it can gate a commit. Overflow is
 * the one failure here that a PNG hides: the screenshot is of the viewport, so
 * a link that runs off the right edge is simply cropped out of view and still
 * looks fine.
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
  path.join(DIR, "..", "src", "lib", "email-templates", "resetPassword.ts"),
  { "./emailChrome": emailChrome },
);

// Shaped like a real oobCode: Firebase's are ~86 URL-safe characters. The exact
// value does not matter, only that it wraps the way a real one does.
const OOB = "eSg7l5I6K5Mvn5C32NKOUx4JbQ9pRzT1WdF7hYaL3cVnB6sEgM2kWuJ8dXqPf4RtYuI0oZ5";

// A name carrying a tag and an ampersand, so the preview shows the escaped
// greeting rather than the happy path. The greeting is the only user-supplied
// string in this email and it is the one most likely to be pasted as markup.
const VARIANTS = [
  { name: "named", displayName: "Harshit Pathak", email: "harshit@example.com" },
  { name: "escaped", displayName: 'A <script>alert(1)</script> & "friends"', email: "a+b@example.com" },
];

const VIEWPORTS = [
  { name: "desktop", width: 660, height: 1400 },
  { name: "mobile", width: 375, height: 1600 },
];

function localise(html) {
  // Point the hosted artwork at the working tree so a screenshot shows the real
  // icons instead of a row of broken-image boxes.
  const root = path.join(DIR, "..").replace(/\\/g, "/");
  return html.replace(
    /https:\/\/succulentsphere\.com\/images\/email\//g,
    `file:///${root}/public/images/email/`,
  );
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  let failed = 0;
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ deviceScaleFactor: 2 });

  for (const variant of VARIANTS) {
    const built = template.buildResetPasswordEmail({
      email: variant.email,
      oobCode: OOB,
      displayName: variant.displayName,
    });

    fs.writeFileSync(
      path.join(OUT, `reset-${variant.name}.html`),
      built.html,
      "utf8",
    );

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // The file:// copy first, so the assertion is made against the same bytes
      // that produced the PNG.
      await page.goto(
        `file:///${path.join(OUT, `reset-${variant.name}.html`).replace(/\\/g, "/")}`,
        { waitUntil: "load" },
      );
      if (variant.name === "named") {
        fs.writeFileSync(
          path.join(OUT, `reset-${variant.name}.local.html`),
          localise(built.html),
          "utf8",
        );
      }
      await page.setContent(localise(built.html), { waitUntil: "load" });

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );

      const ctaOk = await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll("a")).find((x) =>
          /reset-password\?oobCode=/.test(x.getAttribute("href") || ""),
        );
        return a ? a.getAttribute("href").includes("oobCode=eSg7l5I6K5") : false;
      });

      const png = path.join(OUT, `reset-${variant.name}-${viewport.name}.png`);
      await page.screenshot({ path: png, fullPage: true });
      console.log(`  ${path.basename(png)}`);

      const failures = [];
      if (overflow > 0) failures.push(`overflow ${overflow}px`);
      if (!ctaOk) failures.push("reset link missing or wrong");

      if (failures.length) failed += 1;
      console.log(
        `    ${failures.length ? `FAIL ${failures.join(", ")}` : "clean"}`,
      );
    }
  }

  await browser.close();
  console.log(`\nwrote screenshots to ${OUT}`);
  if (failed) {
    console.error(`\n${failed} viewport/variant combination(s) failed`);
    process.exit(1);
  }
})();
