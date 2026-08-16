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

loadEnv(path.join(process.cwd(), '.env.local'));
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('products').get();
  const handles = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const handle = String(data.handle || '').trim();
    if (handle) {
      handles.push({ handle, title: data.title || 'NO_TITLE' });
    }
  }

  console.log(`Total products in Firestore: ${snapshot.size}`);
  console.log(`Products with handles: ${handles.length}`);
  console.log('\nFirst 20 handles in Firestore:');
  handles.slice(0, 20).forEach((p, i) => {
    console.log(`${i + 1}. ${p.handle}`);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
