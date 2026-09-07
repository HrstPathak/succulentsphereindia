import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth";

/** POST /api/logout */
export async function handleLogout() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}