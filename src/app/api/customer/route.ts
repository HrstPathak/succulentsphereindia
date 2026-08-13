import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth";
import { getAdminSession } from "@/lib/admin-auth";
export async function GET() {
  const session = await getAdminSession();
  // The header calls this on every public page. An anonymous visitor is a
  // normal state, not an error worth surfacing in the browser console.
  if (!session.customer) {
    const response = NextResponse.json({ authenticated: false, customer: null });
    if (session.error) clearAuthCookies(response);
    return response;
  }
  return NextResponse.json({ authenticated: true, customer: session.customer, isAdmin: session.isAdmin });
}
