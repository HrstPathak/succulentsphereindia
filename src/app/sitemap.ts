import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { fetchAllProductsList, fetchPlantCareArticles } from "@/lib/commerce";

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.95 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.9 },
  { path: "/combo", changeFrequency: "weekly", priority: 0.88 },
  { path: "/combo-builder", changeFrequency: "weekly", priority: 0.86 },
  { path: "/collections/succulents", changeFrequency: "daily", priority: 0.9 },
  { path: "/collections/beginner-friendly", changeFrequency: "weekly", priority: 0.85 },
  { path: "/collections/cacti", changeFrequency: "weekly", priority: 0.8 },
  { path: "/plant-care", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/policies", changeFrequency: "yearly", priority: 0.5 },
  { path: "/shipping-returns", changeFrequency: "yearly", priority: 0.5 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.5 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms-and-conditions", changeFrequency: "yearly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await fetchAllProductsList({ sortKey: "BEST_SELLING", reverse: false });
    productEntries = products
      .filter((product: any) => typeof product?.handle === "string" && product.handle.trim().length > 0)
      .map((product: any) => ({
        url: absoluteUrl(`/products/${product.handle}`),
        lastModified: product?.createdAt ? new Date(product.createdAt) : now,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }));
  } catch {
    productEntries = [];
  }

  let articleEntries: MetadataRoute.Sitemap = [];
  try {
    const articles = await fetchPlantCareArticles(200);
    articleEntries = articles
      .filter((article) => article.handle)
      .map((article) => ({
        url: absoluteUrl(`/plant-care/${article.handle}`),
        lastModified: article.publishedAt ? new Date(article.publishedAt) : now,
        changeFrequency: "monthly" as const,
        priority: 0.65,
      }));
  } catch {
    articleEntries = [];
  }

  return [...staticEntries, ...productEntries, ...articleEntries];
}
