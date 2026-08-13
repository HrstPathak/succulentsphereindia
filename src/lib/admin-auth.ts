import "server-only";

import { getAuthenticatedCustomer } from "@/lib/auth";

function configuredAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function getAdminSession() {
  const session = await getAuthenticatedCustomer();
  const email = String(session.customer?.email || "").trim().toLowerCase();
  return {
    ...session,
    email,
    isAdmin: Boolean(email && configuredAdminEmails().has(email)),
  };
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.isAdmin) throw new Error("ADMIN_REQUIRED");
  return session;
}
