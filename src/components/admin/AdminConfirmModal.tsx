"use client";

import { useEffect } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";

export type ConfirmTone = "warning" | "danger" | "success" | "info";

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

const TONE_STYLES: Record<ConfirmTone, { ring: string; icon: string; button: string }> = {
  warning: {
    ring: "border-amber-200 bg-amber-50",
    icon: "bg-amber-100 text-amber-700",
    button: "bg-amber-500 hover:bg-amber-600",
  },
  danger: {
    ring: "border-red-200 bg-red-50",
    icon: "bg-red-100 text-red-700",
    button: "bg-red-600 hover:bg-red-700",
  },
  success: {
    ring: "border-emerald-200 bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-700",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
  info: {
    ring: "border-[#d9e2d9] bg-[#f3f7f3]",
    icon: "bg-[#e3ede3] text-[#1f4a35]",
    button: "bg-[#1f4a35] hover:bg-[#163726]",
  },
};

/**
 * Premium in-app confirmation dialog. Replaces window.confirm/alert so the
 * admin never sees a native browser popup.
 */
export default function AdminConfirmModal({
  open,
  title,
  eyebrow,
  message,
  confirmLabel = "Yes, continue",
  cancelLabel = "No, go back",
  tone = "warning",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: AdminConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;
  const styles = TONE_STYLES[tone];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[#102419]/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl"
      >
        <header className={`flex items-start gap-4 border-b px-6 py-5 ${styles.ring}`}>
          <span className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}>
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6e826f]">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-0.5 font-serif text-2xl leading-tight text-[#102419]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="rounded-xl p-2 text-xl leading-none text-[#6e826f] transition hover:bg-black/5 disabled:opacity-40"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 text-sm leading-relaxed text-[#33443a]">
          <div>{message}</div>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[#e6ece6] bg-[#fafbf9] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-[#cfd9cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#33443a] transition hover:bg-[#f1f4f1] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 ${styles.button}`}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {busy ? "Working..." : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
