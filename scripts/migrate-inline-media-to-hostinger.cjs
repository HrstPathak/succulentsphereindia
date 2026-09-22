/**
 * Migrates media docs that were stored inline in Firestore (base64 "data"
 * field, fallback path used while the Hostinger endpoint was 404) to Hostinger,
 * and rewrites every article reference (cover image.url and contentHtml) from
 * /api/media/<id> to the new Hostinger URL.
 *
 * Uses the Firestore REST API with a manually-signed service-account JWT
 * (crypto createPrivateKey on the DER form), because the PEM import path
 * fails with OpenSSL 3 "DECODER routines::unsupported" on some machines.
 *
 * Usage:
 *   node scripts/migrate-inline-media-to-hostinger.cjs            # dry run
 *   node scripts/migrate-inline-media-to-hostinger.cjs --apply    # do it
 *   node scripts/migrate-inline-media-to-hostinger.cjs --limit 1  # first N only
 */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const APPLY = process.argv.includes("--apply");
function argValue(name, fallback = "0") {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] || fallback : fallback;
}
const LIMIT = Number(argValue("--limit")) || 0;

const root = path.join(__dirname, "..");

function loadEnv() {
  const vars = {};
  for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !line.trim().startsWith("#")) vars[m[1]] = m[2];
  }
  return vars;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(env) {
  const keyPem = (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const lines = keyPem.split("\n").filter((l) => l && !l.includes("-----"));
  const der = Buffer.from(lines.join(""), "base64");
  const privateKey = crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const assertion = `${header}.${payload}.${b64url(signer.sign(privateKey))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(body).slice(0, 300)}`);
  return body.access_token;
}
function base(api, p) {
  return `https://firestore.googleapis.com/v1/projects/${api.projectId}/databases/(default)/documents/${p}`;
}

