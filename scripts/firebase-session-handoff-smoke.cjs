/* Tests the same server-side session handoff used after Google sign-in.
 * The disposable identity and Firestore profile are deleted on completion. */
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const text = (value) => String(value || "").trim();
const apiKey = text(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
const projectId = text(process.env.FIREBASE_PROJECT_ID);
const clientEmail = text(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
if (!apiKey || !projectId || !clientEmail || !privateKey) throw new Error("Firebase configuration is incomplete.");

const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const adminAuth = getAuth(app); const db = getFirestore(app);
const email = `ss-session-handoff-${Date.now()}@example.invalid`; const password = "HandoffSmoke!4829";

async function identity(endpoint, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json(); if (!response.ok) throw new Error(String(payload?.error?.message || "Firebase Identity request failed.")); return payload;
}

async function main() {
  let uid = "";
  try {
    const created = await identity("accounts:signUp", { email, password, returnSecureToken: true }); uid = String(created.localId);
    const sessionResponse = await fetch("http://localhost:3000/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: created.idToken }) });
    if (!sessionResponse.ok) throw new Error(`Session handoff returned ${sessionResponse.status}.`);
    const cookie = String(sessionResponse.headers.get("set-cookie") || "").split(";")[0];
    const rawCookieValue = cookie.slice(cookie.indexOf("=") + 1);
    const verifiedCookie = await adminAuth.verifySessionCookie(rawCookieValue, true);
    const customerResponse = await fetch("http://localhost:3000/api/customer", { headers: { cookie } });
    const customer = await customerResponse.json();
    console.log(JSON.stringify({ sessionHandoff: sessionResponse.ok, sessionCookieReturned: Boolean(cookie), cookieName: cookie.split("=")[0] || null, adminCanVerifyCookie: verifiedCookie.uid === uid, customerStatus: customerResponse.status, authenticatedCustomer: customerResponse.ok && customer?.authenticated === true, profileEmailMatches: customer?.customer?.email === email }));
  } finally {
    if (uid) { await db.collection("users").doc(uid).delete().catch(() => undefined); await adminAuth.deleteUser(uid).catch(() => undefined); }
  }
  console.log(JSON.stringify({ cleanup: "complete" }));
}
main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
