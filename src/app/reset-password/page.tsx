import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your Succulent Sphere account using your secure reset link.",
  alternates: {
    canonical: "/reset-password",
  },
  robots: {
    index: false,
    follow: false,
  },
};

function getOobCode(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ oobCode?: string | string[] }> | { oobCode?: string | string[] };
}) {
  const resolved = await Promise.resolve(searchParams || {});
  const oobCode = getOobCode(resolved?.oobCode);

  return (
    <section className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 py-16">
      <div className="mx-auto flex min-h-[72vh] max-w-5xl items-center justify-center">
        <AuthCard title="Create a New Password" subtitle="Set a fresh password to secure your SucculentSphere account.">
          {oobCode ? (
            <ResetPasswordForm oobCode={oobCode} />
          ) : (
            <div
              className="space-y-3 rounded-2xl border p-4 text-sm text-[var(--color-text)]"
              style={{ borderColor: "var(--auth-danger-border)", backgroundColor: "var(--auth-danger-bg)" }}
            >
              <p className="font-semibold">Invalid or expired reset link.</p>
              <p className="text-[var(--auth-muted)]">Please request a new password reset email to continue.</p>
              <Link href="/forgot-password" className="inline-flex text-sm font-semibold text-[var(--color-accent)] transition-colors hover:text-[var(--color-brand)]">
                Request a new link
              </Link>
            </div>
          )}
        </AuthCard>
      </div>
    </section>
  );
}
