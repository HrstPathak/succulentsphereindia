import { NextResponse } from "next/server";
import { createSessionCookie, ensureUserProfile, setSessionCookie } from "@/lib/auth";
import { signInWithPassword } from "@/lib/firebase-identity";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalisedEmail = String(email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalisedEmail) || !String(password || "")) return NextResponse.json({ error: "Please provide a valid email and password." }, { status: 400 });
    const credential = await signInWithPassword(normalisedEmail, String(password));
    await ensureUserProfile({ uid: String(credential.localId), email: normalisedEmail, displayName: String(credential.displayName || "") });
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, await createSessionCookie(String(credential.idToken)));
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Incorrect email or password.", code: "INVALID_CREDENTIALS" }, { status: 401 });
  }
}
