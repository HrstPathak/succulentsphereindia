import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | Succulent Sphere",
  description: "Shipping and delivery policy for Succulent Sphere orders across India, including coverage, shipping charges, timelines, COD, tracking, and support details.",
  alternates: {
    canonical: "/shipping-returns",
  },
};

export default function ShippingReturnsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f8f3e9_0%,#f1ece2_45%,#ebe7df_100%)] pb-16 pt-20">
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#dbe8d7]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-[#f2dbc2]/40 blur-3xl" />
      <section className="relative container mx-auto px-4">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[#ddd2c2] bg-[linear-gradient(135deg,#fff7ea_0%,#f6f1e8_55%,#ecf3ea_100%)] shadow-[0_35px_70px_-42px_rgba(59,72,60,0.65)]">
          <header className="border-b border-[#e6dccd] px-6 py-8 sm:px-10">
            <div className="mb-6 h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#4e6a58,#b98e66)]" />
            <p className="text-xs font-semibold tracking-[0.16em] text-[#59695f]">SUPPORT POLICIES</p>
            <h1 className="mt-3 font-serif text-4xl text-[#1f2b24] sm:text-5xl">Shipping &amp; Delivery Policy</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#4a5b52] sm:text-base">
              Every order is packed with premium protective layering and dispatched with care so live plants and fragile planters reach you safely across India.
            </p>
          </header>

          <div className="space-y-6 px-6 py-8 sm:px-10">
            <article className="rounded-2xl border border-[#e2d8c8] bg-white/70 p-5 shadow-sm text-sm text-[#495a51]">
              <p><strong>Business Name:</strong> Succulent Sphere</p>
              <p><strong>Business Address:</strong> Bhimtal, Nainital, Uttarakhand &ndash; 263136, India</p>
              <p><strong>Support Email:</strong> support@succulentsphere.com</p>
              <p><strong>Phone:</strong> +91-9458321209</p>
              <p><strong>Business Hours:</strong> Monday &ndash; Saturday, 10AM to 11PM IST</p>
              <p><strong>Last Updated:</strong> 15 April 2026</p>
            </article>

            <article className="rounded-2xl border border-[#e2d8c8] bg-white/70 p-5 shadow-sm">
              <h2 className="font-semibold text-[#25352c]">1. Shipping Coverage &amp; Courier Partner</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#495a51]">
                Succulent Sphere ships to all serviceable PIN codes across India. All orders are fulfilled through
                <strong> Delhivery</strong>, a trusted national courier network. Orders are packed with premium protective
                layering to ensure safe transit for live plants and fragile planters.
              </p>
            </article>

            <article className="rounded-2xl border border-[#e2d8c8] bg-white/70 p-5 shadow-sm">
              <h2 className="font-semibold text-[#25352c]">2. Shipping Charges</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-[#eadfce]">
                <table className="w-full text-left text-sm text-[#495a51]">
                  <thead className="bg-[#f7f1e8] text-[#25352c]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Order Value</th>
                      <th className="px-4 py-3 font-semibold">Shipping Charge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eadfce] bg-white/80">
                    <tr>
                      <td className="px-4 py-3">Below &#8377;199</td>
                      <td className="px-4 py-3">Not eligible for shipping (minimum order &#8377;199)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">&#8377;199 &ndash; &#8377;598</td>
                      <td className="px-4 py-3">&#8377;70 flat rate</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">&#8377;599 and above</td>
                      <td className="px-4 py-3">FREE shipping</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#495a51]">
                Minimum order value required to place an order is <strong>&#8377;199</strong>.
              </p>
            </article>

            <article className="rounded-2xl border border-[#e2d8c8] bg-white/70 p-5 shadow-sm">
              <h2 className="font-semibold text-[#25352c]">3. Delivery Timeline</h2>
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#495a51]">
                <p><strong>Order Processing / Dispatch:</strong> 1-2 business days after order confirmation</p>
                <p><strong>Transit Time:</strong> 5-6 business days after dispatch</p>
                <p><strong>Estimated Total Delivery Time:</strong> 6-8 business days from order date</p>
                <p>
                  Business days are Monday through Saturday. Sundays and public holidays are excluded. Delivery timelines
                  may vary for remote or semi-urban PIN codes.
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e2d8c8] bg-white/70 p-5 shadow-sm">
              <h2 className="font-semibold text-[#25352c]">4. Order Tracking</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#495a51]">
                After dispatch, a tracking ID will be shared via SMS, email, or WhatsApp, where available. You can
                track your order directly on the Delhivery website or through the Order Tracker page on our website.
              </p>
            </article>

            <article className="rounded-2xl border border-[#e2d8c8] bg-white/70 p-5 shadow-sm">
              <h2 className="font-semibold text-[#25352c]">5. Cash on Delivery (COD)</h2>
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#495a51]">
                <p>An additional <strong>&#8377;50 COD handling fee</strong> applies to all COD orders.</p>
                <p>A mandatory advance deposit of <strong>&#8377;100</strong> is required at the time of placing the order to confirm it.</p>
                <p>The remaining amount is collected by the delivery partner at the time of delivery.</p>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e2d8c8] bg-white/70 p-5 shadow-sm">
              <h2 className="font-semibold text-[#25352c]">6. Delivery Attempts &amp; Failed Deliveries</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#495a51]">
                The courier partner will attempt delivery to the address provided. If delivery fails due to an incorrect
                address, unavailability, or unreachable contact number, re-shipping charges will apply and will be the
                customer&apos;s responsibility.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#495a51]">
                Please ensure your shipping address and phone number are accurate at the time of placing the order.
              </p>
            </article>

            <article className="rounded-2xl border border-[#d9dcca] bg-[linear-gradient(135deg,#eef6ec_0%,#f8f3e7_100%)] p-5">
              <h2 className="font-semibold text-[#25352c]">7. Force Majeure</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#495a51]">
                Delivery timelines may be affected by events beyond our control such as natural disasters, transport
                disruptions, strikes, government restrictions, or extreme weather conditions. We will make reasonable
                efforts to keep customers informed during such situations.
              </p>
            </article>

            <article className="rounded-2xl border border-[#e2d8c8] bg-white/70 p-5 shadow-sm">
              <h2 className="font-semibold text-[#25352c]">8. Contact for Shipping Support</h2>
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#495a51]">
                <p><strong>Email:</strong> support@succulentsphere.com</p>
                <p><strong>WhatsApp:</strong> +91-9458321209</p>
                <p><strong>Hours:</strong> Monday &ndash; Saturday, 10AM to 11PM IST</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
