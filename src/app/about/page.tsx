import type { Metadata } from "next";
import Link from "next/link";
import TrustBar from "../../components/TrustBar";
import { SITE_URL } from "@/lib/seo";
import { mediaAsset } from "@/lib/media";

export const metadata: Metadata = {
  title: "About Us | Succulent Sphere — Premium Succulent Plants Online India",
  description:
    "Succulent Sphere is an Indian online store for premium succulent plants and cacti — handpicked, safely packed, and shipped across India with care guides built for Indian homes.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Us | Succulent Sphere — Premium Succulent Plants Online India",
    description:
      "Succulent Sphere is an Indian online store for premium succulent plants and cacti — handpicked, safely packed, and shipped across India with care guides built for Indian homes.",
    url: `${SITE_URL}/about`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us | Succulent Sphere — Premium Succulent Plants Online India",
    description:
      "Succulent Sphere is an Indian online store for premium succulent plants and cacti — handpicked, safely packed, and shipped across India with care guides built for Indian homes.",
  },
};

export default function AboutPage() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Succulent Sphere",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    description:
      "Succulent Sphere is an Indian online store for premium succulent plants and cacti — handpicked, safely packed, and shipped across India with care guides built for Indian homes.",
  };

  const offerings = [
    {
      title: "Succulents & Cacti",
      description: "Rare varieties, collector picks, and beginner-friendly options.",
      href: "/collections",
    },
    {
      title: "Pots & Planters",
      description: "Modern, minimal designs made for clean indoor styling.",
      href: "/collections/pots",
    },
    {
      title: "Gifting Collections",
      description: "Curated plant sets designed for thoughtful gifting.",
      href: "/collections/beginner-friendly",
    },
    {
      title: "Pan-India Delivery",
      description: "Shipped securely with Delhivery in 6-8 business days.",
      href: "/shipping-returns",
    },
  ];

  const contactItems = [
    {
      label: "Email",
      value: "support@succulentsphere.com",
      href: "mailto:support@succulentsphere.com",
    },
    {
      label: "WhatsApp",
      value: "+91-9458321209",
      href: "https://wa.me/919458321209",
    },
    {
      label: "Address",
      value: "Bhimtal, Nainital, 263136 Uttarakhand, India",
    },
    {
      label: "Hours",
      value: "Monday - Saturday, 10:00 AM - 11:00 PM IST",
    },
  ];

  return (
    <main className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      <section className="relative">
        <div className="relative h-56 md:h-96 lg:h-[420px] overflow-hidden">
          <div className="absolute inset-0 bg-[url('/images/brand-lifestyle.png')] bg-center bg-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/80" />

          <div className="container mx-auto px-4 relative h-full flex items-center">
            <div className="max-w-3xl mx-auto text-center text-neutral-800">
              <span className="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-4 py-1 text-xs font-medium uppercase tracking-[0.24em] text-neutral-700 shadow-sm backdrop-blur-sm">
                Rooted in Bhimtal, Nainital
              </span>
              <h2 className="mt-5 font-serif text-3xl md:text-5xl lg:text-6xl mb-3">About Us</h2>
              <h1 className="text-sm md:text-base text-muted max-w-2xl mx-auto">
                Premium succulents, modern planters, and plant gifting collections curated with care for homes across India.
              </h1>
            </div>
          </div>

          <div className="md:hidden absolute left-4 right-4 -bottom-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-md">
              <p className="text-sm text-center">Healthy plants, thoughtful packaging, and pan-India delivery from the hills of Bhimtal.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="rounded-[28px] border border-black/5 bg-white px-6 py-8 shadow-[0_18px_60px_rgba(37,48,41,0.08)] md:px-10 md:py-10">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Our Story</p>
            <h2 className="mt-3 font-serif text-3xl text-neutral-900 md:text-4xl">
              Built from a love for healthy plants and calmer living spaces
            </h2>
            <div className="mt-6 space-y-4 text-base leading-7 text-muted">
              <p>
                Succulent Sphere was born in the scenic hills of Bhimtal, Uttarakhand - a region that inspires a deep connection with nature. What began as a personal love for succulents grew into a mission: to make premium, healthy succulents and thoughtfully designed planters accessible to plant lovers across India.
              </p>
              <p>
                We curate every plant with care - selecting for health, form, and the potential to thrive in Indian homes. Whether you&apos;re a first-time plant parent or a seasoned collector, we ship plants that are ready to grow and built to last.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[24px] bg-[#DDE7D8] p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-600">Based In</p>
              <p className="mt-3 font-serif text-2xl text-neutral-900">Bhimtal, Nainital</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700">
                263136 Uttarakhand
              </p>
            </div>
            <div className="rounded-[24px] bg-[#F4E7D6] p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-600">Delivery Promise</p>
              <p className="mt-3 font-serif text-2xl text-neutral-900">Packed To Travel Well</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700">
                Protective layering, careful handling, and shipping support designed for pan-India delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-12">
        <div className="mx-auto max-w-6xl rounded-[32px] bg-[#21352B] px-6 py-8 text-white md:px-10 md:py-10">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/70">What We Offer</p>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl">
              Curated greenery and planters for every kind of plant lover
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/75 md:text-base">
              Our catalog includes rare and popular succulents, cacti, trailing plants, and modern planters - all available for pan-India delivery. Every order is carefully packed with protective layering and shipped via Delhivery to reach you in the best condition possible.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {offerings.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[24px] border border-white/10 bg-white/[0.08] p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.12]"
              >
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">{item.description}</p>
                <span className="mt-4 inline-flex text-sm font-medium text-white/90 transition-transform duration-200 group-hover:translate-x-1">
                  Explore &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-center font-serif text-2xl mb-8">Our Process</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div
              className="relative h-40 bg-cover bg-center"
              style={{
                backgroundImage:
                  `linear-gradient(180deg, rgba(18,28,24,0.08) 0%, rgba(18,28,24,0.18) 100%), url('${mediaAsset("sites/images/6898d28609-Carefully_sourced.webp")}')`,
              }}
            />
            <div className="p-6">
              <h3 className="font-semibold mb-2">Carefully Sourced</h3>
              <p className="text-sm text-muted">We source the healthiest succulents from trusted growers to ensure strong, resilient plants.</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div
              className="relative h-40 bg-cover bg-center"
              style={{
                backgroundImage:
                  `linear-gradient(180deg, rgba(18,28,24,0.08) 0%, rgba(18,28,24,0.18) 100%), url('${mediaAsset("sites/images/6bb6171e40-Custom_Packed.webp")}')`,
              }}
            />
            <div className="p-6">
              <h3 className="font-semibold mb-2">Custom Packaged</h3>
              <p className="text-sm text-muted">Plants are packaged thoughtfully with sustainable materials to arrive safe and sound.</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div
              className="relative h-40 bg-cover bg-center"
              style={{
                backgroundImage:
                  `linear-gradient(180deg, rgba(18,28,24,0.08) 0%, rgba(18,28,24,0.18) 100%), url('${mediaAsset("sites/images/e815a6e461-Delived_Fresh.webp")}')`,
              }}
            />
            <div className="p-6">
              <h3 className="font-semibold mb-2">Delivered Fresh</h3>
              <p className="text-sm text-muted">Each plant is prepared for shipping to ensure freshness upon arrival.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-bg)] py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-center font-serif text-2xl mb-8">Customer Love</h2>
          <div className="hide-scrollbar flex gap-6 overflow-x-auto pb-2 snap-x snap-mandatory md:overflow-visible md:justify-center md:snap-none">
            <blockquote className="bg-white p-6 rounded-lg shadow-sm min-w-[85%] sm:min-w-[60%] md:min-w-[320px] md:max-w-[360px] snap-start">
              "Absolutely love the succulents — perfect condition and fast shipping."
              <cite className="block mt-3 text-sm text-muted">— Ravi Tripathi</cite>
            </blockquote>
            <blockquote className="bg-white p-6 rounded-lg shadow-sm min-w-[85%] sm:min-w-[60%] md:min-w-[320px] md:max-w-[360px] snap-start">
              "Such a wonderful experience! The plants are healthy and the care tips were so helpful."
              <cite className="block mt-3 text-sm text-muted">— Mahalakshmi P.</cite>
            </blockquote>
            <blockquote className="bg-white p-6 rounded-lg shadow-sm min-w-[85%] sm:min-w-[60%] md:min-w-[320px] md:max-w-[360px] snap-start">
              "Exceptional quality and service — my plants brighten up my whole home."
              <cite className="block mt-3 text-sm text-muted">— Sakshi Maind</cite>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-bg)] py-12">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="font-serif text-2xl mb-4">Our Commitment</h2>
          <p className="text-muted text-base leading-7">
            We source responsibly, pack sustainably, and ship pan-India with care. Whether you are buying your first succulent or growing a serious collection, Succulent Sphere is built to make that easy - and to make your space genuinely better for it.{" "}
            <Link href="/collections" className="underline hover:no-underline">
              Browse our collections &rarr;
            </Link>
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="mx-auto grid max-w-6xl gap-8 rounded-[30px] border border-black/5 bg-white px-6 py-8 shadow-[0_20px_70px_rgba(37,48,41,0.08)] md:px-10 md:py-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Get in Touch</p>
            <h2 className="mt-3 font-serif text-3xl text-neutral-900 md:text-4xl">
              We love hearing from fellow plant lovers
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Whether you have a question about an order, need plant care advice, or just want to talk succulents, we&apos;re here.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {contactItems.map((item) => (
              <div key={item.label} className="rounded-[22px] bg-[var(--color-bg)] p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">{item.label}</p>
                {item.href ? (
                  <a href={item.href} className="mt-3 block text-base font-medium text-neutral-900 hover:underline">
                    {item.value}
                  </a>
                ) : (
                  <p className="mt-3 text-base font-medium leading-7 text-neutral-900">{item.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <TrustBar />
    </main>
  );
}
