/**
 * fix-product-images.cjs
 *
 * Fixes products where the `image` field contains the literal string "[object Object]"
 * instead of a valid URL. Extracts the first valid HTTP URL from the `images[]` array
 * and uses it to repair the `image` field.
 *
 * Does NOT change `status` or `available` fields.
 *
 * Run: node --env-file=.env.local scripts/fix-product-images.cjs
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

/** Extract the first valid HTTP image URL from a product's images array */
function extractFirstValidImage(images) {
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    if (typeof img === "string" && img.startsWith("http")) return img;
    if (typeof img === "object" && img && img.url && typeof img.url === "string" && img.url.startsWith("http"))
      return img.url;
  }
  return null;
}

async function main() {
  console.log("Fetching all products from Firestore...\n");
  const snapshot = await db.collection("products").get();
  console.log(`Found ${snapshot.docs.length} product(s).\n`);

  const batch = db.batch();
  let fixCount = 0;
  const fixes = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const image = data.image;
    const images = data.images;

    // Detect the "[object Object]" string bug
    if (typeof image === "string" && image === "[object Object]") {
      const validUrl = extractFirstValidImage(images);
      if (validUrl) {
        batch.update(doc.ref, { image: validUrl, updatedAt: new Date().toISOString() });
        fixCount++;
        fixes.push({
          id: doc.id,
          title: data.title,
          oldImage: image,
          newImage: validUrl,
        });
        console.log(`[FIX] ${doc.id}`);
        console.log(`      Title: ${data.title}`);
        console.log(`      Old image: "${image}"`);
        console.log(`      New image: ${validUrl}`);
      } else {
        console.log(`[SKIP] ${doc.id} - "[object Object]" image but no valid URL in images[] array`);
      }
    }
  });

  if (fixCount === 0) {
    console.log("\nNo products need image fixing. All image fields are valid.");
    return;
  }

  console.log(`\nCommitting ${fixCount} fix(es) to Firestore...`);
  await batch.commit();
  console.log(`\nSuccessfully fixed ${fixCount} product(s).`);
  console.log("Status and available fields were NOT changed.");

  console.log(`\n========================================`);
  console.log(`SUMMARY OF FIXES`);
  console.log(`========================================`);
  fixes.forEach((f, i) => {
    console.log(`\n${i + 1}. ${f.id}`);
    console.log(`   Title: ${f.title}`);
    console.log(`   Fixed image: ${f.newImage}`);
  });
}

main().catch((error) => {
  console.error("Error fixing images:", error);
  process.exitCode = 1;
});