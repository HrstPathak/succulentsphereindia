import "../styles/globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import Providers from "../components/Providers";
import DeferredChatbot from "../components/chatbot/DeferredChatbot";
import BackToTopButton from "../components/ui/BackToTopButton";
import DeferredMarketingScripts from "../components/analytics/DeferredMarketingScripts";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { buildOrganizationStructuredData, toJsonLd } from "@/lib/structured-data";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", variable: "--font-serif" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: {
  icon: "/favicon.png",
},
  other: {
    "facebook-domain-verification": "3x3b3xmy0o23ht4gqic2nnxooqa080",
  },
  title: {
    default: `${SITE_NAME} | Premium Succulents & Planters in India`,
    template: "%s",
  },
  description:
    "Buy premium succulents and elegant planters online in India. Handpicked plants, gifting collections, and beginner-friendly options from Succulent Sphere.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    images: ["/og-image.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F3EF",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  const facebookPixelId =
    process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID?.trim() || process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim();
  const gaMeasurementId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || process.env.NEXT_PUBLIC_GA_ID?.trim();
  const organizationJsonLd = buildOrganizationStructuredData();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable}`}>
        <DeferredMarketingScripts gtmId={gtmId} facebookPixelId={facebookPixelId} />

        {gaMeasurementId ? (
          <>
            <Script
              id="ga-script"
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaMeasurementId}', {
  page_path: window.location.pathname + window.location.search,
});`}
            </Script>
          </>
        ) : null}

        <Script id="ss-theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const stored = localStorage.getItem("ss_theme");
              const useDark = stored === "dark";
              document.documentElement.classList.toggle("dark", useDark);
            } catch {}
          })();`}
        </Script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(organizationJsonLd) }} />
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
          <BackToTopButton />
          <DeferredChatbot />
        </Providers>
      </body>
    </html>
  );
}
