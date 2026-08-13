/**
 * Chatbot knowledge base — train the AI with your site's data.
 * Update this file to keep the assistant in sync with products, policies, and content.
 */

import { mockProducts } from "./mockProducts";

type ProductEntry = {
  name: string;
  handle: string;
  price: string;
  currency: string;
  badge?: string | null;
  rating?: number;
  url: string;
};

// ——— PRODUCTS (from mock data; live Firebase data is used when available) ———
export const PRODUCTS = mockProducts.map((p) => ({
  name: p.title,
  handle: p.handle,
  price: p.price,
  currency: p.currency,
  badge: p.badge || null,
  rating: p.rating,
  url: `/collections/succulents/${p.handle}`,
}));

/** Fetch live products from Firebase; fall back to PRODUCTS when unavailable. */
export async function getProductsForContext(): Promise<ProductEntry[]> {
  try {
    const { fetchProductsList } = await import("../lib/commerce");
    const list = await fetchProductsList(24);
    return list.map((node: any) => ({
      name: node.title || "Untitled",
      handle: node.handle || "",
      price: node.price || "0",
      currency: node.currency || "USD",
      badge: node.badge || null,
      rating: node.rating ?? 4.5,
      url: `/collections/succulents/${node.handle || ""}`,
    }));
  } catch {
    return PRODUCTS;
  }
}

// ——— PLANT INFO (per product or general) ———
export const PLANT_CARE = {
  general: {
    light: "Bright indirect light is best. Avoid direct hot sun.",
    watering: "Deep but infrequent — let soil dry between waterings. Usually every 2–4 weeks.",
    soil: "Well-draining mix. Use cactus/succulent soil. Avoid garden soil.",
    temperature: "Keep above 50°F. Avoid cold drafts and hot radiators.",
  },
  byPlant: {
    "Echeveria Harmony": "Needs bright light, minimal water. Leaves may change color with sunlight.",
    "Haworthia Zebra": "Tolerates lower light. Water every 2–3 weeks.",
    "Geometric Planter": "Decorative pot. Pair with any succulent. Has drainage.",
    "Luxury Succulent Set": "Curated mix. Includes care tips. Perfect for gifting.",
  },
  commonProblems: {
    overwatering: "Mushy leaves, blackened trunk. Let soil dry, repot with well-draining mix.",
    yellowLeaves: "Often water stress or low light. Adjust water and light.",
    rootRot: "Remove affected roots, repot in dry soil, reduce watering.",
  },
};

// ——— SHIPPING ———
export const SHIPPING = {
  time: "3–5 business days",
  note: "Shipping is calculated at checkout based on address.",
  packaging: "Plants are custom packaged with sustainable materials for safe arrival.",
};

// ——— CHECKOUT ———
export const CHECKOUT = {
  steps: "Add to cart → View cart → Proceed to checkout → Enter shipping & payment → Place order",
  payment: "Secure payment at checkout.",
  coupons: "You can enter coupon codes in the cart. Apply before checkout.",
  shippingCalc: "Shipping cost is calculated at checkout based on your location.",
};

// ——— ABOUT US ———
export const ABOUT = {
  tagline: "Cultivating beauty, inspiring tranquility.",
  story:
    "Founded by nature enthusiasts, Succulent Sphere began from a love for succulents and a desire to share their calming presence. We curate each plant for health and beauty.",
  philosophy: {
    natureFirst: "Inspiration from nature for harmonious, tranquil plant collections.",
    handpicked: "Each plant is hand-selected for health and form.",
    sustainable: "Eco-conscious packaging and sustainable practices.",
  },
};

// ——— CONTACT ———
export const CONTACT = {
  email: "support@succulentsphere.com",
  phone: "+91 94583 21209",
  whatsapp: "https://wa.me/919458321209?text=Hi%20Succulent%20Sphere,%20I%20need%20help%20regarding%20your%20plants.",
  contactPage: "/contact",
  aboutPage: "/about",
  cartPage: "/cart",
  collectionsPage: "/collections",
  plantCarePage: "/plant-care",
  social: {
    instagram: "https://www.instagram.com/succulentsphere/",
    facebook: "https://www.facebook.com/profile.php?id=61586867373040",
    threads: "https://www.threads.net/@succulentsphere",
  },
};

