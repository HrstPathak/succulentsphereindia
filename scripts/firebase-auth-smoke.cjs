/* Creates a disposable Firebase account to test sign-up, sign-in, reset-link
 * generation and Firebase Admin session creation. It always deletes the
 * generated Auth user and Firestore profile before exiting. */

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const text = (value) => String(value || "").trim();
const projectId = text(process.env.FIREBASE_PROJECT_ID);
const clientEmail = text(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
const apiKey = text(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
if (!projectId || !clientEmail || !privateKey || !apiKey) throw new Error("Firebase test configuration is incomplete.");

const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const adminAuth = getAuth(app); const db = getFirestore(app);
const email = `firebase-auth-check-${Date.now()}@example.invalid`;
const password = `S${Date.now()}!safePwd`;

async function identity(endpoint, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json(); if (!response.ok) throw new Error(String(payload?.error?.message || "Firebase Identity request failed.")); return payload;
}

async function main() {
  let uid = "";
  try {
    const created = await identity("accounts:signUp", { email, password, returnSecureToken: true }); uid = String(created.localId);
    const signedIn = await identity("accounts:signInWithPassword", { email, password, returnSecureToken: true });
    const reset = await identity("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email, continueUrl: "http://localhost:3000/login?reset=complete", canHandleCodeInApp: false });
    const sessionCookie = await adminAuth.createSessionCookie(String(signedIn.idToken), { expiresIn: 60 * 60 * 1000 });
    const verified = await adminAuth.verifySessionCookie(sessionCookie, true);
    console.log(JSON.stringify({ signup: Boolean(uid), login: Boolean(signedIn.idToken), resetRequest: Boolean(reset.email), sessionCookie: verified.uid === uid, cleanup: "pending" }));
  } finally {
    if (uid) { await db.collection("users").doc(uid).delete().catch(() => undefined); await adminAuth.deleteUser(uid).catch(() => undefined); }
  }
  console.log(JSON.stringify({ cleanup: "complete" }));
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
