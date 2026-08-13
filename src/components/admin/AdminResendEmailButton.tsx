"use client";

import { useState } from "react";

export default function AdminResendEmailButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function resend() {
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Resend failed");
      setNotice("Resend requested. Check logs or Firestore for status.");
    } catch (e) {
      setNotice(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button onClick={resend} disabled={busy} className="rounded-xl bg-[#24563e] px-3 py-2 text-white text-sm">
        {busy ? "Sending…" : "Resend confirmation email"}
      </button>
      {notice && <p className="mt-2 text-sm text-gray-700">{notice}</p>}
    </div>
  );
}
