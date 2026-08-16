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
  
  console.log('Products with missing images:\n');
  
  const missing = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const image = data.image || '';
    const images = data.images || [];
    
    if (!image && (!images || images.length === 0)) {
      missing.push({
        id: doc.id,
        title: data.title || 'NO_TITLE',
        handle: data.handle || 'NO_HANDLE'
      });
    }
  }

  if (missing.length === 0) {
    console.log('✓ All products have images!');
    return;
  }

  console.log(`Found ${missing.length} products without images:\n`);
  missing.forEach((p, i) => {
    console.log(`${i + 1}. ${p.title}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Handle: ${p.handle}\n`);
  });

  // Output JSON for manual fixes
  console.log('\n\nJSON data for fixing (paste into fix script):');
  console.log(JSON.stringify(missing, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
