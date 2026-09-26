import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth";
import { getAdminSession } from "@/lib/admin-auth";

/** GET /api/customer — current customer/session (also returns isAdmin) */
export async function handleCustomer() {
  // The header calls this on every public page, but it has to return the real
  // profile (name, email, wallet) for the signed-in user, so the full hydrate
  // path is required here. hydrateProfile keeps that behaviour explicit now
  // that getAdminSession() defaults to the zero-read identity check used by the
  // admin routes.
  const session = await getAdminSession({ hydrateProfile: true });
  // The header calls this on every public page. An anonymous visitor is a
  // normal state, not an error worth surfacing in the browser console.
  if (!session.customer) {
    const response = NextResponse.json({ authenticated: false, customer: null });
    if (session.error) clearAuthCookies(response);
    return response;
  }
  return NextResponse.json({ authenticated: true, customer: session.customer, isAdmin: session.isAdmin });
}