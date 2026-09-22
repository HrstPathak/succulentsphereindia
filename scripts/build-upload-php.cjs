/**
 * Generates hostinger/upload.local.php — the deploy-ready copy of
 * hostinger/upload.php with HOSTINGER_UPLOAD_TOKEN from .env.local injected.
 * upload.local.php is gitignored; upload it to Hostinger as public_html/upload.php.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const templatePath = path.join(root, "hostinger", "upload.php");
const outPath = path.join(root, "hostinger", "upload.local.php");

const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const token = (env.match(/^HOSTINGER_UPLOAD_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!token) {
  console.error("HOSTINGER_UPLOAD_TOKEN not found in .env.local");
  process.exit(1);
}

const template = fs.readFileSync(templatePath, "utf8");
if (!template.includes("PASTE_HOSTINGER_UPLOAD_TOKEN_HERE")) {
  console.error("Template already has a token baked in — nothing to do.");
  process.exit(0);
}

fs.writeFileSync(outPath, template.replace("PASTE_HOSTINGER_UPLOAD_TOKEN_HERE", token));
console.log(`Wrote ${outPath}`);
console.log("Next: upload this file to Hostinger as public_html/upload.php (see hostinger/README.md).");
