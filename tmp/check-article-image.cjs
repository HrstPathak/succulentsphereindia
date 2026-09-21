// Inspect the actual article doc in Firestore: does it have image set?
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = getApps()[0] || initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});

const handle = process.argv[2] || "why-is-my-succulent-dying-10-problems-fixes-for-indian-homes-2026";
const snap = await getFirestore(app).collection("articles").where("handle", "==", handle).limit(1).get();
if (snap.empty) {
  console.log(`NO DOC for handle: ${handle}`);
  const all = await getFirestore(app).collection("articles").orderBy("publishedAt", "desc").limit(10).get();
  console.log("recent handles:", all.docs.map((d) => `${d.id} :: ${d.data().handle} :: status=${d.data().status} :: image=${JSON.stringify(d.data().image)?.slice(0, 80)}`).join("\n"));
} else {
  const d = snap.docs[0];
  const data = d.data();
  console.log(`doc id: ${d.id}`);
  console.log(`status: ${data.status}`);
  console.log(`publishedAt: ${data.publishedAt}`);
  console.log(`updatedAt: ${data.updatedAt}`);
  console.log(`image: ${JSON.stringify(data.image, null, 2)}`);
  console.log(`tags: ${JSON.stringify(data.tags)}`);
}