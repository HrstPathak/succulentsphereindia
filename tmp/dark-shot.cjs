/* Dark-mode visual capture harness.
   Uses the chromium already on disk; forces `ss_theme` in localStorage before
   any script runs so the app's boot script adds `.dark` to <html>.

   usage: node tmp/dark-shot.cjs <mode> <comma,separated,paths> [full]
*/
const { chromium } = require("playwright-core");
const fs = require("fs");

const EXE =
  process.env.SS_CHROME ||
  "C:/Users/hpath/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = process.env.SS_BASE || "http://localhost:3000";

const mode = process.argv[2] || "dark";
const paths = (process.argv[3] || "/").split(",");
const fullPage = process.argv[4] === "full";
const tags = process.argv[5] || mode;

const slug = (p) => (p === "/" ? "home" : p.replace(/^\/+/, "").replace(/[/?=&]/g, "_"));

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
  });
  // runs before the app bundle -> the inline theme boot script sees it
  await ctx.addInitScript((m) => {
    try {
      localStorage.setItem("ss_theme", m);
    } catch {}
  }, mode);

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

  for (const p of paths) {
    try {
      await page.goto(BASE + p, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(2200);
      const dark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      const out = `tmp/shot-${tags}-${slug(p)}.png`;
      await page.screenshot({ path: out, fullPage });
      const dim = await page.evaluate(() => ({
        h: document.documentElement.scrollHeight,
        w: document.documentElement.scrollWidth,
      }));
      console.log(
        `${dark ? "DARK" : "LIGHT"} ${p.padEnd(28)} ${dim.w}x${dim.h} -> ${out}` +
          (fs.existsSync(out) ? ` (${(fs.statSync(out).size / 1024).toFixed(0)}kb)` : "")
      );
    } catch (e) {
      console.log(`FAIL ${p}: ${e.message.split("\n")[0]}`);
    }
  }
  if (errors.length) console.log("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
  await browser.close();
})();
