import type { Metadata } from "next";
import CheckoutClient from "../../components/checkout/CheckoutClient";

export const revalidate = 0;
export const metadata: Metadata = {
  title: "Secure Checkout",
  description:
    "Complete your purchase with secure checkout, verified payment, and fast order confirmation from Succulent Sphere.",
  alternates: {
    canonical: "/checkout",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return (
    <>
      <section className="bg-[var(--color-bg)] py-12 pt-20 min-h-screen">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-serif text-center mb-2">Checkout</h1>
          <p className="text-center text-sm mb-8">Information, Gathering, and secure Payment.</p>
          <CheckoutClient />
        </div>
      </section>
    </>
  );
}
