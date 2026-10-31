/**
 * fix-product-images.cjs
 *
 * Fixes products where:
 * 1. The `image` field contains the literal string "[object Object]" instead of a valid URL.
 * 2. Entries within the `images[]` array contain the literal string "[object Object]".
 *
 * Extracts the first valid HTTP URL from the product's images array (or the top-level
 * image field) and uses it to repair broken entries.
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

/** Check if a value is a valid HTTP image URL string */
function isValidHttpUrl(value) {
  return typeof value === "string" && value.startsWith("http");
}

/** Extract the first valid HTTP image URL from any source */
function extractFirstValidUrl(imageField, images) {
  if (isValidHttpUrl(imageField)) return imageField;
  if (Array.isArray(images)) {
    for (const img of images) {
      if (isValidHttpUrl(img)) return img;
      if (typeof img === "object" && img && img.url && isValidHttpUrl(img.url)) return img.url;
    }
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

    const updates = {};
    let changed = false;

    // Fix 1: Top-level image field is "[object Object]"
    if (typeof image === "string" && image === "[object Object]") {
      const validUrl = extractFirstValidUrl(null, images);
      if (validUrl) {
        updates.image = validUrl;
        updates.updatedAt = new Date().toISOString();
        changed = true;
        console.log(`[FIX top-level] ${doc.id}`);
        console.log(`      Title: ${data.title}`);
        console.log(`      Old image: "${image}"`);
        console.log(`      New image: ${validUrl}`);
      } else {
        console.log(`[SKIP top-level] ${doc.id} - "[object Object]" image but no valid URL available`);
      }
    }

    // Fix 2: Entries within images[] array contain "[object Object]"
    if (Array.isArray(images) && images.length > 0) {
      const newImages = [...images];
      let arrayChanged = false;

      newImages.forEach((img, idx) => {
        if (typeof img === "string" && img === "[object Object]") {
          const validUrl = extractFirstValidUrl(image, images);
          if (validUrl) {
            newImages[idx] = validUrl;
            arrayChanged = true;
            console.log(`[FIX array[${idx}]] ${doc.id}`);
            console.log(`      Title: ${data.title}`);
            console.log(`      Replaced "[object Object]" with: ${validUrl}`);
          } else {
            console.log(`[SKIP array[${idx}]] ${doc.id} - "[object Object]" but no valid URL available`);
          }
        }
      });

      if (arrayChanged) {
        updates.images = newImages;
        updates.updatedAt = new Date().toISOString();
        changed = true;
      }
    }

    if (changed) {
      batch.update(doc.ref, updates);
      fixCount++;
      fixes.push({
        id: doc.id,
        title: data.title,
        updates,
      });
    }
  });

  if (fixCount === 0) {
    console.log("\nNo products need image fixing. All image fields and array entries are valid.");
    return;
  }

  console.log(`\nCommitting ${fixCount} fix(es) to Firestore...`);
  await batch.commit();
  console.log(`\nSuccessfully fixed ${fixCount} product(s).`);
  console.log("Status and available fields were NOT changed.");

  console.log("\n========================================");
  console.log("SUMMARY OF FIXES");
  console.log("========================================");
  fixes.forEach((f, i) => {
    console.log(`\n${i + 1}. ${f.id}`);
    console.log(`   Title: ${f.title}`);
    console.log(`   Updates: ${JSON.stringify(f.updates, null, 4)}`);
  });
}

main().catch((error) => {
  console.error("Error fixing images:", error);
  process.exitCode = 1;
});
