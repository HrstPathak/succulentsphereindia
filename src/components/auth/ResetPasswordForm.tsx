"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "./Button";
import Input from "./Input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type ResetPasswordFormProps = {
  oobCode: string;
};

type PasswordStrength = {
  score: number;
  label: string;
  color: string;
};

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Fair", color: "bg-amber-500" };
  if (score === 3) return { score, label: "Strong", color: "bg-[var(--color-secondary)]" };
  return { score, label: "Excellent", color: "bg-[var(--color-brand)]" };
}

export default function ResetPasswordForm({ oobCode }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let hasErrors = false;

    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      hasErrors = true;
    } else {
      setPasswordError(undefined);
    }

    if (!confirmPassword || confirmPassword !== password) {
      setConfirmError("Passwords must match.");
      hasErrors = true;
    } else {
      setConfirmError(undefined);
    }

    if (hasErrors) return;

    setLoading(true);
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode, password, confirmPassword }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to reset password."));
        return;
      }

      setDone(true);
      showSuccessToast("Password reset complete. Please sign in with your new password.");
      window.setTimeout(() => {
        window.dispatchEvent(new Event("auth:changed"));
        router.replace("/login");
        router.refresh();
      }, 1200);
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface)" }}>
        <div className="inline-flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-[var(--color-brand)] text-[var(--color-bg)]">
          OK
        </div>
        <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">Password updated successfully.</p>
        <p className="mt-1 text-xs text-[var(--auth-muted)]">Signing you in securely and redirecting to your account...</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={passwordError}
      />
      <div className="rounded-xl border p-3" style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface)" }}>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-[var(--auth-muted)]">Password strength</span>
          <span className="font-semibold text-[var(--color-text)]">{strength.label}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full ${index < strength.score ? strength.color : "bg-[var(--color-secondary)]/25"}`}
            />
          ))}
        </div>
      </div>
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={confirmError}
      />
      <Button type="submit" loading={loading}>
        Update Password
      </Button>
    </form>
  );
}
