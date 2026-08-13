"use client";

import { Copy, ExternalLink } from "lucide-react";

type TrackingEntry = {
  number?: string;
  url?: string;
  company?: string;
};

export default function TrackingEntriesClient({ entries }: { entries: TrackingEntry[] }) {
  const normalized = entries.map((entry) => {
    const number = String(entry?.number || "").trim();
    const url =
      String(entry?.url || "").trim() ||
      (number ? `https://www.delhivery.com/tracking?waybill=${encodeURIComponent(number)}` : "");
    return {
      number,
      url,
      company: String(entry?.company || "").trim(),
    };
  });

  return (
    <div className="mt-6 space-y-2">
      {normalized.map((entry, index) => (
        <div key={`${entry.number}-${index}`} className="rounded-xl border border-[#e3d9ca] bg-white/80 p-3">
          <p className="text-sm font-semibold text-[#24372d]">Shipment {index + 1}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <InfoItem label="Carrier" value={entry.company || "-"} compact />
            <InfoItem label="Tracking Number" value={entry.number || "-"} compact />
            <div className="rounded-lg border border-[#e3d9ca] bg-white/90 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#6b766a]">Tracking URL</p>
              {entry.url ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    Open Delhivery Tracking
                    <ExternalLink size={12} />
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(entry.url);
                      } catch {
                        // ignore clipboard errors
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#d7c8b4] bg-white/90 px-2 py-1 text-[11px] font-semibold text-[#2f4438] transition hover:bg-white"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs font-semibold text-[#24372d]">-</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoItem({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-[#e3d9ca] bg-white/90 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#6b766a]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#24372d]">{value || "-"}</p>
    </div>
  );
}
