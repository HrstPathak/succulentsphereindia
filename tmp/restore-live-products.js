const fs = require("fs");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      }),
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
    });

const db = getFirestore(app);

const soldOutNames = [
  "Echeveria harmsii",
  "Echeveria Colorata",
  "Donkey tail",
  "Echeveria Blue Suprise",
  "English Evy",
  "Echeveria red Hole",
  "Purple wandering Jew",
  "Echeveria Blue Bird",
  "Wandering Jew",
  "Mammillaria Zeilmanniana",
  "Golden Moss",
  "Echeveria pink Crystal",
  "Bear;s Paw",
  "Haworthia Attenuata",
  "Sedum Sexangulare",
];

function normalizeTitle(value) {
  return String(value || "").trim().toLowerCase();
}

(async () => {
  const snap = await db.collection("products").get();
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const title = String(data.title || "").trim();
    if (!title) continue;

    const isSoldOut =
      soldOutNames.some((name) => {
        const normalized = normalizeTitle(title);
        const target = normalizeTitle(name);
        return normalized === target || normalized.includes(target);
      });

    const next = isSoldOut
      ? {
          available: false,
          inventoryQuantity: 0,
          quantity: 0,
          status: "sold out",
        }
      : {
          available: true,
          inventoryQuantity: 10,
          quantity: 10,
          status: "active",
        };

    await doc.ref.update(next);
    updated += 1;
  }

  console.log("UPDATED_PRODUCTS", updated);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
