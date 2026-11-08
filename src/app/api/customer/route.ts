import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth";
import { handleCustomer } from "@/lib/api-handlers/root/customer";
import { getAdminSession } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

/** Lightweight storefront identity. Account pages request the full profile explicitly. */
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("profile") === "1") {
    return handleCustomer();
  }

  const session = await getAdminSession();
  if (!session.uid) {
    const response = NextResponse.json({ authenticated: false, customer: null });
    if (session.error) clearAuthCookies(response);
    return response;
  }

  // The storefront header needs the user's name/email and the wishlist needs
  // authentication status. Loading orders, addresses, and wallet history on
  // every public page was unnecessary; a single user document keeps the
  // existing display name while avoiding full account hydration.
  let profile: Record<string, unknown> = {};
  try {
    const snapshot = await getFirebaseDb().collection("users").doc(session.uid).get();
    profile = (snapshot.data() || {}) as Record<string, unknown>;
  } catch (error) {
    console.info("[api/customer] Could not load header profile; using session identity.", error);
  }

  const firstName = String(profile.firstName || "").trim();
  const lastName = String(profile.lastName || "").trim();
  const email = session.email || String(profile.email || "").trim().toLowerCase();
  const displayName = String(profile.displayName || `${firstName} ${lastName}`).trim()
    || email.split("@")[0]
    || "Customer";

  return NextResponse.json({
    authenticated: true,
    customer: {
      id: session.uid,
      firstName,
      lastName,
      displayName,
      email,
      phone: profile.phone ? String(profile.phone) : null,
      defaultAddressId: profile.defaultAddressId ? String(profile.defaultAddressId) : null,
      addresses: [],
      orders: [],
    },
    isAdmin: session.isAdmin,
  });
}
