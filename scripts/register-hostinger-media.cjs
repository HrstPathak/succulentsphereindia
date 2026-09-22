/**
 * Registers existing Hostinger files (uploaded manually via hPanel File
 * Manager, so they never got a Firestore media record) into the media
 * collection so they appear in the admin Media Library.
 *
 * Usage:
 *   node scripts/register-hostinger-media.cjs <relative-path> [<more-paths>...]
 *
 * Paths are relative to the web root, e.g.:
 *   sites/images/blog/propagating-from-leave.webp
 * or a full URL:
 *   https://whitesmoke-cattle-754161.hostingersite.com/sites/images/blog/x.webp
 */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const root = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !line.trim().startsWith("#")) env[m[1]] = m[2];
}
const BASE = String(env.NEXT_PUBLIC_MEDIA_BASE_URL || "").replace(/\/+$/, "");

function b64url(b) {
  return Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function getToken() {
  const lines = (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").split("\n").filter((l) => l && !l.includes("-----"));
  const key = crypto.createPrivateKey({ key: Buffer.from(lines.join(""), "base64"), format: "der", type: "pkcs8" });
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const p = b64url(JSON.stringify({ iss: env.FIREBASE_CLIENT_EMAIL, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const s = b64url(crypto.createSign("RSA-SHA256").update(`${h}.${p}`).sign(key));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${h}.${p}.${s}` }) });
  return (await r.json()).access_token;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: node scripts/register-hostinger-media.cjs <path-or-url> [...]");
    process.exit(1);
  }

  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const docUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/media`;

  // Existing URLs so we never create duplicates
  const existing = new Set();
  let pageToken = "";
  do {
    const res = await fetch(`${docUrl}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`, { headers });
    const body = await res.json();
    for (const d of body.documents || []) existing.add(((d.fields.url || {}).stringValue || "").split("?")[0]);
    pageToken = body.nextPageToken || "";
  } while (pageToken);

  for (const arg of args) {
    const full = arg.startsWith("http") ? arg : `${BASE}/${arg.replace(/^\/+/, "")}`;
    const pathname = decodeURIComponent(new URL(full).pathname);
    if (existing.has(full.split("?")[0])) {
      console.log(`skip (already registered): ${pathname}`);
      continue;
    }
    let live = false;
    try { live = (await fetch(full, { method: "HEAD" })).ok; } catch {}
    if (!live) {
      console.log(`NOT FOUND on Hostinger, skipping: ${full}`);
      continue;
    }
    const filename = pathname.split("/").pop() || "image";
    const record = {
      fields: {
        url: { stringValue: full.split("?")[0] },
        altText: { stringValue: filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ") },
        filename: { stringValue: filename },
        uploadedAt: { stringValue: new Date().toISOString() },
        uploadedBy: { stringValue: "hostinger-sync" },
        storage: { stringValue: "hostinger" },
      },
    };
    const res = await fetch(docUrl, { method: "POST", headers, body: JSON.stringify(record) });
    const body = await res.json();
    console.log(res.ok ? `registered: ${filename} -> ${full}` : `FAILED (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  }
}
main().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
