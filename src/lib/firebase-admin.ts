import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function required(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name}. Configure Firebase server credentials before using this feature.`);
  return value;
}

function getFirebaseAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const projectId = required("FIREBASE_PROJECT_ID");
  const clientEmail = required("FIREBASE_CLIENT_EMAIL");
  const privateKey = required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: String(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "").trim() || undefined,
  });
}

export function initializeFirebaseAdmin() {
  return getFirebaseAdminApp();
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseStorage() {
  return getStorage(getFirebaseAdminApp());
}
