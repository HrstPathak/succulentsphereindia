/**
 * Quick end-to-end check of the Hostinger upload endpoint:
 *   node scripts/test-hostinger-upload.cjs
 * Expects HOSTINGER_UPLOAD_URL/TOKEN/DIR in .env.local (see hostinger/README.md).
 * Uploads a 1x1 test PNG to <dir>/blog and prints the response.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !line.trim().startsWith("#")) env[m[1]] = m[2];
}

const endpoint = env.HOSTINGER_UPLOAD_URL;
if (!endpoint) {
  console.error("HOSTINGER_UPLOAD_URL is not set in .env.local");
  process.exit(1);
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  const dir = `${String(env.HOSTINGER_UPLOAD_DIR || "public_html/products").replace(/^\/+|\/+$/g, "")}/blog`;
  const form = new FormData();
  form.append("file", new File([png], "test-image.png", { type: "image/png" }));
  if (env.HOSTINGER_UPLOAD_TOKEN) form.append("token", env.HOSTINGER_UPLOAD_TOKEN);
  form.append("path", dir);

  const res = await fetch(endpoint, { method: "POST", body: form, signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  console.log("status:", res.status);
  console.log("body:", text.slice(0, 500));
  try {
    const payload = JSON.parse(text);
    if (payload.url) {
      const check = await fetch(payload.url, { method: "HEAD" });
      console.log("verify:", check.ok ? "image URL is live ✓" : `image URL NOT reachable (HTTP ${check.status})`);
    }
  } catch {
    /* non-JSON body already printed */
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
