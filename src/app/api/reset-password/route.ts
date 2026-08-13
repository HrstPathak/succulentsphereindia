import { NextResponse } from "next/server";
import { confirmPasswordReset } from "@/lib/firebase-identity";

export async function POST(request: Request) {
  try {
    const { oobCode, password, confirmPassword } = await request.json();
    if (!String(oobCode || "") || String(password || "").length < 8 || password !== confirmPassword) return NextResponse.json({ error: "Use a valid reset link and matching 8+ character passwords." }, { status: 400 });
    await confirmPasswordReset(String(oobCode), String(password));
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "This password-reset link is invalid or expired." }, { status: 400 }); }
}
