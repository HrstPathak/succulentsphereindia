// Inspect pinned state of all articles — verify "only pinned blog on homepage"
const fs = require("fs");
const path = require("path");

// Minimal .env.local loader (no dependency)
(function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
})();

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = getApps()[0] || initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});

async function main() {
  const snap = await getFirestore(app).collection("articles").orderBy("publishedAt", "desc").limit(50).get();
  console.log(`total articles fetched: ${snap.size}`);
  let pinnedCount = 0;
  for (const d of snap.docs) {
    const x = d.data();
    if (x.pinned === true) pinnedCount += 1;
    console.log(
      `pinned=${JSON.stringify(x.pinned)} | pinnedAt=${x.pinnedAt || "-"} | status=${x.status || "-"} | publishedAt=${x.publishedAt || "-"} | ${String(x.title || "").slice(0, 70)}`
    );
  }
  console.log(`\narticles with pinned === true: ${pinnedCount}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
