const fs = require('fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
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
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

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

const names = [
  ['Echeveria harmsii', 'succulent'],
  ['Echeveria Colorata', 'succulent'],
  ['Donkey tail', 'succulent'],
  ['Echeveria Blue Suprise', 'succulent'],
  ['English Evy', 'succulent'],
  ['Echeveria red Hole', 'succulent'],
  ['Purple wandering Jew', 'succulent'],
  ['Echeveria Blue Bird', 'succulent'],
  ['Wandering Jew', 'succulent'],
  ['Mammillaria Zeilmanniana', 'cactus'],
  ['Golden Moss', 'succulent'],
  ['Echeveria pink Crystal', 'succulent'],
  ['Bear;s Paw', 'succulent'],
  ['Haworthia Attenuata', 'succulent'],
  ['Sedum Sexangulare', 'succulent'],
];

async function main() {
  const snap = await db.collection('products').get();
  let matched = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const title = String(data.title || '').trim();
    if (!title) continue;

    const normalized = title.toLowerCase();
    const match = names.find(([name]) => normalized === name.toLowerCase() || normalized.includes(name.toLowerCase()));
    if (!match) continue;

    matched += 1;
    const productType = match[1];
    const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t ?? '').trim()).filter(Boolean) : [];
    const tagSet = new Set(tags);
    tagSet.add('39Rs');
    const nextTags = Array.from(tagSet);

    await doc.ref.update({
      inventoryQuantity: 0,
      quantity: 0,
      available: false,
      status: 'sold out',
      productType,
      type: productType,
      tags: nextTags,
    });

    console.log('UPDATED', doc.id, '::', title, '=>', JSON.stringify({
      productType,
      inventoryQuantity: 0,
      available: false,
      status: 'sold out',
      tags: nextTags,
    }));
  }

  console.log('MATCHED', matched);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
