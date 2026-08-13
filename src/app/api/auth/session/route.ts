import { NextResponse } from "next/server";
import { createSessionCookie, ensureUserProfile, setSessionCookie } from "@/lib/auth";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json(); if (!idToken) return NextResponse.json({ error: "Missing identity token." }, { status: 400 });
    const decoded = await getFirebaseAdminAuth().verifyIdToken(String(idToken));
    await ensureUserProfile({ uid: decoded.uid, email: String(decoded.email || ""), displayName: String(decoded.name || "") });
    const response = NextResponse.json({ ok: true }); setSessionCookie(response, await createSessionCookie(String(idToken))); return response;
  } catch (error) {
    console.error("[firebase session]", error);
    return NextResponse.json({ error: "Google sign-in succeeded, but the secure website session could not be created. Check Firebase Admin credentials and restart the app." }, { status: 401 });
  }
}
