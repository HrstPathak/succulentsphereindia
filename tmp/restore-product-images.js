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

// EDIT THESE: Add the 2 products that need image restoration
const productsToRestore = [
  {
    handle: 'baby-sunrose-aptenia-cordifolia-fast-growing-flowering-trailer',
    imageUrl: 'https://whitesmoke-cattle-754161.hostingersite.com/sites/images/baby-sunrose.jpg', // Change this to actual URL
  },
  {
    handle: 'crassula-swaziensis-money-maker-variegated',
    imageUrl: 'https://whitesmoke-cattle-754161.hostingersite.com/sites/images/crassula-swaziensis.jpg', // Change this to actual URL
  },
];

async function run() {
  console.log(`Restoring images for ${productsToRestore.length} products...\n`);

  const results = { restored: [], failed: [] };

  for (const product of productsToRestore) {
    try {
      // Find product by handle
      const snapshot = await db.collection('products')
        .where('handle', '==', product.handle)
        .limit(1)
        .get();

      if (snapshot.empty) {
        results.failed.push({ handle: product.handle, error: 'Product not found' });
        continue;
      }

      const doc = snapshot.docs[0];
      const productData = doc.data();

      // Update with new image
      await doc.ref.set(
        {
          image: product.imageUrl,
          images: [product.imageUrl],
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      results.restored.push({
        handle: product.handle,
        title: productData.title,
        image: product.imageUrl,
      });

      console.log(`✓ Restored: ${productData.title}`);
    } catch (error) {
      results.failed.push({
        handle: product.handle,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`✗ Failed: ${product.handle} - ${error}`);
    }
  }

  console.log('\n\nResults:');
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