// ——— Build full knowledge string for the AI ———
export async function buildKnowledgeContextAsync(): Promise<string> {
  const products = await getProductsForContext();
  const productList = products.map(
    (p) => `- ${p.name}: $${p.price} ${p.currency} — ${p.url}${p.badge ? ` (${p.badge})` : ""}`
  ).join("\n");

  const plantCareByPlant = Object.entries(PLANT_CARE.byPlant)
    .map(([name, tip]) => `- ${name}: ${tip}`)
    .join("\n");

  const problems = Object.entries(PLANT_CARE.commonProblems)
    .map(([issue, fix]) => `- ${issue}: ${fix}`)
    .join("\n");

  return `
PRODUCTS (name, price, URL):
${productList}

PLANT CARE — General:
- Light: ${PLANT_CARE.general.light}
- Watering: ${PLANT_CARE.general.watering}
- Soil: ${PLANT_CARE.general.soil}
- Temperature: ${PLANT_CARE.general.temperature}

PLANT CARE — By plant:
${plantCareByPlant}

COMMON PROBLEMS:
${problems}

SHIPPING:
- Delivery: ${SHIPPING.time}
- Cost: Calculated at checkout based on address
- Packaging: ${SHIPPING.packaging}

CHECKOUT:
- Flow: ${CHECKOUT.steps}
- Payment: ${CHECKOUT.payment}
- Coupons: ${CHECKOUT.coupons}
- Shipping cost: ${CHECKOUT.shippingCalc}

ABOUT SUCCULENT SPHERE:
- Tagline: ${ABOUT.tagline}
- Story: ${ABOUT.story}
- Philosophy: Nature First, Handpicked Quality, Sustainable Practices

CONTACT:
- Email: ${CONTACT.email}
- Phone: ${CONTACT.phone}
- WhatsApp: ${CONTACT.whatsapp}
- Contact page: ${CONTACT.contactPage}
- About page: ${CONTACT.aboutPage}
- Cart: ${CONTACT.cartPage}
- Shop: ${CONTACT.collectionsPage}
- Plant care guide: ${CONTACT.plantCarePage}
`.trim();
}

/** Sync version using PRODUCTS (for import in modules that can't await) */
export function buildKnowledgeContext(): string {
  const productList = PRODUCTS.map(
    (p) => `- ${p.name}: $${p.price} ${p.currency} — ${p.url}${p.badge ? ` (${p.badge})` : ""}`
  ).join("\n");

  const plantCareByPlant = Object.entries(PLANT_CARE.byPlant)
    .map(([name, tip]) => `- ${name}: ${tip}`)
    .join("\n");

  const problems = Object.entries(PLANT_CARE.commonProblems)
    .map(([issue, fix]) => `- ${issue}: ${fix}`)
    .join("\n");

  return `
PRODUCTS (name, price, URL):
${productList}

PLANT CARE — General:
- Light: ${PLANT_CARE.general.light}
- Watering: ${PLANT_CARE.general.watering}
- Soil: ${PLANT_CARE.general.soil}
- Temperature: ${PLANT_CARE.general.temperature}

PLANT CARE — By plant:
${plantCareByPlant}

COMMON PROBLEMS:
${problems}

SHIPPING:
- Delivery: ${SHIPPING.time}
- Cost: Calculated at checkout based on address
- Packaging: ${SHIPPING.packaging}

CHECKOUT:
- Flow: ${CHECKOUT.steps}
- Payment: ${CHECKOUT.payment}
- Coupons: ${CHECKOUT.coupons}
- Shipping cost: ${CHECKOUT.shippingCalc}

ABOUT SUCCULENT SPHERE:
- Tagline: ${ABOUT.tagline}
- Story: ${ABOUT.story}
- Philosophy: Nature First, Handpicked Quality, Sustainable Practices

CONTACT:
- Email: ${CONTACT.email}
- Phone: ${CONTACT.phone}
- WhatsApp: ${CONTACT.whatsapp}
- Contact page: ${CONTACT.contactPage}
- About page: ${CONTACT.aboutPage}
- Cart: ${CONTACT.cartPage}
- Shop: ${CONTACT.collectionsPage}
- Plant care guide: ${CONTACT.plantCarePage}
`.trim();
}
