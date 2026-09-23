// One-off data cleanup: keep ONLY the most recently pinned article pinned.
// Fixes the home page showing several blogs in the "Plant Care Journal" rail.
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
  const db = getFirestore(app);
  const snap = await db.collection("articles").where("pinned", "==", true).get();
  if (snap.empty) {
    console.log("No pinned articles — nothing to do.");
    return;
  }

  const docs = snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() }));
  // Keep the most recently pinned (pinnedAt), falling back to publishedAt.
  docs.sort((a, b) =>
    String(b.data.pinnedAt || b.data.publishedAt || "").localeCompare(
      String(a.data.pinnedAt || a.data.publishedAt || ""),
    ),
  );

  const keep = docs[0];
  const unpin = docs.slice(1);
  console.log(`pinned articles found: ${docs.length}`);
  console.log(`KEEPING: ${keep.data.title} (pinnedAt=${keep.data.pinnedAt || "-"})`);

  if (!unpin.length) {
    console.log("Already single-pin — no changes made.");
    return;
  }

  const batch = db.batch();
  for (const d of unpin) {
    batch.update(d.ref, { pinned: false, pinnedAt: null });
    console.log(`UNPINNING: ${d.data.title}`);
  }
  await batch.commit();
  console.log(`Done — unpinned ${unpin.length} article(s).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("ERROR:", e.message); process.exit(1); });