import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/account/*",
          "/cart",
          "/checkout",
          "/wishlist",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/order-placed",
          "/api/*",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
