import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Succulent Sphere",
  description: "India-focused Privacy Policy for Succulent Sphere covering data collection, usage, payments, third-party sharing, retention, rights, and compliance.",
  alternates: {
    canonical: "/privacy-policy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f7f1e6_0%,#efe9dd_48%,#ebe6dc_100%)] pb-16 pt-20">
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#dbe8d7]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-[#f2dbc2]/45 blur-3xl" />
      <section className="relative container mx-auto px-4">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#ddd2c2] bg-[linear-gradient(180deg,#fff9ef_0%,#f5efe5_100%)] p-6 shadow-[0_35px_70px_-42px_rgba(56,69,59,0.75)] sm:p-10">
          <div className="mb-6 h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#4e6a58,#b98e66)]" />
          <p className="text-xs font-semibold tracking-[0.16em] text-[#607267]">LEGAL POLICY</p>
          <h1 className="mt-3 font-serif text-4xl text-[#1f2b24] sm:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#506158]">
            This Privacy Policy explains how Succulent Sphere collects, uses, stores, and protects personal information
            when you visit our website or place an order. It is aligned with the Information Technology Act, 2000 and
            applicable Indian data protection norms.
          </p>

          <div className="mt-5 rounded-2xl border border-[#e9dece] bg-white/70 p-5 text-sm text-[#415149]">
            <p><strong>Business Name:</strong> Succulent Sphere</p>
            <p><strong>Business Address:</strong> Bhimtal, Nainital, Uttarakhand &ndash; 263136, India</p>
            <p><strong>Support Email:</strong> support@succulentsphere.com</p>
            <p><strong>Phone:</strong> +91-9458321209</p>
            <p><strong>Business Hours:</strong> Monday &ndash; Saturday, 10:00 AM &ndash; 11:00 PM IST</p>
            <p><strong>Last Updated:</strong> 15 April 2026</p>
          </div>

          <div className="mt-8 space-y-5 text-sm leading-relaxed text-[#415149]">
            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">1. Information We Collect</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Personal identifiers:</strong> Name, email address, phone number, and shipping address provided during checkout or account registration.</li>
                <li><strong>Order &amp; transaction data:</strong> Purchase history, order status, payment method, and delivery details.</li>
                <li><strong>Technical data:</strong> Browser type, device information, IP address, cookies, and website analytics events.</li>
                <li><strong>Communication data:</strong> Messages sent via WhatsApp, email, or our contact form for support purposes.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">2. How We Use Your Information</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>To process orders, arrange shipment, and send delivery and tracking updates.</li>
                <li>To handle customer support queries, return requests, and refund processing.</li>
                <li>To verify COD advance payments and manage order confirmations.</li>
                <li>To improve website experience, product catalog quality, and service performance.</li>
                <li>To comply with legal obligations and prevent fraud.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">3. Payment Security</h2>
              <p className="mt-2">
                Payments on succulentsphere.com are processed through Razorpay and its secure banking network.
                Succulent Sphere does not store complete debit or credit card details, CVV, or PINs on its servers.
                All payment handling follows gateway-level encryption and industry-standard controls.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">4. Data Sharing With Third Parties</h2>
              <p className="mt-2">
                We share only the minimum necessary information with trusted third parties strictly for business
                operations:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Courier / Logistics:</strong> Delhivery and Shiprocket &mdash; for order fulfillment and delivery tracking.</li>
                <li><strong>Payment Processor:</strong> Razorpay &mdash; for secure payment handling.</li>
                <li><strong>Analytics:</strong> Website analytics providers &mdash; for performance monitoring and improvement.</li>
              </ul>
              <p className="mt-2">
                We do not sell, rent, or trade your personal information to any third party for marketing purposes.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">5. Cookies & Analytics</h2>
              <p className="mt-2">
                We use cookies and analytics tools to understand visitor behaviour, improve navigation, and optimize
                checkout conversion. You can manage cookie preferences through your browser settings, though some site
                features may be affected if cookies are disabled.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">6. Data Retention</h2>
              <p className="mt-2">
                Personal data is retained only as long as necessary for business, legal, accounting, and fraud
                prevention purposes. Data is periodically reviewed and deleted or anonymized when no longer required.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">7. Your Rights</h2>
              <p className="mt-2">
                Subject to applicable Indian law, you may request access to, correction of, or deletion of your
                personal information held by us. To make such a request, contact us at
                <strong> support@succulentsphere.com</strong> with your full name and order details.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">8. Children&apos;s Privacy</h2>
              <p className="mt-2">
                Our services are not directed to individuals under 18 years of age. We do not knowingly collect
                personal data from minors. If such data is identified, it will be removed promptly.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">9. Governing Law</h2>
              <p className="mt-2">
                This Privacy Policy is governed by the laws of India, including the Information Technology Act, 2000
                and applicable rules and standards. Any privacy-related dispute will be addressed under Indian
                jurisdiction.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">10. Contact for Privacy Concerns</h2>
              <div className="mt-2 space-y-2">
                <p><strong>Email:</strong> support@succulentsphere.com</p>
                <p><strong>Phone / WhatsApp:</strong> +91-9458321209</p>
                <p><strong>Address:</strong> Bhimtal, Nainital, Uttarakhand &ndash; 263136, India</p>
                <p><strong>Hours:</strong> Monday &ndash; Saturday, 10:00 AM &ndash; 11:00 PM IST</p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
