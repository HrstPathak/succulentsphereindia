import { NextResponse } from "next/server";
import { createSessionCookie, ensureUserProfile, setSessionCookie } from "@/lib/auth";
import { signUpWithPassword } from "@/lib/firebase-identity";
import { sendWelcomeEmail } from "@/lib/welcome-email";

export async function POST(request: Request) {
  try {
    const { firstName, lastName, email, password } = await request.json();
    const safeEmail = String(email || "").trim().toLowerCase(); const safeFirstName = String(firstName || "").trim(); const safeLastName = String(lastName || "").trim();
    if (!safeFirstName || !safeLastName || !/^\S+@\S+\.\S+$/.test(safeEmail) || String(password || "").length < 8) return NextResponse.json({ error: "Please provide valid first name, last name, email, and an 8+ character password." }, { status: 400 });
    const credential = await signUpWithPassword(safeEmail, String(password));
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, await createSessionCookie(String(credential.idToken)));
    ensureUserProfile({ uid: String(credential.localId), email: safeEmail, firstName: safeFirstName, lastName: safeLastName }).catch((error) => {
      console.info(`[firebase signup] profile sync skipped: ${String((error as Error)?.message || error)}`);
    });
    // The welcome is fired and deliberately not awaited, for the same reason the
    // profile sync above is: embedding the artwork and talking to the mail
    // provider takes seconds, and a new customer should not stare at a spinner
    // for it. The session cookie is already set on `response`, so returning
    // now is safe, and sendWelcomeEmail never throws — it records and swallows.
    sendWelcomeEmail({ uid: String(credential.localId), email: safeEmail, firstName: safeFirstName, lastName: safeLastName }).catch((error) => {
      console.info(`[firebase signup] welcome email skipped: ${String((error as Error)?.message || error)}`);
    });
    return response;
  } catch (error) { return NextResponse.json({ error: (error as Error).message || "Unable to create your account." }, { status: 400 }); }
}
