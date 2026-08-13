import { NextResponse } from "next/server";
import { sendPasswordReset } from "@/lib/firebase-identity";

export async function POST(request: Request) {
  const { email } = await request.json(); const safeEmail = String(email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(safeEmail)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  try {
    const origin = new URL(request.url).origin;
    // Firebase's hosted action page securely validates the reset code and
    // collects the new password, then returns the customer to this URL.
    await sendPasswordReset(safeEmail, `${origin}/login?reset=complete`);
  } catch {
    // Do not disclose whether an address has an account.
  }
  return NextResponse.json({ ok: true, message: "If your email exists, you will receive reset instructions shortly." });
}
