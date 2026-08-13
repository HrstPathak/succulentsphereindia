"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import Button from "./Button";
import Input from "./Input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!isEmail(normalizedEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError(undefined);
    setLoading(true);
    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to send reset instructions."));
        return;
      }
      setDone(true);
      showSuccessToast("Reset instructions sent. Check your inbox.");
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to send reset instructions.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-2xl border p-4 text-sm text-[var(--color-text)]"
          style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface)" }}
        >
          <div className="mb-2 inline-flex h-9 w-9 animate-pulse items-center justify-center rounded-full bg-[var(--color-brand)] text-[var(--color-bg)]">
            OK
          </div>
          <p className="font-medium">We sent a password reset email.</p>
          <p className="mt-1 text-[var(--auth-muted)]">Open the secure Firebase link in your inbox to create a new password, then sign in.</p>
        </div>
        <Link href="/login" className="text-sm font-semibold text-[var(--color-accent)] transition-colors hover:text-[var(--color-brand)]">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={emailError}
      />
      <Button type="submit" loading={loading}>
        Send Reset Email
      </Button>
      <p className="text-xs text-[var(--auth-muted)]">For security, we only send reset links to registered accounts.</p>
      <p className="text-sm text-[var(--auth-muted)]">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-[var(--color-accent)] transition-colors hover:text-[var(--color-brand)]">
          Log in
        </Link>
      </p>
    </form>
  );
}
