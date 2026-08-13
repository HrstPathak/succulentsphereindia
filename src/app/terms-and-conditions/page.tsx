import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Succulent Sphere",
  description: "India-compliant Terms & Conditions for Succulent Sphere covering website use, orders, pricing, shipping, refunds, liabilities, and dispute resolution.",
  alternates: {
    canonical: "/terms-and-conditions",
  },
};

export default function TermsAndConditionsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f4f0e7_0%,#efe9df_50%,#ebe6dc_100%)] pb-16 pt-20">
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#dbe8d7]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-[#f2dbc2]/40 blur-3xl" />
      <section className="relative container mx-auto px-4">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#ddd2c2] bg-[linear-gradient(140deg,#fff8ec_0%,#f2ede3_62%,#ecf2ea_100%)] p-6 shadow-[0_35px_70px_-42px_rgba(57,69,60,0.72)] sm:p-10">
          <div className="mb-6 h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#4e6a58,#b98e66)]" />
          <p className="text-xs font-semibold tracking-[0.16em] text-[#607267]">LEGAL</p>
          <h1 className="mt-3 font-serif text-4xl text-[#1f2b24] sm:text-5xl">Terms &amp; Conditions</h1>
          <p className="mt-3 text-sm text-[#506158]">
            These Terms &amp; Conditions govern your access to and use of succulentsphere.com, operated by
            Succulent Sphere, an India-based plant e-commerce business. By using our website or placing an order,
            you agree to these terms along with applicable Indian laws.
          </p>

          <div className="mt-5 rounded-2xl border border-[#e9dece] bg-white/70 p-5 text-sm text-[#415149]">
            <p><strong>Business Name:</strong> Succulent Sphere</p>
            <p><strong>Business Address:</strong> Bhimtal, Nainital, Uttarakhand &ndash; 263136, India</p>
            <p><strong>Support Email:</strong> support@succulentsphere.com</p>
            <p><strong>Phone:</strong> +91-9458321209</p>
            <p><strong>Business Hours:</strong> Monday &ndash; Saturday, 10Am-11PM</p>
            <p><strong>Last Updated:</strong> 15 April 2026</p>
          </div>

          <div className="mt-8 space-y-5 text-sm leading-relaxed text-[#43534a]">
            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">1. Use of Website</h2>
              <p className="mt-2">
                By accessing succulentsphere.com, you confirm that you are at least 18 years of age, and you agree to
                use the website only for lawful purposes. You must provide accurate, complete, and up-to-date
                information during registration, checkout, and any support interaction. Any misuse of the website or
                attempts to defraud or manipulate the platform may result in order cancellation and legal action.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">2. Product Information & Orders</h2>
              <p className="mt-2">
                Product visuals and descriptions are prepared with care to accurately represent what you will receive.
                For live plants, natural variation in size, colour tone, leaf shape, and growth form is normal and
                expected &mdash; it is not a defect.
              </p>
              <p className="mt-3">
                Orders are confirmed only after successful payment, or advance deposit for COD, and final acceptance by
                Succulent Sphere. We reserve the right to cancel an order in cases of stock unavailability, payment
                failure, or suspected fraud, with a full refund issued in such cases.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">3. Pricing &amp; Payments</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>All prices are listed in Indian Rupees (INR) and include applicable taxes.</li>
                <li>Prices and stock availability may change without prior notice.</li>
                <li>Payments are processed securely through Razorpay and authorized banking channels.</li>
                <li>We do not store full card details or CVV on our servers.</li>
                <li>For Cash on Delivery (COD) orders, an advance deposit of &#8377;100 is required at order placement, plus a &#8377;50 COD handling fee. The remaining amount is collected at delivery.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">4. Shipping &amp; Delivery</h2>
              <p className="mt-2">
                Shipping timelines, charges, courier partners, and COD terms are governed by our Shipping &amp; Delivery
                Policy. Estimated delivery is 6&ndash;8 business days from order date. Succulent Sphere is not liable for
                delays caused by the courier partner, incorrect address information provided by the customer, or force
                majeure events.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">5. Returns, Refunds &amp; Cancellations</h2>
              <p className="mt-2">
                Return and refund eligibility, processes, mandatory unboxing video requirements, and refund timelines
                are governed by our Refund &amp; Cancellation Policy. We accept returns only for defective, damaged, or
                incorrect items reported within 7 days of delivery with a valid unboxing video, and requests can be
                raised through WhatsApp or email.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">6. Intellectual Property</h2>
              <p className="mt-2">
                All website content, product visuals, text, branding, logos, and design assets are owned by or licensed to Succulent Sphere.
                Unauthorized copying, reproduction, scraping, resale, or redistribution of any content from this website
                is strictly prohibited and may be subject to legal action.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">7. Limitation of Liability</h2>
              <p className="mt-2">
                To the extent permitted by applicable Indian law, Succulent Sphere is not liable for indirect,
                incidental, special, or consequential damages arising from website use, order delays, courier
                disruptions, plant care outcomes after delivery, or third-party platform failures.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">8. Force Majeure</h2>
              <p className="mt-2">
                Succulent Sphere is not responsible for delay or non-performance of any obligation caused by events
                beyond reasonable control, including natural disasters, pandemics, transport shutdowns, government
                restrictions, or major technical outages. We will make reasonable efforts to communicate delays in
                such circumstances.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">9. Governing Law &amp; Dispute Resolution</h2>
              <p className="mt-2">
                These Terms &amp; Conditions are governed by the laws of India. Any dispute arising will first be
                attempted to be resolved through amicable support communication. If unresolved, the courts and
                tribunals having jurisdiction over Nainital, Uttarakhand, India will have exclusive jurisdiction.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">10. Updates to Terms</h2>
              <p className="mt-2">
                We may update these Terms &amp; Conditions from time to time. The updated date at the top of this page
                reflects the most recent revision. Continued use of the website after any update constitutes acceptance
                of the revised terms.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">11. Contact</h2>
              <div className="mt-2 space-y-2">
                <p><strong>Email:</strong> support@succulentsphere.com</p>
                <p><strong>Phone / WhatsApp:</strong> +91-9458321209</p>
                <p><strong>Address:</strong> Bhimtal, Nainital, Uttarakhand &ndash; 263136, India</p>
                <p><strong>Hours:</strong> Monday &ndash; Saturday, 10Am-11PM</p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
