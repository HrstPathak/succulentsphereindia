"use client";

import { forwardRef, InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, name, error, className = "", type = "text", ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === "password" && showPassword ? "text" : type;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--color-text)]">{label}</span>
      <div className="relative">
        <input
          ref={ref}
          name={name}
          type={inputType}
          className={`h-11 w-full rounded-2xl border px-4 pr-12 text-sm text-[var(--color-text)] outline-none transition-all duration-200 focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[color:rgba(143,191,148,0.2)] ${className}`}
          style={{
            backgroundColor: "var(--auth-input-bg)",
            borderColor: "var(--auth-input-border)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
          {...props}
        />
        {type === "password" ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--color-text)]/70 transition-colors hover:text-[var(--color-text)]"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : null}
      </div>
      {error ? <span className="mt-2 block text-xs font-medium text-[var(--auth-danger-text)]">{error}</span> : null}
    </label>
  );
});

export default Input;
