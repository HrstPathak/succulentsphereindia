import type { ProductFaq } from "@/lib/product-faqs";
import { getReviewStats, type ProductReview } from "@/lib/reviews";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";

type ProductLike = {
  id?: string;
  title?: string;
  handle?: string;
  image?: string;
  images?: unknown;
  description?: string;
  descriptionHtml?: string;
  seoDescription?: string;
  price?: string | number;
  currency?: string;
  available?: boolean;
  availableForSale?: boolean;
  availability?: string;
  reviews?: ProductReview[];
  faqs?: ProductFaq[];
};

const IN_STOCK_URL = "https://schema.org/InStock";
const OUT_OF_STOCK_URL = "https://schema.org/OutOfStock";
const NEW_CONDITION_URL = "https://schema.org/NewCondition";
const MERCHANT_RETURN_FINITE_WINDOW_URL = "https://schema.org/MerchantReturnFiniteReturnWindow";
const RETURN_BY_MAIL_URL = "https://schema.org/ReturnByMail";
const FREE_RETURN_URL = "https://schema.org/FreeReturn";
const FULL_REFUND_URL = "https://schema.org/FullRefund";
const FULFILLMENT_DELIVERY_URL = "https://schema.org/FulfillmentTypeDelivery";
const WHATSAPP_RETURNS_MESSAGE = "Customers can also initiate returns via WhatsApp at +91-9458321209";

export const ORGANIZATION_ID = absoluteUrl("/#organization");
export const MERCHANT_RETURN_POLICY_ID = absoluteUrl("/refund-policy#merchant-return-policy");
export const SHIPPING_SERVICE_ID = absoluteUrl("/shipping-returns#standard-shipping");

function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, " ")
    .replace(/<li[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(value: unknown): string {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return absoluteUrl(url);
  return absoluteUrl(`/${url.replace(/^\/+/, "")}`);
}

function normalizePrice(value: unknown): string {
  const raw = String(value ?? "").trim();
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return numeric.toFixed(2);
  }
  return "0.00";
}

function parsePriceNumber(value: unknown): number {
  const raw = String(value ?? "").replace(/[^0-9.-]/g, "").trim();
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getCanonicalUrl(pathOrUrl: string): string {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : absoluteUrl(pathOrUrl);
}

function getImageList(product: ProductLike): string[] {
  const images = Array.isArray(product.images)
    ? product.images.map((image) => toAbsoluteUrl(image)).filter(Boolean)
    : [];

  if (images.length > 0) return images;

  const primaryImage = toAbsoluteUrl(product.image);
  if (primaryImage) return [primaryImage];

  return [absoluteUrl("/assets/product-1.jpg")];
}

function isInStock(product: ProductLike): boolean {
  if (typeof product.available === "boolean") return product.available;
  if (typeof product.availableForSale === "boolean") return product.availableForSale;

  const availability = String(product.availability || "").trim().toLowerCase();
  if (!availability) return true;
  return !["outofstock", "soldout", OUT_OF_STOCK_URL.toLowerCase()].includes(availability);
}

function getValidReviews(product: ProductLike): ProductReview[] {
  if (!Array.isArray(product.reviews)) return [];

  return product.reviews.filter((review) => {
    const rating = Number(review?.rating || 0);
    return Boolean(cleanText(review?.authorName) && cleanText(review?.content) && Number.isFinite(rating) && rating >= 1);
  });
}

function getValidFaqs(faqs: unknown): ProductFaq[] {
  if (!Array.isArray(faqs)) return [];

  return faqs
    .map((faq) => {
      if (!faq || typeof faq !== "object") return null;

      const question = cleanText((faq as { question?: unknown }).question);
      const answer = cleanText((faq as { answer?: unknown }).answer);

      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((faq): faq is ProductFaq => Boolean(faq))
    .slice(0, 5);
}

function getWorstRating(reviews: ProductReview[]): number | undefined {
  if (reviews.length === 0) return undefined;
  return reviews.reduce((lowestRating, review) => Math.min(lowestRating, Number(review.rating)), 5);
}

function toStructuredReviews(reviews: ProductReview[], worstRating?: number) {
  return reviews.slice(0, 3).map((review) => {
    const structuredReview: Record<string, unknown> = {
      "@type": "Review",
      author: {
        "@type": "Person",
        name: cleanText(review.authorName) || "Customer",
      },
      reviewBody: cleanText(review.content),
      reviewRating: {
        "@type": "Rating",
        ratingValue: Number(review.rating),
        bestRating: 5,
        worstRating,
      },
    };

    const reviewTitle = cleanText(review.title);
    if (reviewTitle) {
      structuredReview.name = reviewTitle;
    }

    const publishedAt = Date.parse(review.createdAt || "");
    if (!Number.isNaN(publishedAt)) {
      structuredReview.datePublished = new Date(publishedAt).toISOString().split("T")[0];
    }

    return structuredReview;
  });
}

function getPriceValidUntil(): string {
  return new Date(Date.UTC(new Date().getFullYear(), 11, 31)).toISOString().split("T")[0];
}

function getShippingRate(price: number): number | undefined {
  if (price < 599) return 70;
  return 0;
}

function buildOfferShippingDetails(price: number) {
  const shippingRate = getShippingRate(price);
  return {
    "@type": "OfferShippingDetails",
    hasShippingService: {
      "@id": SHIPPING_SERVICE_ID,
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "IN",
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: 2,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 5,
        maxValue: 6,
        unitCode: "DAY",
      },
    },
    shippingRate: {
      "@type": "MonetaryAmount",
      value: shippingRate,
      currency: "INR",
    },
  };
}

export function buildListingOfferStructuredData(product: Pick<ProductLike, "price" | "currency" | "available" | "availableForSale" | "availability">) {
  const numericPrice = parsePriceNumber(product.price);

  return {
    "@type": "Offer",
    price: normalizePrice(product.price),
    priceCurrency: cleanText(product.currency) || "INR",
    availability: isInStock(product) ? IN_STOCK_URL : OUT_OF_STOCK_URL,
    shippingDetails: buildOfferShippingDetails(numericPrice),
  };
}

function buildMerchantReturnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    "@id": MERCHANT_RETURN_POLICY_ID,
    applicableCountry: "IN",
    returnPolicyCountry: "IN",
    returnPolicyCategory: MERCHANT_RETURN_FINITE_WINDOW_URL,
    merchantReturnDays: 7,
    returnMethod: RETURN_BY_MAIL_URL,
    returnFees: FREE_RETURN_URL,
    refundType: FULL_REFUND_URL,
    merchantReturnLink: absoluteUrl("/refund-policy"),
    additionalProperty: {
      "@type": "PropertyValue",
      name: "WhatsApp Returns",
      value: WHATSAPP_RETURNS_MESSAGE,
    },
  };
}

export function buildOrganizationStructuredData() {
  const storeOfferShippingDetails = buildOfferShippingDetails(599);

  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/og-image.jpg"),
    sameAs: [
      "https://www.instagram.com/succulentsphere/",
      "https://www.facebook.com/profile.php?id=61586867373040",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@succulentsphere.com",
      telephone: "+91-9458321209",
      areaServed: "IN",
      availableLanguage: ["en", "hi"],
    },
    offers: {
      "@type": "Offer",
      shippingDetails: storeOfferShippingDetails,
    },
    hasMerchantReturnPolicy: buildMerchantReturnPolicy(),
    hasShippingService: {
      "@type": "ShippingService",
      "@id": SHIPPING_SERVICE_ID,
      name: "Standard shipping across India",
      description:
        "Orders below INR 199 are not serviceable. Orders from INR 199 to INR 598 ship for INR 70. Orders from INR 599 and above ship free. Orders are dispatched in 1-2 business days and typically delivered in 5-6 business days across India.",
      fulfillmentType: FULFILLMENT_DELIVERY_URL,
      handlingTime: {
        "@type": "ServicePeriod",
        duration: {
          "@type": "QuantitativeValue",
          minValue: 1,
          maxValue: 2,
          unitCode: "DAY",
        },
      },
      shippingConditions: [
        {
          "@type": "ShippingConditions",
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "IN",
          },
          orderValue: {
            "@type": "MonetaryAmount",
            currency: "INR",
            maxValue: 198,
          },
          doesNotShip: true,
        },
        {
          "@type": "ShippingConditions",
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "IN",
          },
          orderValue: {
            "@type": "MonetaryAmount",
            currency: "INR",
            minValue: 199,
            maxValue: 598,
          },
          shippingRate: {
            "@type": "MonetaryAmount",
            value: 70,
            currency: "INR",
          },
          transitTime: {
            "@type": "ServicePeriod",
            duration: {
              "@type": "QuantitativeValue",
              minValue: 5,
              maxValue: 6,
              unitCode: "DAY",
            },
          },
        },
        {
          "@type": "ShippingConditions",
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "IN",
          },
          orderValue: {
            "@type": "MonetaryAmount",
            currency: "INR",
            minValue: 599,
          },
          shippingRate: {
            "@type": "MonetaryAmount",
            value: 0,
            currency: "INR",
          },
          transitTime: {
            "@type": "ServicePeriod",
            duration: {
              "@type": "QuantitativeValue",
              minValue: 5,
              maxValue: 6,
              unitCode: "DAY",
            },
          },
        },
      ],
    },
  };
}

