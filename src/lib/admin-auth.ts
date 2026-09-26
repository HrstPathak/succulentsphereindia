import "server-only";

import { getAuthenticatedCustomer, getSessionIdentity } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

function configuredAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Resolves the caller's admin status.
 *
 * This guards every admin API route and the whole admin UI, and all it needs
 * is one email string to compare against ADMIN_EMAILS. It used to call
 * getAuthenticatedCustomer(), which hydrates the ENTIRE customer profile:
 *
 *   users/{uid}                    1 read
 *   users/{uid}/addresses          1 + N reads
 *   orders (where userId, limit 50) up to 50 reads
 *   walletLedger (limit 200)         up to 200 reads
 *   walletHolds (limit 50)           up to 50 reads
 *                                   ------------
 *                                    up to ~300 reads per call
 *
 * With ~25 guarded routes that is thousands of reads for a request that only
 * ever reads one string, which is how a Spark/free-tier project exhausts its
 * 50k daily read quota.
 *
 * The verified session cookie already carries `email`, so the common path is
 * now zero Firestore reads. `options.orderLimit` is accepted for backwards
 * compatibility but is no longer needed for the admin check; pass
 * `hydrateProfile: true` if a caller genuinely wants the full profile.
 */
export async function getAdminSession(options?: { orderLimit?: number; walletTransactionLimit?: number; hydrateProfile?: boolean }) {
  const adminEmails = configuredAdminEmails();

  if (options?.hydrateProfile) {
    const session = await getAuthenticatedCustomer(options);
    const email = String(session.customer?.email || "").trim().toLowerCase();
    return { ...session, email, isAdmin: Boolean(email && adminEmails.has(email)) };
  }

  // Fast path: identity straight from the signed cookie, no Firestore.
  const identity = await getSessionIdentity();
  if (!identity.uid) {
    return { customer: null, uid: null, error: identity.error, email: "", isAdmin: false };
  }

  let email = identity.email;

  // Rare fallback: a token issued without an email claim. One document read,
  // never the full profile.
  if (!email) {
    try {
      const doc = await getFirebaseDb().collection("users").doc(identity.uid).get();
      email = String(doc.get("email") || "").trim().toLowerCase();
    } catch {
      email = "";
    }
  }

  return {
    customer: null,
    uid: identity.uid,
    error: undefined,
    email,
    isAdmin: Boolean(email && adminEmails.has(email)),
  };
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.uid) throw new Error("UNAUTHENTICATED");
  if (!session.isAdmin) throw new Error("ADMIN_REQUIRED");
  return session;
}
