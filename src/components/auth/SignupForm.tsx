"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "./Button";
import Input from "./Input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { getFirebaseClientAuth, getGoogleProvider } from "@/lib/firebase-client";
import { signInWithPopup } from "firebase/auth";

type FormErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

function firebaseErrorMessage(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  if (code === "auth/popup-blocked") return "Your browser blocked the Google window. Allow popups for localhost and try again.";
  if (code === "auth/popup-closed-by-user") return "Google sign-in was cancelled before it completed.";
  if (code === "auth/unauthorized-domain") return "localhost is not authorised in Firebase Authentication. Add it under Authentication → Settings → Authorised domains.";
  if (code === "auth/operation-not-allowed") return "Google sign-in is not enabled in Firebase Authentication → Sign-in method.";
  return (error as Error)?.message || "Google sign-in failed.";
}

function validate(input: { firstName: string; lastName: string; email: string; password: string }): FormErrors {
  const errors: FormErrors = {};
  if (!input.firstName.trim()) errors.firstName = "First name is required.";
  if (!input.lastName.trim()) errors.lastName = "Last name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = "Enter a valid email address.";
  if (input.password.length < 8) errors.password = "Use at least 8 characters.";
  return errors;
}

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const prefill = String(searchParams.get("email") || "").trim();
    if (prefill && !email) setEmail(prefill);
  }, [searchParams, email]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate({ firstName, lastName, email, password });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Signup failed."));
        return;
      }

      window.dispatchEvent(new Event("auth:changed"));
      showSuccessToast("Your SucculentSphere account is ready.");
      router.replace("/account");
      router.refresh();
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignup() {
    setLoading(true);
    try {
      const credential = await signInWithPopup(getFirebaseClientAuth(), getGoogleProvider());
      const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await credential.user.getIdToken() }) });
      if (!response.ok) throw new Error("Unable to start your Google session.");
      window.dispatchEvent(new Event("auth:changed")); router.replace("/account"); router.refresh();
    } catch (error) { showErrorToast(firebaseErrorMessage(error)); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <button
        type="button"
        onClick={onGoogleSignup}
        className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-[#d6ddd8] bg-[linear-gradient(165deg,#ffffff_0%,#f6f8f7_52%,#edf2ef_100%)] px-4 py-2.5 text-sm font-semibold text-[#203128] shadow-[0_10px_24px_rgba(20,34,26,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#bdc9c2] hover:shadow-[0_16px_34px_rgba(20,34,26,0.18)]"
        >
          <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.5),transparent)] transition-transform duration-700 group-hover:translate-x-[420%]" />
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#d6ddd8] bg-white shadow-sm">
            <Image src="/google-g-logo.png" alt="" aria-hidden="true" width={16} height={16} className="h-4 w-4" />
          </span>
          <span>Continue with Google</span>
        </button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--auth-border)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-[0.12em] text-[var(--auth-muted)]">
          <span className="bg-[var(--auth-surface)] px-2">or</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          name="firstName"
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={errors.firstName}
        />
        <Input
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          error={errors.lastName}
        />
      </div>
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
      />
      <Button type="submit" loading={loading}>
        Create Account
      </Button>
      <p className="text-sm text-[var(--auth-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--color-accent)] transition-colors hover:text-[var(--color-brand)]">
          Log in
        </Link>
      </p>
    </form>
  );
}