export function buildProductStructuredData(product: ProductLike, canonicalPathOrUrl: string) {
  const canonicalUrl = getCanonicalUrl(canonicalPathOrUrl);
  const name = cleanText(product.title) || "Untitled product";
  const description =
    cleanText(product.seoDescription) || cleanText(product.description) || cleanText(product.descriptionHtml) || `Buy ${name} online from ${SITE_NAME}.`;
  const numericPrice = parsePriceNumber(product.price);
  const reviews = getValidReviews(product);
  const reviewStats = getReviewStats(reviews);
  const worstRating = getWorstRating(reviews);
  const structuredReviews = toStructuredReviews(reviews, worstRating);
  const shippingDetails = buildOfferShippingDetails(numericPrice);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name,
    url: canonicalUrl,
    image: getImageList(product),
    description,
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      "@id": `${canonicalUrl}#offer`,
      url: canonicalUrl,
      price: normalizePrice(product.price),
      priceCurrency: cleanText(product.currency) || "INR",
      priceValidUntil: getPriceValidUntil(),
      availability: isInStock(product) ? IN_STOCK_URL : OUT_OF_STOCK_URL,
      itemCondition: NEW_CONDITION_URL,
      seller: {
        "@id": ORGANIZATION_ID,
      },
      shippingDetails,
      hasMerchantReturnPolicy: buildMerchantReturnPolicy(),
    },
    ...(structuredReviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewStats.averageRating,
            reviewCount: reviewStats.reviewCount,
            bestRating: 5,
            worstRating,
          },
          review: structuredReviews,
        }
      : {}),
  };
}

export function buildProductFaqStructuredData(product: Pick<ProductLike, "faqs">, canonicalPathOrUrl: string) {
  const canonicalUrl = getCanonicalUrl(canonicalPathOrUrl);
  const faqs = getValidFaqs(product.faqs);

  if (faqs.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${canonicalUrl}#faq`,
    url: canonicalUrl,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function toJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
