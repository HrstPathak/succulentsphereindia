import { NextResponse } from "next/server";
import { createSessionCookie, ensureUserProfile, setSessionCookie } from "@/lib/auth";
import { signUpWithPassword } from "@/lib/firebase-identity";

export async function POST(request: Request) {
  try {
    const { firstName, lastName, email, password } = await request.json();
    const safeEmail = String(email || "").trim().toLowerCase(); const safeFirstName = String(firstName || "").trim(); const safeLastName = String(lastName || "").trim();
    if (!safeFirstName || !safeLastName || !/^\S+@\S+\.\S+$/.test(safeEmail) || String(password || "").length < 8) return NextResponse.json({ error: "Please provide valid first name, last name, email, and an 8+ character password." }, { status: 400 });
    const credential = await signUpWithPassword(safeEmail, String(password));
    await ensureUserProfile({ uid: String(credential.localId), email: safeEmail, firstName: safeFirstName, lastName: safeLastName });
    const response = NextResponse.json({ ok: true }); setSessionCookie(response, await createSessionCookie(String(credential.idToken))); return response;
  } catch (error) { return NextResponse.json({ error: (error as Error).message || "Unable to create your account." }, { status: 400 }); }
}
