/**
 * check-product-images.cjs
 * Diagnoses product image URLs in Firestore to understand why WhatsApp/Meta images may be missing.
 * Run: node --env-file=.env.local scripts/check-product-images.cjs
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
  const allSnapshot = await db.collection("products").get();
  console.log(`\n=== All ${allSnapshot.docs.length} products: Image field analysis ===\n`);

  let objectStringCount = 0;
  let absoluteUrlCount = 0;
  let relativePathCount = 0;
  let missingImageCount = 0;
  let soldOutCount = 0;
  let availableFalseCount = 0;
  let inventoryZeroCount = 0;

  const objectStringProducts = [];

  allSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const image = data.image;
    const images = data.images;
    const status = data.status;
    const available = data.available;
    const inventory = data.inventoryQuantity ?? data.quantity ?? data.totalInventory;

    if (typeof image === "string" && image === "[object Object]") {
      objectStringCount++;
      objectStringProducts.push({
        id: doc.id,
        title: data.title,
        image: image,
        images: images,
        status: status,
        available: available,
      });
      console.log(`\n[OBJECT STRING IMAGE] ${doc.id}`);
      console.log(`  title: ${data.title}`);
      console.log(`  image: "${image}"`);
      console.log(`  images array: ${JSON.stringify(images ? images.slice(0, 5) : null)}`);
      console.log(`  status: ${status} | available: ${available} | inventory: ${inventory}`);
    } else if (typeof image === "string" && image.startsWith("http")) {
      absoluteUrlCount++;
    } else if (typeof image === "string" && image.startsWith("/")) {
      relativePathCount++;
    } else if (!image) {
      missingImageCount++;
      console.log(`\n[MISSING IMAGE] ${doc.id} | title: ${data.title} | status: ${status}`);
    }

    if (String(status || "").toLowerCase() === "sold out") soldOutCount++;
    if (available === false) availableFalseCount++;
    if (Number(inventory || 0) <= 0) inventoryZeroCount++;
  });

  console.log(`\n========================================`);
  console.log(`SUMMARY`);
  console.log(`========================================`);
  console.log(`Total products: ${allSnapshot.docs.length}`);
  console.log(`Image = "[object Object]" string (BUG!): ${objectStringCount}`);
  console.log(`Image is absolute URL: ${absoluteUrlCount}`);
  console.log(`Image is relative path: ${relativePathCount}`);
  console.log(`Image missing entirely: ${missingImageCount}`);
  console.log(`Status = "sold out": ${soldOutCount}`);
  console.log(`Available = false: ${availableFalseCount}`);
  console.log(`Inventory <= 0: ${inventoryZeroCount}`);

  if (objectStringCount > 0) {
    console.log(`\n========================================`);
    console.log(`PRODUCTS WITH "[object Object]" IMAGE (NEED FIXING)`);
    console.log(`========================================`);
    objectStringProducts.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.id}`);
      console.log(`   Title: ${p.title}`);
      console.log(`   Image: "${p.image}"`);
      console.log(`   Images array: ${JSON.stringify(p.images)}`);
      console.log(`   Status: ${p.status} | Available: ${p.available}`);
    });

    // Check if these products have valid images in the `images` array
    const withValidImagesArray = objectStringProducts.filter(p =>
      Array.isArray(p.images) && p.images.some(img =>
        (typeof img === "string" && img.startsWith("http")) ||
        (typeof img === "object" && img && img.url && img.url.startsWith("http"))
      )
    );
    console.log(`\nOf these, ${withValidImagesArray.length} have valid URLs in the images[] array.`);

    const withoutValidImages = objectStringProducts.filter(p =>
      !Array.isArray(p.images) || !p.images.some(img =>
        (typeof img === "string" && img.startsWith("http")) ||
        (typeof img === "object" && img && img.url && img.url.startsWith("http"))
      )
    );
    console.log(`Of these, ${withoutValidImages.length} do NOT have any valid image URLs.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});