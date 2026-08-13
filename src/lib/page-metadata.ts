import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

export type PageSeoEntry = {
  title: string;
  description: string;
};

export const PAGE_SEO = {
  home: {
    title: "Buy Succulent Plants Online India | From ₹39",
    description:
      "Shop 140+ succulent, cactus plants and Planters online in India. Low-maintenance indoor plants — handpicked, safely packed & delivered pan-India.",
  },
  about: {
    title: "About Us | Grown in Bhimtal, Shipped Across India",
    description:
      "We handpick succulents from Bhimtal, Uttarakhand & ship to 19,000+ pin codes across India. Meet the people growing your plants.",
  },
  account: {
    title: "My Account | Succulent Sphere",
    description:
      "Manage your orders, saved addresses, wishlist, and account details — all in one place.",
  },
  accountOrders: {
    title: "My Orders | Succulent Sphere",
    description:
      "View all your past orders, payment totals, and delivery status from your Succulent Sphere account.",
  },
  accountOrderDetails: {
    title: "Order Details | Succulent Sphere",
    description:
      "View your order items, shipping address, payment summary, and live delivery status.",
  },
  cart: {
    title: "Your Cart | Succulent Sphere",
    description:
      "Review your selected plants before checkout. Free care guide included with every order.",
  },
  checkout: {
    title: "Secure Checkout | Succulent Sphere",
    description:
      "Complete your order securely. UPI, cards & COD accepted. Plants packed fresh & dispatched within 24 hours.",
  },
  collections: {
    title: "Succulent & Cactus Collections | Succulent Sphere India",
    description:
      "Browse all plant collections — succulents, cacti, beginner picks & gift sets. Handpicked indoor plants, pan-India delivery. Find your perfect plant.",
  },
  contact: {
    title: "Contact Us | Succulent Sphere — We Reply Within 24 Hours",
    description:
      "Questions about your order or plant care? Chat on WhatsApp, call or email us. We typically reply within a few hours.",
  },
  forgotPassword: {
    title: "Forgot Password | Succulent Sphere",
    description:
      "Reset your Succulent Sphere account password. Enter your email and we'll send a secure reset link instantly.",
  },
  login: {
    title: "Login to Your Account | Succulent Sphere",
    description:
      "Sign in to track your orders, manage your wishlist, and check out faster on Succulent Sphere.",
  },
  orderPlaced: {
    title: "Order Confirmed! | Succulent Sphere",
    description:
      "Your order is confirmed and being prepared. You'll receive a shipping update soon. Thank you for choosing Succulent Sphere!",
  },
  orderTracker: {
    title: "Track Your Plant Order | Live Updates | Succulent Sphere",
    description:
      "Track your Succulent Sphere order in real time. Enter your order ID or AWB number for live shipment updates — from dispatch to doorstep.",
  },
  plantCare: {
    title: "Succulent Care Guide for Indian Homes | Succulent Sphere",
    description:
      "Expert succulent care tips for India — watering schedules, monsoon survival, soil mixes & sunlight advice. Written for Indian climates & homes.",
  },
  privacyPolicy: {
    title: "Privacy Policy | Succulent Sphere",
    description:
      "How Succulent Sphere collects, stores, and protects your data. Compliant with Indian data protection laws.",
  },
  refundPolicy: {
    title: "Refund & Return Policy | Succulent Sphere",
    description:
      "Damaged plant? We'll make it right. Read our refund & return policy — unboxing video requirements, timelines & eligibility.",
  },
  resetPassword: {
    title: "Reset Password | Succulent Sphere",
    description:
      "Set a new password for your Succulent Sphere account using the secure link sent to your email.",
  },
  shippingReturns: {
    title: "Shipping & Delivery Policy | Pan-India | Succulent Sphere",
    description:
      "We ship succulents pan-India via trusted couriers. Delivery in 5–7 days. Check pin code serviceability, tracking info & delivery FAQs.",
  },
  shop: {
    title: "Buy Indoor & Succulent Plants Online India | From ₹39",
    description:
      "Shop 60+ succulent & cactus plants online in India. Low-maintenance indoor plants, rare varieties & gift sets — pan-India delivery from ₹39.",
  },
  signup: {
    title: "Create Your Account | Succulent Sphere",
    description:
      "Sign up for faster checkout, order tracking, exclusive plant drops & personalised recommendations from Succulent Sphere.",
  },
  termsAndConditions: {
    title: "Terms & Conditions | Succulent Sphere",
    description:
      "Read Succulent Sphere's terms — covering orders, payments, IP rights, liability & governing Indian law.",
  },
  wishlist: {
    title: "My Wishlist | Succulent Sphere",
    description:
      "Your saved plants, ready to order. Review your wishlist and add your favourites to cart whenever you're ready.",
  },
  collectionSucculents: {
    title: "Buy Succulent Plants Online India | Succulent Sphere",
    description:
      "Shop premium indoor succulents online — Echeveria, Haworthia, String of Pearls & more. Low-maintenance, beginner-friendly, pan-India delivery.",
  },
  collectionCactus: {
    title: "Buy Cactus Plants Online India | Succulent Sphere",
    description:
      "Shop hardy cactus plants online in India — Mammillaria, Rebutia & more. Low-maintenance small desk plants, pan-India delivery from ₹89.",
  },
  collectionBeginnerFriendly: {
    title: "Beginner Indoor Plants Online India | Succulent Sphere",
    description:
      "New to plants? Shop succulents & cacti that are hard to kill — low maintenance, ideal for Indian homes, low light & busy lifestyles. From ₹49.",
  },
} satisfies Record<string, PageSeoEntry>;

export function buildPageMetadata(opts: {
  /** Key from `PAGE_SEO` */
  pageKey: keyof typeof PAGE_SEO;
  /** Path like `/about` (used for canonical + OG url) */
  pathname: `/${string}` | "/";
  /** Optional overrides (per-page unique SEO copy if needed) */
  override?: Partial<PageSeoEntry> & {
    titleTemplate?: (title: string) => string;
  };
}): Metadata {
  const base = PAGE_SEO[opts.pageKey];
  const title = opts.override?.title ?? base.title;
  const description = opts.override?.description ?? base.description;
  const titleFinal = opts.override?.titleTemplate ? opts.override.titleTemplate(title) : title;

  return {
    title: titleFinal,
    description,
    alternates: { canonical: `${SITE_URL}${opts.pathname}` },
    openGraph: {
      title: titleFinal,
      description,
      url: `${SITE_URL}${opts.pathname}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: titleFinal,
      description,
    },
  };
}

export const COLLECTION_PAGE_SEO: Record<string, { name: string; description: string }> = {
  succulents: {
    name: "Succulent Plants",
    description: "Handpicked premium succulents to enrich your home and workspace.",
  },
  "air-plants": {
    name: "Air Plants",
    description: "Low-maintenance air plants that purify your environment.",
  },
  "air-purifier": {
    name: "Air Purifier",
    description: "Air-purifying plants curated for healthier interiors.",
  },
  cacti: {
    name: "Cacti Collection",
    description: "Unique desert cacti with stunning shapes and colors.",
  },
  pots: {
    name: "Pots Collection",
    description: "Elegant pots for premium plant styling.",
  },
  "gift-collection": {
    name: "Gift Collection",
    description: "Ready-to-gift plant combos and curated green hampers.",
  },
  "rare-plants": {
    name: "Rare & Exotic",
    description: "Exclusive rare plants for collectors and enthusiasts.",
  },
};
