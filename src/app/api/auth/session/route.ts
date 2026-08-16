import { NextResponse } from "next/server";
import { createSessionCookie, ensureUserProfile, setSessionCookie } from "@/lib/auth";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function authSessionErrorMessage(error: unknown) {
  const message = String((error as Error)?.message || "Unable to create secure website session.");
  const normalized = message.replace(/_/g, " ");
  const isConfigIssue = /missing .*firebase|firebase .*configuration|project.*id|service account|private key|verifyidtoken|invalid.*token|credential|auth.*domain/i.test(normalized);
  if (isConfigIssue) return normalized;
  if (process.env.NODE_ENV !== "production") return normalized;
  return "Google sign-in succeeded, but the secure website session could not be created. Please try again.";
}

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Missing identity token." }, { status: 400 });
    const decoded = await getFirebaseAdminAuth().verifyIdToken(String(idToken));
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, await createSessionCookie(String(idToken)));
    ensureUserProfile({ uid: decoded.uid, email: String(decoded.email || ""), displayName: String(decoded.name || "") }).catch((error) => {
      console.info(`[firebase session] profile sync skipped: ${String((error as Error)?.message || error)}`);
    });
    return response;
  } catch (error) {
    console.info(`[firebase session] ${String((error as Error)?.message || error)}`);
    return NextResponse.json({ error: authSessionErrorMessage(error) }, { status: 401 });
  }
}
