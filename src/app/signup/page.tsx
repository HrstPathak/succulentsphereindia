import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import SignupForm from "@/components/auth/SignupForm";
import { getAuthenticatedCustomer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Succulent Sphere account for faster checkout, order tracking, and personalized plant recommendations.",
  alternates: {
    canonical: "/signup",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignupPage() {
  const session = await getAuthenticatedCustomer();
  if (session.customer) {
    redirect("/account");
  }

  return (
    <section className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 py-16">
      <div className="mx-auto flex min-h-[72vh] max-w-5xl items-center justify-center">
        <AuthCard title="Create Account" subtitle="Join SucculentSphere for seamless checkout, order history, and tailored plant care.">
          <SignupForm />
        </AuthCard>
      </div>
    </section>
  );
}
