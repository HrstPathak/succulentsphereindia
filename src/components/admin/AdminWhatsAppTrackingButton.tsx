"use client";

import { useState } from "react";

export interface AdminWhatsAppTrackingButtonProps {
  phone?: string | null;
  orderNumber?: string | number | null;
  awb?: string | null;
  trackingUrl?: string | null;
  customerName?: string | null;
  className?: string;
  disabled?: boolean;
  label?: string;
}

/**
 * A lightweight WhatsApp button that opens a chat with the customer's phone
 * number pre-filled with a template message containing the order number,
 * AWB/tracking number, and tracking link.
 *
 * Mirrors the WhatsApp behaviour already used in the admin orders section
 * (AdminWhatsAppMessage) and the Delhivery shipment panel
 * (AdminDelhiveryShipmentPanel.sendTrackingWhatsApp).
 */
export default function AdminWhatsAppTrackingButton({
  phone,
  orderNumber,
  awb,
  trackingUrl,
  customerName,
  className,
  disabled = false,
  label = "WhatsApp",
}: AdminWhatsAppTrackingButtonProps) {
  const [busy, setBusy] = useState(false);

  function sanitizePhone(raw?: string | null) {
    if (!raw) return null;
    const digits = String(raw).replace(/[^0-9]/g, "");
    if (!digits) return null;
    const noLeading = digits.replace(/^0+/, "");
    if (noLeading.length === 10) return `91${noLeading}`;
    return noLeading;
  }

  function handleSend() {
    if (disabled || busy) return;
    const phoneDigits = sanitizePhone(phone);
    if (!phoneDigits) {
      alert("Cannot detect a valid phone number for this order.");
      return;
    }
    const phoneWithCountryCode =
      phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;

    const lines: string[] = [];
    if (customerName) lines.push(`Hello ${customerName},`);
    lines.push("");
    if (orderNumber) {
      lines.push(
        `Your Succulent Sphere order #${orderNumber} has been shipped via Delhivery.`
      );
    }
    if (awb) lines.push(`AWB: ${awb}`);
    if (trackingUrl) lines.push(`Track your shipment: ${trackingUrl}`);
    lines.push("");
    lines.push("Thank you for shopping with Succulent Sphere!");

    const text = lines.join("\n");
    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encoded}`;

    setBusy(true);
    window.open(url, "_blank");
    setTimeout(() => setBusy(false), 500);
  }

  const hasValidPhone = Boolean(sanitizePhone(phone));
  const hasTracking = Boolean(awb || trackingUrl);

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={disabled || busy || !hasValidPhone || !hasTracking}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${busy
        ? "opacity-60 cursor-not-allowed"
        : disabled || !hasValidPhone || !hasTracking
          ? "border-red-200 bg-red-50 text-red-700 disabled:opacity-50"
          : "border-[#25D366] bg-[#25D366] text-white hover:bg-[#1EBE55] hover:border-[#1EBE55]"
        } ${className || ""}`}
      title={
        disabled || !hasValidPhone || !hasTracking
          ? "WhatsApp not available (missing phone or tracking info)"
          : `Send tracking to ${customerName || "customer"} via WhatsApp`
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="M22 2L11 13" />
        <path d="M22 2L15 22l-4-9-9-4 18-7z" />
      </svg>
      {busy ? "Sending…" : label}
    </button>
  );
}
