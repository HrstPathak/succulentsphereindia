"use client";

import { useEffect } from "react";
import ImageGallery from "./ImageGallery";
import ProductInfo from "./ProductInfo";
import ProductTabs from "./ProductTabs";
import TrustBar from "../TrustBar";
import { useGtmViewItem } from "@/hooks/useGtmViewItem";
import { rememberRecentlyViewedProduct } from "@/lib/recentlyViewed";

type Props = {
  product: any;
};

function getProductImages(product: any): string[] {
  if (Array.isArray(product?.images)) {
    const images = product.images.filter((img: unknown): img is string => typeof img === "string" && img.length > 0);
    if (images.length > 0) return images;
  }

  if (typeof product?.image === "string" && product.image.length > 0) {
    return [product.image];
  }

  return ["/assets/product-1.jpg"];
}

function getProductImageAlts(product: any): string[] {
  if (Array.isArray(product?.imageAlts)) {
    return product.imageAlts
      .map((alt: unknown) => String(alt || "").trim())
      .filter((alt: string) => Boolean(alt));
  }
  return [];
}

function sanitizeHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getDefaultCareTips(): string {
  return [
    "Light: Bright indirect sunlight (4-6 hours ideal).",
    "Watering: Water only when soil is completely dry.",
    "Temperature: 18-32C.",
    "Soil: Use a well-draining cactus/succulent mix.",
    "Avoid overwatering and frequent touching of leaf coating."
  ].join("\n");
}

function getDefaultShippingInfo(): string {
  return [
    "Delivered in: 5-7 Days (1-2 Days to Dispatch)",
    "Plant Size: 3-4 Inch",
    "Delivered Bare Rooted",
  ].join("\n");
}

function getShippingInfo(product: any): string {
  const descriptionText = typeof product?.description === "string" ? product.description : "";
  const descriptionHtml = typeof product?.descriptionHtml === "string" ? product.descriptionHtml : "";
  const source = descriptionText.trim() || htmlToPlainText(descriptionHtml);
  if (!source) return getDefaultShippingInfo();

  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return getDefaultShippingInfo();
  const normalizePotLine = (value: string) => value.replace(/\bwith\s+pot\b/gi, "Without Pot");

  const shippingHeadingIndex = lines.findIndex((line) => /^(shipping|shipping details|delivery|delivery details)\s*:?\s*$/i.test(line));
  if (shippingHeadingIndex < 0) {
    const inlineShippingMatch = normalized.match(/shipping\s*:\s*([^\n]+(?:\n(?!\s*(care|description|watering|light|size|refund|return)).+)*)/i);
    if (!inlineShippingMatch?.[1]) return getDefaultShippingInfo();
    const inlineLines = inlineShippingMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return inlineLines.length > 0 ? inlineLines.map(normalizePotLine).join("\n") : getDefaultShippingInfo();
  }

  const stopPatterns = [
    /^(care|care guide|care tips)\s*:?\s*$/i,
    /^(description)\s*:?\s*$/i,
    /^(watering|light|size|refund|return|returns)\s*:?\s*$/i,
  ];

  const shippingLines: string[] = [];
  for (let i = shippingHeadingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (stopPatterns.some((pattern) => pattern.test(line))) break;
    shippingLines.push(normalizePotLine(line.replace(/^[-*\u2022]\s*/, "").trim()));
  }

  if (shippingLines.length === 0) return getDefaultShippingInfo();
  return shippingLines.join("\n");
}

function getCareTips(product: any): string {
  const descriptionText = typeof product?.description === "string" ? product.description : "";
  const descriptionHtml = typeof product?.descriptionHtml === "string" ? product.descriptionHtml : "";
  const source = descriptionText.trim() || htmlToPlainText(descriptionHtml);
  if (!source) return getDefaultCareTips();

  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const headingIndex = lines.findIndex((line) => /care\s*guide/i.test(line));
  if (headingIndex < 0) return getDefaultCareTips();

  const careLines = lines
    .slice(headingIndex + 1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (careLines.length === 0) return getDefaultCareTips();
  return careLines.join("\n");
}

function getTabDescription(product: any): string {
  const descriptionHtml = typeof product?.descriptionHtml === "string" ? product.descriptionHtml.trim() : "";
  if (descriptionHtml) return sanitizeHtml(descriptionHtml);

  const description = typeof product?.description === "string" ? product.description.trim() : "";
  if (!description) return "<p>No description available.</p>";

  return `<p>${escapeHtml(description)}</p>`;
}

export default function UnifiedProductDetail({ product }: Props) {
  useGtmViewItem({
    id: product?.id,
    title: product?.title,
    price: product?.price,
    category: product?.category || product?.type || product?.productType || "",
    handle: product?.handle,
  });

  const images = getProductImages(product);
  const imageAlts = getProductImageAlts(product);
  const description = getTabDescription(product);
  const careTips = getCareTips(product);
  const shippingInfo = getShippingInfo(product);

  useEffect(() => {
    rememberRecentlyViewedProduct({
      id: String(product?.id || product?.handle || ""),
      handle: String(product?.handle || ""),
      title: String(product?.title || ""),
      image: String(product?.image || images[0] || "/assets/product-1.jpg"),
      price: String(product?.price || "0"),
      compareAtPrice: product?.compareAtPrice ?? null,
      currency: String(product?.currency || "INR"),
    });
  }, [
    images,
    product?.currency,
    product?.handle,
    product?.id,
    product?.image,
    product?.price,
    product?.compareAtPrice,
    product?.title,
  ]);

  return (
    <div className="p-0 md:rounded-3xl md:border md:border-white/40 md:bg-white/75 md:backdrop-blur-sm md:shadow-[0_10px_40px_rgba(15,23,42,0.08)] md:p-7 md:dark:border-[color:rgba(143,191,148,0.25)] md:dark:bg-[#0c1d27]/85">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="p-0 md:rounded-2xl md:border md:border-gray-100 md:bg-white md:p-3 md:shadow-sm md:dark:border-[color:rgba(143,191,148,0.25)] md:dark:bg-[#0a1721]">
          <ImageGallery images={images} altPrefix={product.title} imageAlts={imageAlts} />
        </div>
        <div className="p-0 md:rounded-2xl md:border md:border-gray-100 md:bg-white md:p-6 md:shadow-sm md:dark:border-[color:rgba(143,191,148,0.25)] md:dark:bg-[#0a1721]">
          <ProductInfo
            product={product}
            tabsSlot={
              <ProductTabs
                care={careTips}
                description={description}
                shipping={shippingInfo}
              />
            }
          />
          <div className="mt-4 border-t border-gray-100 pt-2 md:dark:border-[color:rgba(143,191,148,0.18)]">
            <TrustBar embedded />
          </div>
        </div>
      </div>
    </div>
  );
}

