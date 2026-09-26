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
 *   npm run welcome:email:preview
 *
 * Exits non-zero when a layout assertion fails, so it can gate a commit. Three
 * checks beyond the screenshots, each for a regression that shipped looking
 * fine in a PNG: horizontal overflow, the hero lede escaping the photograph at
 * desktop, and the social chips not being geometrically circular.
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

  let failed = 0;
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

      // The other two failure modes a screenshot hides, for the same reason.
      // All three shipped once and none was visible by eye: the chips were
      // 33x35 (an ellipse at 50%), the hero overlay was 30px shorter than the
      // photo and clipped its own lede, and the grow photo left a 52px gap
      // under it. Each is a few pixels of geometry, so each is asserted.
      const geometry = await page.evaluate(() => {
        const round = (n) => Math.round(n);
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: round(r.top), bottom: round(r.bottom), w: round(r.width), h: round(r.height) };
        };

        // The hero <img> is in the row before the copy row, which is pulled up
        // over it, so walk back out of .ss-hero-copy to reach it.
        const heroCopy = document.querySelector(".ss-hero-copy");
        const heroImg = heroCopy
          ? heroCopy.closest("tr").previousElementSibling?.querySelector("img")
          : null;
        const ledeEl = document.querySelector(".ss-hero-lede");
        const lede = box(ledeEl);
        const hero = box(heroImg);

        // Every social chip, not just the first. Two separate things have to
        // hold for a chip to actually draw as a circle, and only asserting the
        // box was not enough: they measured a perfect 35x35 square while still
        // rendering as rounded rectangles.
        //
        //  - the cell must be square, or `50%` resolves to an ellipse. The
        //    wrapping table is 36px and the cell 34px + a 1px border, so a
        //    mismatch here is a real squeeze rather than a rounding artefact;
        //  - the chip's own table must not be in collapsing-border mode. The
        //    document-level `table { border-collapse:collapse }` otherwise wins
        //    and Chrome drops border-radius on the cell entirely.
        //
        // getComputedStyle still reports "50%" when the radius is not honoured,
        // so the collapse mode is what gets asserted, not the radius string.
        //
        // The shorthand is read rather than the longhand `borderCollapseStyle`
        // on purpose: on this Chromium build the longhand comes back
        // undefined, so a longhand comparison is false for every table and the
        // check flags good chips forever. The shorthand resolves.
        //
        // `a > table` rather than `a table`: these links are also used for the
        // footer's social row, and a descendant selector would match that
        // table too, which has nothing to do with the chips.
        const chips = Array.from(
          document.querySelectorAll(
            'a[href*="instagram"] > table, a[href*="facebook"] > table',
          ),
        ).map((t) => {
          const td = t.querySelector("td");
          const r = td.getBoundingClientRect();
          return {
            w: round(r.width),
            h: round(r.height),
            collapse:
              getComputedStyle(t).getPropertyValue("border-collapse"),
            circle:
              getComputedStyle(t).getPropertyValue("border-collapse") ===
                "separate" &&
              Math.abs(r.width - r.height) < 0.5,
          };
        });

        return {
          // On a phone the media query drops the overlay and stacks the copy
          // under the photo on purpose, so containment is a desktop-only rule.
          hero: { img: hero, lede },
          heroContained: hero && lede ? lede.bottom <= hero.bottom + 0.5 : null,
          chips,
          chipsCircle:
            chips.length > 0 && chips.every((c) => c.circle),
          grow: {
            art: box(document.querySelector(".ss-grow-art")),
            img: box(document.querySelector(".ss-grow-art img")),
          },
        };
      });

      // Stacked on a phone, so the grow row only has to match at desktop.
      const stacked = viewport.width < 600;
      const growDelta = stacked || !geometry.grow.art || !geometry.grow.img
        ? null
        : Math.abs(geometry.grow.art.h - geometry.grow.img.h);
      const growAligned = growDelta === null || growDelta <= 8;

      const failures = [];
      if (overflow > 0) failures.push(`overflow ${overflow}px`);
      // Containment is a desktop rule: the phone media query drops the overlay
      // and stacks the copy under the photo deliberately, so there the lede is
      // meant to sit below the image and this check would always fail.
      if (!stacked && geometry.heroContained === false) {
        failures.push("hero lede clipped");
      }
      if (!geometry.chipsCircle) failures.push("social chip not circular");
      if (!growAligned) failures.push(`grow photo off by ${growDelta}px`);

      if (failures.length) failed += 1;
      console.log(
        `  ${viewport.name.padEnd(8)} ${variant.name.padEnd(7)} ` +
          (failures.length ? `FAIL ${failures.join(", ")}` : "clean"),
      );
    }
    await page.close();
  }

  await browser.close();
  console.log(`\nwrote screenshots to ${OUT}`);
  // Non-zero so this can gate a commit, not just be read.
  if (failed) {
    console.error(`\n${failed} viewport/variant combination(s) failed`);
    process.exit(1);
  }
})();
