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
  const firebaseProducts = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    firebaseProducts.push({
      id: doc.id,
      title: (data.title || '').trim().toLowerCase(),
      handle: data.handle || '',
      price: data.price,
      compareAtPrice: data.compareAtPrice
    });
  }

  // Your provided products (first 10 as example)
  const yourProducts = [
    { name: 'Ruby Necklace - Othonna Capensis (Purple Red Trailing Succulent)', regularPrice: 99, salePrice: 59 },
    { name: 'Echeveria Menina - Soft Pastel Pink Ruffled Rosette Succulent', regularPrice: 119, salePrice: 79 },
    { name: 'Sedum Nussaumerianum - Warm Yellow Orange Trailing Stonecrop', regularPrice: 109, salePrice: 69 },
    { name: 'Echeveria Pallida - Elegant Large Pale Green Ruffled Rosette', regularPrice: 139, salePrice: 89 },
    { name: 'Haworthiopsis Reinwardtii - Zebra Wart Striped Indoor Succulent', regularPrice: 240, salePrice: 159 },
  ];

  console.log('Checking if your product names match Firestore titles:\n');
  
  let matches = 0;
  for (const yourProd of yourProducts) {
    const yourTitle = yourProd.name.toLowerCase();
    const found = firebaseProducts.find(fp => fp.title.includes(yourTitle.split('-')[0].trim()) || yourTitle.includes(fp.title.split('-')[0].trim()));
    
    if (found) {
      console.log(`✓ MATCH: "${yourProd.name}"`);
      console.log(`  → Firestore: "${found.title}"`);
      console.log(`  → Handle: ${found.handle}\n`);
      matches++;
    } else {
      console.log(`✗ NO MATCH: "${yourProd.name}"\n`);
    }
  }

  console.log(`\nMatches found: ${matches} out of ${yourProducts.length}`);
  console.log(`\nAll Firestore product titles:`);
  firebaseProducts.forEach((p, i) => {
    console.log(`${i + 1}. ${p.title} (handle: ${p.handle})`);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
