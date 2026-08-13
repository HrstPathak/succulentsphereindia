"use client";

import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

export default function Button({ children, loading = false, className = "", disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={`inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-bg)] shadow-[0_14px_34px_rgba(52,78,65,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_20px_40px_rgba(52,78,65,0.42)] disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-bg)]/35 border-t-[var(--color-bg)]" />
          <span>Please wait...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
