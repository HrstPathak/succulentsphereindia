import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, ChevronRight, Facebook, Instagram, MessageCircle } from "lucide-react";
import TrustBar from "../../components/TrustBar";
import ContactFormClient from "../../components/contact/ContactFormClient";

export const metadata: Metadata = {
  title: "Contact Succulent Sphere",
  description:
    "Contact Succulent Sphere for plant care help, order support, and product guidance through WhatsApp, phone, or email.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {

  const whatsappLink =
    "https://wa.me/919458321209?text=Hi%20Succulent%20Sphere,%20I%20need%20help%20regarding%20your%20plants.";

  return (
    <main id="contact" className="min-h-screen bg-[var(--color-bg)]">
      <section className="container mx-auto px-4 py-8 md:py-15 pt-24 lg:py-16">

        {/* HERO WITH OVERLAY */}
        <div className="relative max-w-3xl mx-auto mb-8">

          <div className="rounded overflow-hidden shadow-sm">
            <div className="relative h-56 md:h-72 bg-[url('/images/Contact.png')] bg-center bg-cover opacity-50" />

            {/* Overlay Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-black/20">
              <h1 className="text-2xl md:text-4xl font-serif text-white mb-2">
                Get in Touch
              </h1>
              <p className="text-sm md:text-base text-white/90 max-w-md">
                We're here to help with any questions, comments, or support you need.
              </p>
            </div>
          </div>
        </div>

        {/* CONTACT OPTIONS */}
        <div className="max-w-3xl mx-auto space-y-3">

          {/* WhatsApp Chat */}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-ripple-card block bg-white rounded-lg p-4 shadow-sm flex items-start justify-between"
          >
            <div>
              <div className="text-base font-medium">Chat with Us</div>
              <div className="text-xs text-muted">
                Quick WhatsApp support
              </div>
            </div>
            <div className="text-muted"><ChevronRight size={16} strokeWidth={2} /></div>
          </a>

          {/* Email */}
          <a
            href="mailto:support@succulentsphere.com"
            className="contact-ripple-card block bg-white rounded-lg p-4 shadow-sm flex items-start justify-between"
          >
            <div>
              <div className="text-base font-medium">Email Us</div>
              <div className="text-xs text-muted">
                support@succulentsphere.com
              </div>
            </div>
            <div className="text-muted"><ChevronRight size={16} strokeWidth={2} /></div>
          </a>

          {/* Call */}
          <a
            href="tel:+919458321209"
            className="contact-ripple-card block bg-white rounded-lg p-4 shadow-sm flex items-start justify-between"
          >
            <div>
              <div className="text-base font-medium">Call Us</div>
              <div className="text-xs text-muted">
                +91 94583 21209
              </div>
            </div>
            <div className="text-muted"><ChevronRight size={16} strokeWidth={2} /></div>
          </a>

          {/* Address */}
          <div className="contact-ripple-card rounded-xl border border-[#e6ddcf] bg-[linear-gradient(135deg,#ffffff_0%,#f6f2ea_55%,#eef5ef_100%)] p-4 shadow-[0_16px_40px_rgba(40,55,45,0.12)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a7f73]">
              Our Address
            </div>
            <div className="mt-2 text-base font-semibold text-[var(--color-text)]">
              Succulent Sphere
            </div>
            <div className="mt-1 text-sm text-[var(--auth-muted)]">
              Bhimtal, Nainital
            </div>
            <div className="text-sm text-[var(--auth-muted)]">
              Uttarakhand 263136, India
            </div>
          </div>

        </div>

        {/* SEND MESSAGE BUTTON (WhatsApp) */}
        <div className="text-center mt-6">
          <a
            href={whatsappLink}
            target="_blank"
            className="inline-block bg-[var(--color-brand)] text-white px-6 py-3 rounded shadow-sm"
          >
            Send a Message
          </a>
        </div>

        {/* SOCIAL */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <a
            href="https://www.instagram.com/succulentsphere/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="p-2 rounded-full bg-white shadow hover:shadow-md transition"
          >
            <Instagram size={20} strokeWidth={1.8} className="text-[#577a66]" aria-hidden="true" />
          </a>

          <a
            href="https://www.facebook.com/profile.php?id=61586867373040"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="p-2 rounded-full bg-white shadow hover:shadow-md transition"
          >
            <Facebook size={20} strokeWidth={1.8} className="text-[#577a66]" aria-hidden="true" />
          </a>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="p-2 rounded-full bg-white shadow hover:shadow-md transition"
          >
            <MessageCircle size={20} strokeWidth={1.8} className="text-[#25D366]" aria-hidden="true" />
          </a>

          <a
            href="https://www.threads.net/@succulentsphere"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Threads"
            className="p-2 rounded-full bg-white shadow hover:shadow-md transition"
          >
            <AtSign size={20} strokeWidth={1.8} className="text-[#525252]" aria-hidden="true" />
          </a>
        </div>

        <TrustBar />

        {/* CONTACT FORM (client) */}
        <ContactFormClient />

      </section>
    </main>
  );
}
