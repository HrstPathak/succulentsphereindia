import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import LoginForm from "@/components/auth/LoginForm";
import { getAuthenticatedCustomer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Succulent Sphere account to manage orders, addresses, and wishlist.",
  alternates: {
    canonical: "/login",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}) {
  const session = await getAuthenticatedCustomer();
  if (session.customer) {
    redirect("/account");
  }
  const resolved = await Promise.resolve(searchParams || {});
  const authError = String(resolved?.error || "").trim();

  return (
    <section className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 py-16">
      <div className="mx-auto flex min-h-[72vh] max-w-5xl items-center justify-center">
        <AuthCard title="Welcome Back" subtitle="Sign in to manage orders and track your premium succulent deliveries.">
          {authError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{authError}</div>
          ) : null}
          <LoginForm />
        </AuthCard>
      </div>
      <p className="mt-8 text-center text-xs text-[var(--auth-muted)]">
        By continuing, you agree to our{" "}
        <Link href="/terms-and-conditions" className="underline decoration-[var(--color-secondary)]">
          terms
        </Link>
        .
      </p>
    </section>
  );
}
