import type { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Request a secure password reset link for your Succulent Sphere account.",
  alternates: {
    canonical: "/forgot-password",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordPage() {
  return (
    <section className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 py-16">
      <div className="mx-auto flex min-h-[72vh] max-w-5xl items-center justify-center">
        <AuthCard
          title="Reset Your Password"
          subtitle="Enter your account email and we will send a secure password reset link."
        >
          <ForgotPasswordForm />
        </AuthCard>
      </div>
    </section>
  );
}
