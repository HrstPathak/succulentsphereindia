import type { ProductFaq } from "@/lib/product-faqs";

export type Product = {
  id: string;
  title: string;
  handle: string;
  price: string;
  currency: string;
  image: string;
  imageAlt?: string;
  badge?: string;
  rating?: number;
  reviewCount?: number;
  availability?: string;
  description?: string;
  compareAtPrice?: string | null;
  available?: boolean;
  quantity?: number;
  inventoryQuantity?: number;
  totalInventory?: number;
  type?: string;
  productType?: string;
  tags?: string[];
  collections?: string[];
  createdAt?: string;
  careLevel?: string;
  plantGenus?: string;
  potSize?: string;
  potMaterial?: string;
  faqs?: ProductFaq[];
  [key: string]: unknown;
};

export const mockProducts: Product[] = [
  {
    id: "mock-product-1",
    title: "Echeveria Harmony",
    handle: "echeveria-harmony",
    price: "18.00",
    compareAtPrice: "24.00",
    currency: "USD",
    image: "/assets/product-1.jpg",
    imageAlt: "Echeveria Harmony succulent",
    badge: "Best Seller",
    rating: 4.8,
    availability: "InStock",
    description:
      "A graceful rosette succulent with soft pastel tones. Echeveria Harmony thrives in bright light and minimal watering, making it perfect for beginners seeking effortless elegance."
  },
  {
    id: "mock-product-2",
    title: "Geometric Planter",
    handle: "geometric-planter",
    price: "24.00",
    compareAtPrice: "30.00",
    currency: "USD",
    image: "/assets/product-2.jpg",
    imageAlt: "Geometric planter",
    badge: "New",
    rating: 4.6,
    availability: "InStock",
    description:
      "A modern ceramic planter with clean geometric lines. Designed to elevate your succulents with a minimalist aesthetic while ensuring proper drainage and airflow."
  },
  {
    id: "mock-product-3",
    title: "Luxury Succulent Set",
    handle: "luxury-succulent-set",
    price: "42.00",
    currency: "USD",
    image: "/assets/product-3.jpg",
    imageAlt: "Luxury succulent set",
    badge: "Limited",
    rating: 4.9,
    availability: "InStock",
    description:
      "A curated trio of premium succulents paired with elegant pots. This limited-edition set brings refined greenery and serene charm to any living or workspace."
  },
  {
    id: "mock-product-4",
    title: "Haworthia Zebra",
    handle: "haworthia-zebra",
    price: "15.00",
    currency: "USD",
    image: "/assets/product-4.jpg",
    imageAlt: "Haworthia Zebra succulent",
    badge: "",
    rating: 4.5,
    availability: "InStock",
    description:
      "A striking low-maintenance succulent featuring bold white stripes. Haworthia Zebra thrives in low to moderate light and is ideal for compact indoor spaces."
  }
];
