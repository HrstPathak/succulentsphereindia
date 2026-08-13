import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Succulent Sphere",
  description: "Refund and cancellation terms for Succulent Sphere orders, including our 7-day return window for defective items, WhatsApp or email support, refund processing, and unboxing video requirements.",
  alternates: {
    canonical: "/refund-policy",
  },
};

export default function RefundPolicyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f7f2e7_0%,#efe9df_50%,#ebe6dc_100%)] pb-16 pt-20">
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#dbe8d7]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-[#f2dbc2]/40 blur-3xl" />
      <section className="relative container mx-auto px-4">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#ddd2c2] bg-[linear-gradient(140deg,#fff8ec_0%,#f2ede3_62%,#ecf2ea_100%)] p-6 shadow-[0_35px_70px_-42px_rgba(57,69,60,0.72)] sm:p-10">
          <div className="mb-6 h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#4e6a58,#b98e66)]" />
          <p className="text-xs font-semibold tracking-[0.16em] text-[#607267]">SUPPORT POLICY</p>
          <h1 className="mt-3 font-serif text-4xl text-[#1f2b24] sm:text-5xl">Refund &amp; Cancellation Policy</h1>
          <p className="mt-3 text-sm text-[#506158]">
            We stand behind the quality of every plant and product we ship, while keeping the claim process fair, direct, and easy to follow.
          </p>

          <div className="mt-5 rounded-2xl border border-[#e9dece] bg-white/70 p-5 text-sm text-[#415149]">
            <p><strong>Business Name:</strong> Succulent Sphere</p>
            <p><strong>Business Address:</strong> Bhimtal, Nainital, Uttarakhand &ndash; 263136, India</p>
            <p><strong>Support Email:</strong> support@succulentsphere.com</p>
            <p><strong>Phone:</strong> +91-9458321209</p>
            <p><strong>Business Hours:</strong> Monday &ndash; Saturday, 9:00 AM &ndash; 6:00 PM IST</p>
            <p><strong>Last Updated:</strong> 15 April 2026</p>
          </div>

          <div className="mt-8 space-y-5 text-sm leading-relaxed text-[#43534a]">
            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">1. Our Return &amp; Refund Commitment</h2>
              <p className="mt-2">
                At Succulent Sphere, we stand behind the quality of every plant and product we ship. We accept returns
                and issue refunds or replacements only when a product is received in a defective, damaged, or incorrect
                condition, subject to the conditions outlined below.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">2. Return & Refund Eligibility</h2>
              <p className="mt-2">A return, refund, or replacement will be considered only if:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>The product was received in a defective or physically damaged condition.</li>
                <li>A wrong item was delivered that does not match your order.</li>
                <li>The claim is raised within 7 days of delivery.</li>
                <li>A valid, continuous unboxing video is submitted as required.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">3. How to Raise a Return / Refund Request</h2>
              <p className="mt-2">
                We provide a simple return and refund process through WhatsApp or email for quick resolution:
              </p>
              <ol className="mt-3 space-y-3 pl-5">
                <li>
                  Contact us on WhatsApp at <strong>+91-9458321209</strong> or email us at <strong>support@succulentsphere.com</strong> within 7 days of receiving your order.
                </li>
                <li>
                  Share your <strong>Order ID</strong>, a description of the issue, and your <strong>unboxing video</strong>.
                </li>
                <li>
                  Our team will review your claim and respond within <strong>1-2 business days</strong> with a
                  resolution, whether replacement or refund.
                </li>
              </ol>
              <p className="mt-3">Both channels are monitored by our support team, and we will guide you through the next steps directly.</p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">4. Mandatory Unboxing Video Requirement</h2>
              <p className="mt-2">
                A clear, continuous unboxing video is mandatory for all damage or incorrect item claims. The video must
                start from the sealed or unopened package and show the full unboxing process along with the product
                condition immediately after opening.
              </p>
              <p className="mt-3">
                Claims submitted without a valid unboxing video will not be eligible for a refund or replacement.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">5. Non-Returnable / Non-Refundable Cases</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Minor natural variation in plant size, leaf tone, or growth form, which is normal for live plants.</li>
                <li>Damage caused by incorrect care, overwatering, sunburn, or neglect after delivery.</li>
                <li>Claims raised after 7 days of delivery without prior notice or justification.</li>
                <li>Claims submitted without a valid unboxing video.</li>
                <li>Change-of-mind returns where the product was delivered correctly and in good condition.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">6. Order Cancellation</h2>
              <p className="mt-2">
                You may cancel your order before dispatch confirmation. To cancel, contact us on WhatsApp or via email
                as soon as possible with your Order ID.
              </p>
              <p className="mt-3">
                Once an order has been dispatched, it cannot be cancelled. If you wish to return it after delivery,
                standard return eligibility conditions in Sections 2-4 will apply.
              </p>
              <p className="mt-3">
                <strong>COD Orders:</strong> The &#8377;100 advance deposit paid for COD orders is non-refundable in case
                of cancellation after dispatch or refusal at delivery, unless the product is confirmed damaged or incorrect.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">7. Refund Processing</h2>
              <p className="mt-2">
                Approved refunds are processed to the original payment method used at checkout, including Razorpay or
                other supported payment modes. Refund settlement timelines depend on your bank or payment gateway and
                typically take 5-7 business days after approval.
              </p>
              <p className="mt-3">
                For COD orders, approved refunds are transferred via bank transfer or UPI after verification.
              </p>
            </section>

            <section className="rounded-2xl border border-[#e8dece] bg-white/70 p-5">
              <h2 className="font-semibold text-[#26372d]">8. Contact for Returns &amp; Refunds</h2>
              <p className="mt-2"><strong>WhatsApp:</strong> +91-9458321209</p>
              <p className="mt-2"><strong>Email:</strong> support@succulentsphere.com</p>
              <p className="mt-2">Returns and refunds can be initiated easily through either WhatsApp or email.</p>
              <p className="mt-2"><strong>Hours:</strong> Monday &ndash; Saturday, 9:00 AM &ndash; 6:00 PM IST</p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
