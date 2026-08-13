import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import type { FirebaseAuthenticatedCustomer } from "@/lib/commerce";
import { fetchCustomerByUid } from "@/lib/commerce";

export const AUTH_COOKIE_NAME = "ss_firebase_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5;

export function setSessionCookie(response: NextResponse, sessionCookie: string) {
  response.cookies.set(AUTH_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function createSessionCookie(idToken: string) {
  return getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
}

export async function getAuthenticatedCustomer(): Promise<{ customer: FirebaseAuthenticatedCustomer | null; uid: string | null; error?: string }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!sessionCookie) return { customer: null, uid: null };

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const customer = await fetchCustomerByUid(decoded.uid);
    return { customer, uid: decoded.uid };
  } catch {
    return { customer: null, uid: null, error: "Your session has expired. Please sign in again." };
  }
}

export async function requireAuthenticatedUid() {
  const session = await getAuthenticatedCustomer();
  if (!session.uid) throw new Error(session.error || "Unauthorized.");
  return session.uid;
}

export async function revokeCurrentSession(uid: string) {
  await getFirebaseAdminAuth().revokeRefreshTokens(uid);
}

export async function ensureUserProfile(input: { uid: string; email: string; firstName?: string; lastName?: string; displayName?: string; phone?: string | null }) {
  const db = getFirebaseDb();
  const ref = db.collection("users").doc(input.uid);
  const snapshot = await ref.get();
  const nameParts = String(input.displayName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = String(input.firstName || nameParts[0] || "").trim();
  const lastName = String(input.lastName || nameParts.slice(1).join(" ") || "").trim();
  const now = new Date().toISOString();
  await ref.set(
    {
      email: input.email.toLowerCase(),
      firstName,
      lastName,
      displayName: String(input.displayName || `${firstName} ${lastName}`).trim(),
      phone: input.phone || null,
      updatedAt: now,
      ...(snapshot.exists ? {} : { createdAt: now, defaultAddressId: null, wishlistProductIds: [] }),
    },
    { merge: true }
  );
}
