import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email-sender";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { to, subject, message } = await request.json();
    const recipient = String(to || "").trim().toLowerCase();
    const safeSubject = String(subject || "").trim().slice(0, 160);
    const safeMessage = String(message || "").trim().slice(0, 6000);
    if (!/^\S+@\S+\.\S+$/.test(recipient) || !safeSubject || !safeMessage) return NextResponse.json({ error: "Recipient, subject, and message are required." }, { status: 400 });
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#26342c">${safeMessage.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
    const delivery = await sendEmail({ to: recipient, subject: safeSubject, html });
    return NextResponse.json({ ok: true, id: delivery.id, provider: delivery.provider });
  } catch (error) { return NextResponse.json({ error: String((error as Error).message) === "ADMIN_REQUIRED" ? "Not found." : (error as Error).message }, { status: String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500 }); }
}
