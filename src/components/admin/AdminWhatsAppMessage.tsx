"use client";

import { useState } from "react";

export default function AdminWhatsAppMessage({
  phone,
  orderNumber,
  orderId,
  items,
  paymentMode,
  total,
  customerName,
  createdAt,
  address,
  fulfillmentStatus,
  trackingNumber,
}: {
  phone?: string | null;
  orderNumber?: string | number | null;
  orderId?: string | null;
  items?: Array<{ title?: string; quantity?: number; price?: string | number }>;
  paymentMode?: string | null;
  total?: string | number | null;
  customerName?: string | null;
  createdAt?: string | null;
  address?: string | null;
  fulfillmentStatus?: string | null;
  trackingNumber?: string | null;
}) {
  const [includeDefault, setIncludeDefault] = useState(true);
  const [extra, setExtra] = useState("");

  function sanitizePhone(raw?: string | null) {
    if (!raw) return null;
    const digits = String(raw).replace(/[^0-9]/g, "");
    if (!digits) return null;
    // If starts with 0, strip leading zeros
    const noLeading = digits.replace(/^0+/, "");
    // If remaining length is 10, assume India and prepend 91
    if (noLeading.length === 10) return `91${noLeading}`;
    // If already looks like it has country code, return as-is
    return noLeading;
  }

  function buildDefaultMessage() {
    const lines: string[] = [];
    const nf = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
    if (customerName) lines.push(`Hello ${customerName},`);
    if (orderNumber) lines.push(`Thank you for your order #${orderNumber}.`);
    if (createdAt) {
      try {
        const d = new Date(createdAt);
        lines.push(`Placed on: ${d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`);
      } catch {}
    }

    if (items && items.length) {
      lines.push("\nOrder details:");
      for (const it of items) {
        const q = it.quantity ?? 1;
        const pricePart = it.price != null ? ` — ${nf.format(Number(it.price))}` : "";
        lines.push(`• ${it.title || "Untitled"} x ${q}${pricePart}`);
      }
    }

    if (total != null) lines.push(`\nOrder total: ${nf.format(Number(total))}`);
    if (paymentMode) lines.push(`Payment: ${paymentMode}`);
    if (fulfillmentStatus) lines.push(`Status: ${fulfillmentStatus}`);
    if (trackingNumber) lines.push(`Tracking: ${trackingNumber}`);
    if (address) lines.push(`\nDelivery to: ${address}`);

    lines.push("\nIf you need help, reply here or contact our support.");
    return lines.join("\n");
  }

  function handleSend() {
    const phoneDigits = sanitizePhone(phone);
    if (!phoneDigits) {
      alert("Cannot detect a valid phone number for this order.");
      return;
    }
    const parts: string[] = [];
    if (includeDefault) parts.push(buildDefaultMessage());
    if (extra && extra.trim()) parts.push(String(extra).trim());

    const text = parts.join("\n\n");
    const encoded = encodeURIComponent(text);
    // Use api.whatsapp.com for broad compatibility
    const url = `https://api.whatsapp.com/send?phone=${phoneDigits}&text=${encoded}`;
    window.open(url, "_blank");
  }

  const defaultMsgPreview = buildDefaultMessage();

  return (
    <div className="mt-3">
      <label className="block text-sm font-medium">WhatsApp</label>
      <div className="mt-2 space-y-2">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={includeDefault}
            onChange={(e) => setIncludeDefault(e.target.checked)}
            className="mt-1"
            id="includeDefaultWhatsapp"
          />
          <label htmlFor="includeDefaultWhatsapp" className="text-sm">
            Include default message
          </label>
        </div>

        <label className="block text-sm font-medium">Extra message (optional)</label>
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-3 py-2" />

        <div>
          <div className="text-xs text-gray-600 mb-2">Preview:</div>
          <div className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-sm text-gray-800">{includeDefault ? defaultMsgPreview : ""}{includeDefault && extra ? "\n\n" : ""}{extra}</div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSend} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22l-4-9-9-4 18-7z" />
            </svg>
            Send via WhatsApp
          </button>
          <div className="text-sm text-gray-600 self-center">Will open WhatsApp (web/app) for the customer's number.</div>
        </div>
      </div>
    </div>
  );
}
