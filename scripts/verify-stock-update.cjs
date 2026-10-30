/**
 * verify-stock-update.cjs
 * Spot-checks a few products to confirm inventoryQuantity = 1000 and status unchanged.
 * Run: node --env-file=.env.local scripts/verify-stock-update.cjs
 */

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const text = (value) => String(value || "").trim();
const projectId = text(process.env.FIREBASE_PROJECT_ID);
const clientEmail = text(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();

const app = getApps()[0] || initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore(app);

async function main() {
  const snapshot = await db.collection("products").limit(10).get();
  console.log(`\nSample of ${snapshot.docs.length} products:\n`);
  console.log(`${"ID".padEnd(40)} ${"Stock".padEnd(8)} ${"Status".padEnd(15)} Available`);
  console.log("-".repeat(75));

  let allStock1000 = true;
  let statusChanged = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const stockOK = data.inventoryQuantity === 1000;
    if (!stockOK) allStock1000 = false;
    console.log(
      `${String(data.id || doc.id).padEnd(40)} ${String(data.inventoryQuantity).padEnd(8)} ${String(data.status).padEnd(15)} ${data.available}`
    );
  });

  // Check all products for stock = 1000
  const allSnapshot = await db.collection("products").get();
  const not1000 = allSnapshot.docs.filter(d => d.data().inventoryQuantity !== 1000);
  console.log(`\n---`);
  console.log(`Total products: ${allSnapshot.docs.length}`);
  console.log(`Products with stock = 1000: ${allSnapshot.docs.length - not1000.length}`);
  console.log(`Products NOT at stock = 1000: ${not1000.length}`);
  console.log(`All sampled products have stock = 1000: ${allStock1000}`);

  if (not1000.length > 0) {
    console.log("\nProducts not yet at 1000 stock:");
    not1000.forEach(d => console.log(`  - ${d.id}: ${d.data().inventoryQuantity}`));
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});