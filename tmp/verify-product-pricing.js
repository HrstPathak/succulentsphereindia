const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8212;|&#8211;|&mdash;|&ndash;|—|–/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

loadEnv(path.join(__dirname, '..', '.env.local'));
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const targetTitles = [
  'Ruby Necklace (Othonna capensis) — Purple Red Trailing Succulent',
  'Echeveria Menina — Soft Pastel Pink Ruffled Rosette Succulent',
  'Sedum Nussaumerianum — Warm Yellow Orange Trailing Stonecrop',
  'Aeonium Kiwi — Tricolor Pink Green Yellow Rosette',
  'Pincushion Cactus — Compact Globe Indoor Cactus',
  'Haworthia Truncata — Horse\'s Teeth Square Cut Window Succulent',
  'Burro\'s Tail'
];

(async () => {
  const snapshot = await db.collection('products').get();
  const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const result = {};

  for (const title of targetTitles) {
    const normalizedQuery = normalizeTitle(title);
    const match = docs.find((d) => normalizeTitle(d.title || '') === normalizedQuery);
    if (!match) {
      result[title] = { found: false };
      continue;
    }

    result[title] = {
      found: true,
      id: match.id,
      title: match.title,
      price: match.price,
      compareAtPrice: match.compareAtPrice,
      available: match.available,
      inventoryQuantity: match.inventoryQuantity,
      status: match.status,
      availability: match.availability,
    };
  }

  console.log(JSON.stringify(result, null, 2));
})();
