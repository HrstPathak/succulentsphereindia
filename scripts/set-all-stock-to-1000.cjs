/**
 * set-all-stock-to-1000.cjs
 *
 * Sets inventoryQuantity = 1000 for ALL products in the Firestore `products` collection.
 *
 * IMPORTANT: This does NOT change `status` or `available`. Per commerce.ts logic,
 * a product still shows as "sold out" on the storefront if:
 *   - status === "sold out" || status === "out of stock"
 *   - available === false
 *   - inventory <= 0  <-- this is the only condition this script fixes
 *
 * Run: node --env-file=.env.local scripts/set-all-stock-to-1000.cjs
 */

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const text = (value) => String(value || "").trim();
const projectId = text(process.env.FIREBASE_PROJECT_ID);
const clientEmail = text(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Firebase Admin configuration is incomplete. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local");
}

const app = getApps()[0] || initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore(app);

async function main() {
  try {
    console.log("Fetching all products from Firestore...");
    const snapshot = await db.collection("products").get();

    if (snapshot.empty) {
      console.log("No products found.");
      return;
    }

    console.log(`Found ${snapshot.docs.length} product(s). Updating inventoryQuantity to 1000...`);

    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Only update if inventoryQuantity is not already 1000 (avoid unnecessary writes)
      if (data.inventoryQuantity !== 1000) {
        batch.update(doc.ref, {
          inventoryQuantity: 1000,
          updatedAt: new Date().toISOString(),
        });
        count++;
      }
    });

    if (count === 0) {
      console.log("All products already have inventoryQuantity = 1000. Nothing to update.");
      return;
    }

    await batch.commit();
    console.log(`Successfully updated ${count} product(s) to inventoryQuantity = 1000.`);
    console.log("Status and available fields were NOT changed.");
  } catch (error) {
    console.error("Error updating stock:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