async function listDocs(api, collection, pageSize = 300) {
  const out = [];
  let pageToken = "";
  do {
    const url = `${base(api, collection)}?pageSize=${pageSize}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${api.token}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`List ${collection} failed: ${JSON.stringify(body).slice(0, 300)}`);
    out.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return out;
}

function fieldsToObj(fields) {
  const obj = {};
  for (const [key, wrapper] of Object.entries(fields || {})) {
    if (wrapper.stringValue !== undefined) obj[key] = wrapper.stringValue;
    else if (wrapper.integerValue !== undefined) obj[key] = Number(wrapper.integerValue);
    else if (wrapper.doubleValue !== undefined) obj[key] = Number(wrapper.doubleValue);
    else if (wrapper.booleanValue !== undefined) obj[key] = wrapper.booleanValue;
    else obj[key] = null;
  }
  return obj;
}

function contentTypeToExt(contentType, fallbackName) {
  const map = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
  const fromName = (fallbackName || "").match(/\.([a-z0-9]{2,5})$/i);
  return map[contentType] || (fromName ? fromName[1].toLowerCase() : "jpg");
}

/** Uploads raw bytes to the Hostinger endpoint exactly like uploadToHostinger(). */
async function uploadToHostinger(env, bytes, filename, contentType) {
  const endpoint = String(env.HOSTINGER_UPLOAD_URL || "").trim();
  const token = String(env.HOSTINGER_UPLOAD_TOKEN || "").trim();
  const baseDir = String(env.HOSTINGER_UPLOAD_DIR || "public_html/products").replace(/^\/+|\/+$/g, "");
  const form = new FormData();
  form.append("file", new File([bytes], filename, { type: contentType }), filename);
  if (token) form.append("token", token);
  form.append("path", `${baseDir}/blog`);
  const res = await fetch(endpoint, { method: "POST", body: form, signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  if (res.ok && payload?.url) return payload.url;
  throw new Error(`${endpoint} -> HTTP ${res.status}: ${text.slice(0, 200)}`);
}

/** PATCH selected top-level fields; masked fields absent from `fields` are deleted. */
async function patchFields(api, collection, id, fields, mask) {
  const url = `${base(api, `${collection}/${id}`)}?${mask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&")}`;
  const doc = { name: base(api, `${collection}/${id}`), fields: {} };
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "number") {
      doc.fields[key] = Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    } else {
      doc.fields[key] = { stringValue: value };
    }
  }
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${api.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Patch ${collection}/${id} failed: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}
async function main() {
  const env = loadEnv();
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error("FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY missing in .env.local");
  }
  if (APPLY && !env.HOSTINGER_UPLOAD_URL) throw new Error("HOSTINGER_UPLOAD_URL missing in .env.local");

  const token = await getAccessToken(env);
  const api = { token, projectId: env.FIREBASE_PROJECT_ID };
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

  // 1. Inline media docs
  const mediaDocs = await listDocs(api, "media");
  const inline = mediaDocs.filter((d) => d.fields?.data?.stringValue);
  const targets = (LIMIT ? inline.slice(0, LIMIT) : inline).map((d) => ({
    id: d.name.split("/").pop(),
    data: d.fields.data.stringValue,
    contentType: d.fields.contentType?.stringValue || "image/jpeg",
    filename: d.fields.filename?.stringValue || "",
    mediaUrl: d.fields.url?.stringValue || "",
  }));
  console.log(`Inline media docs found: ${inline.length} (processing ${targets.length})`);

  const idToUrl = new Map();

  for (const target of targets) {
    const bytes = Buffer.from(target.data, "base64");
    const ext = contentTypeToExt(target.contentType, target.filename);
    const baseName =
      (target.filename || `media-${target.id}`).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80) ||
      `media-${target.id}`;
    const filename = `${baseName}.${ext}`;
    console.log(`- ${target.id}: ${filename} (${(bytes.length / 1024).toFixed(0)} KB), current url=${target.mediaUrl || "(none)"}`);

    if (!APPLY) continue;

    const newUrl = await uploadToHostinger(env, bytes, filename, target.contentType);
    console.log(`  uploaded -> ${newUrl}`);
    idToUrl.set(target.id, newUrl);

    await patchFields(api, "media", target.id, { url: newUrl, storage: "hostinger" }, [
      "url",
      "storage",
      "data",
      "contentType",
      "size",
    ]);
    console.log(`  media doc updated (data/contentType/size removed)`);
  }

  // 2. Rewrite article references (cover image + inline contentHtml)
  const articles = await listDocs(api, "articles");
  console.log(`Articles scanned: ${articles.length}`);
  let articleUpdates = 0;

  for (const doc of articles) {
    const id = doc.name.split("/").pop();
    const fields = fieldsToObj(doc.fields);
    const updates = {};
    const mask = [];

    const imageObj = doc.fields?.image?.mapValue?.fields || null;
    if (imageObj && imageObj.url?.stringValue) {
      const currentUrl = imageObj.url.stringValue;
      let nextUrl = currentUrl;
      for (const [mediaId, newUrl] of idToUrl) {
        nextUrl = nextUrl.split(`/api/media/${mediaId}`).join(newUrl);
      }
      if (nextUrl !== currentUrl) {
        imageObj.url = { stringValue: nextUrl };
        updates.image = { mapValue: { fields: imageObj } };
        mask.push("image");
      }
    }

    let contentHtml = fields.contentHtml || "";
    let contentChanged = false;
    for (const [mediaId, newUrl] of idToUrl) {
      if (contentHtml.includes(`/api/media/${mediaId}`)) {
        contentHtml = contentHtml.split(`/api/media/${mediaId}`).join(newUrl);
        contentChanged = true;
      }
    }
    if (contentChanged) {
      updates.contentHtml = contentHtml;
      mask.push("contentHtml");
    }

    if (!mask.length) continue;
    console.log(`- article ${id} (${fields.handle || "?"}): updating ${mask.join(", ")}`);
    articleUpdates += 1;
    if (APPLY) {
      const url = `${base(api, `articles/${id}`)}?${mask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&")}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${api.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: doc.name, fields: updates }),
      });
      const respBody = await res.json();
      if (!res.ok) throw new Error(`Patch article ${id} failed: ${JSON.stringify(respBody).slice(0, 300)}`);
    }
  }

  console.log(`Articles to update: ${articleUpdates}`);
  console.log(APPLY ? "Done." : "Dry run complete — re-run with --apply to execute.");
}

main().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});


