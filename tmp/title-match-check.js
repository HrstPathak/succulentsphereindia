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

loadEnv(path.join(process.cwd(), '.env.local'));
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const names = [
  'Ruby Necklace (Othonna capensis)',
  'Echeveria Menina',
  'Sedum Nussaumerianum',
  'Aeonium Kiwi',
  'Pincushion Cactus',
  'Haworthia Truncata',
  "Burro's Tail",
  'String of Bananas',
  'Echeveria Agavoides',
  'Crassula Campfire'
];

(async () => {
  const db = getFirestore();
  const docs = (await db.collection('products').get()).docs.map((d) => ({
    id: d.id,
    title: d.data().title || '',
  }));

  for (const name of names) {
    const query = normalizeTitle(name);
    const exact = docs.find((d) => normalizeTitle(d.title) === query);
    const includes = docs.filter((d) => {
      const n = normalizeTitle(d.title);
      return n.includes(query) || query.includes(n);
    }).slice(0, 10);

    console.log('NAME:', name);
    console.log('EXACT:', exact ? exact.title : 'NOT FOUND');
    console.log('INCLUDES:', includes.map((d) => d.title));
    console.log('---');
  }

  console.log('TOTAL DOCS:', docs.length);
})();
