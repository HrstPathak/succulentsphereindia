"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MapPin, Truck, XCircle } from "lucide-react";
import { checkPincodeServiceability, normalizePincode, type PincodeServiceabilityResponse } from "@/lib/pincodeServiceability";

type Props = {
  className?: string;
  onResult?: (result: PincodeServiceabilityResponse) => void;
};

export default function PincodeServiceabilityCard({ className = "", onResult }: Props) {
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PincodeServiceabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCheck() {
    const normalized = normalizePincode(pincode);
    if (normalized.length !== 6) {
      setError("Enter a valid 6-digit pincode.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await checkPincodeServiceability(normalized);
      setResult(response);
      onResult?.(response);
    } catch (checkError) {
      setResult(null);
      setError((checkError as Error).message || "Unable to verify pincode right now.");
    } finally {
      setLoading(false);
    }
  }

  const currentState = error
    ? "error"
    : result?.serviceable
      ? "serviceable"
      : result
        ? "unserviceable"
        : "idle";

  return (
    <div className={`rounded-2xl border border-emerald-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(236,251,241,0.88))] p-4 shadow-[0_16px_38px_rgba(25,91,57,0.14)] ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Pincode Serviceability</p>
          <p className="mt-1 text-xs text-emerald-900/80">Check if this plant can be delivered to your area.</p>
        </div>
        <div className="rounded-full border border-emerald-300/60 bg-white/80 p-2 text-emerald-700">
          <Truck size={16} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/80" size={16} />
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(event) => {
              setPincode(normalizePincode(event.target.value));
              setError(null);
              setResult(null);
            }}
            placeholder="Enter 6-digit pincode"
            className="w-full rounded-xl border border-emerald-200 bg-white/90 py-2.5 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none ring-0 transition focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
          />
        </div>
        <button
          type="button"
          onClick={onCheck}
          disabled={loading || pincode.length !== 6}
          className="rounded-xl bg-[linear-gradient(135deg,#1f6a44,#2e8459)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(27,94,62,0.32)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              Checking
            </span>
          ) : (
            "Check"
          )}
        </button>
      </div>

      {currentState !== "idle" && (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            currentState === "serviceable"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : currentState === "unserviceable"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-start gap-2">
            {currentState === "serviceable" ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{error || result?.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
