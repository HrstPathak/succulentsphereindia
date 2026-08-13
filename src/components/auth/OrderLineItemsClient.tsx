"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import OrderProductReviewBox from "@/components/reviews/OrderProductReviewBox";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";

type OrderLineItem = {
  id: string;
  title: string;
  quantity: number;
  productHandle: string;
  image: string;
  imageAlt?: string;
  customAttributes?: { key: string; value: string }[];
  originalTotalPrice?: { amount: string; currencyCode: string };
  discountedTotalPrice?: { amount: string; currencyCode: string };
  price: { amount: string; currencyCode: string };
};

type Props = {
  lineItems: OrderLineItem[];
  orderNumber: string;
  canReview: boolean;
  showReviews?: boolean;
};

type BundleGroup = {
  id: string;
  title: string;
  header: OrderLineItem | null;
  items: OrderLineItem[];
};

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currencyCode} ${amount}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
}

function getAttrMap(item: OrderLineItem) {
  const map: Record<string, string> = {};
  (item.customAttributes || []).forEach((attr) => {
    if (attr.key) map[attr.key] = attr.value;
  });
  return map;
}

export default function OrderLineItemsClient({
  lineItems,
  orderNumber,
  canReview,
  showReviews = true,
}: Props) {
  const [openBundles, setOpenBundles] = useState<Record<string, boolean>>({});

  const { bundles, standalone } = useMemo(() => {
    const bundleMap = new Map<string, BundleGroup>();
    const standaloneItems: OrderLineItem[] = [];

    lineItems.forEach((item) => {
      const attrs = getAttrMap(item);
      const bundleId = attrs.bundle_id;
      const bundleRole = attrs.bundle_role;
      if (!bundleId || !bundleRole) {
        const title = String(item.title || "").toLowerCase();
        if (bundleId && !bundleRole && title.includes("custom combo")) {
          if (!bundleMap.has(bundleId)) {
            bundleMap.set(bundleId, {
              id: bundleId,
              title: attrs.bundle_title || "Custom Combo",
              header: item,
              items: [],
            });
          } else {
            bundleMap.get(bundleId)!.header = item;
          }
          return;
        }
        standaloneItems.push(item);
        return;
      }

      if (!bundleMap.has(bundleId)) {
        bundleMap.set(bundleId, {
          id: bundleId,
          title: attrs.bundle_title || "Custom Combo",
          header: null,
          items: [],
        });
      }

      const group = bundleMap.get(bundleId)!;
      if (bundleRole === "header") {
        group.header = item;
      } else if (bundleRole === "item") {
        group.items.push(item);
      } else {
        standaloneItems.push(item);
      }
    });

    let bundles = Array.from(bundleMap.values());
    let standalone = standaloneItems;

    if (bundles.length === 0) {
      const header = lineItems.find((item) =>
        String(item.title || "")
          .toLowerCase()
          .includes("custom combo")
      );
      if (header) {
        bundles = [
          {
            id: `fallback-${header.id}`,
            title: header.title || "Custom Combo",
            header,
            items: lineItems.filter((item) => item.id !== header.id),
          },
        ];
        standalone = [];
      }
    }

    return { bundles, standalone };
  }, [lineItems]);

  return (
    <div className="mt-4 space-y-3">
      {bundles.map((bundle) => {
        const discountedTotal = bundle.items.reduce((sum, item) => {
          const amount = Number(item.discountedTotalPrice?.amount || item.price?.amount || 0);
          return sum + amount;
        }, 0);
        const originalTotal = bundle.items.reduce((sum, item) => {
          const amount = Number(item.originalTotalPrice?.amount || item.price?.amount || 0);
          return sum + amount;
        }, 0);
        const currency = bundle.items[0]?.discountedTotalPrice?.currencyCode || "INR";
        const collage = bundle.items.slice(0, 4).map((item) => ({
          src: normalizeImageUrl(item.image, "/images/succulent-collection.webp"),
          alt: item.imageAlt || item.title,
        }));
        const isOpen = openBundles[bundle.id] ?? false;

        return (
          <div key={bundle.id} className="overflow-hidden rounded-xl border border-[#e3d9ca] bg-white/85">
            <div className="flex gap-3 p-3 sm:p-4">
              <div className="h-20 w-20 flex-shrink-0">
                <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1">
                  {collage.map((img, idx) => (
                    <div key={`${bundle.id}-img-${idx}`} className="relative overflow-hidden rounded">
                      <Image src={img.src} alt={img.alt} fill sizes="80px" className="object-cover" unoptimized={shouldBypassImageOptimization(img.src)} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#24372d]">{bundle.title}</p>
                    <p className="text-xs text-[#5f6a60]">Qty: {bundle.items.length || 4} Plants</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#7b8a80] line-through">
                      {formatPrice(originalTotal.toFixed(2), currency)}
                    </p>
                    <p className="text-sm font-semibold text-[#2f4438]">
                      {formatPrice(discountedTotal.toFixed(2), currency)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setOpenBundles((prev) => ({ ...prev, [bundle.id]: !isOpen }))}
                    className="rounded-lg border border-[#d2c6b6] bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#31463a] hover:bg-white"
                  >
                    {isOpen ? "Hide products" : "View products"}
                  </button>
                </div>
              </div>
            </div>

            {isOpen ? (
              <div className="border-t border-emerald-300/70 bg-white/70 p-3 sm:p-4 space-y-3">
                {bundle.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#e3d9ca] bg-white/80 p-3">
                    <div className="flex flex-row-reverse items-start gap-3">
                      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-[#ddd2c1] bg-[#f3ebdf]">
                        <Image
                          src={normalizeImageUrl(item.image, "/images/succulent-collection.webp")}
                          alt={item.imageAlt || item.title}
                          fill
                          sizes="96px"
                          className="object-cover"
                          unoptimized={shouldBypassImageOptimization(item.image)}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-[#24372d]">{item.title}</p>
                        <p className="mt-1 text-xs text-[#5f6a60]">Qty: {item.quantity}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          {item.originalTotalPrice?.amount ? (
                            <span className="text-[#7b8a80] line-through">
                              {formatPrice(item.originalTotalPrice.amount, item.originalTotalPrice.currencyCode || item.price.currencyCode)}
                            </span>
                          ) : null}
                          <span className="font-semibold text-[#2f4438]">
                            {formatPrice(
                              item.discountedTotalPrice?.amount || item.price.amount,
                              item.discountedTotalPrice?.currencyCode || item.price.currencyCode
                            )}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-[#6b766a]">
                          {formatPrice(item.price.amount, item.price.currencyCode)} x {item.quantity} Qty
                        </div>
                        {item.productHandle ? (
                          <>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Link
                                href={`/products/${item.productHandle}`}
                                className="inline-flex rounded-lg border border-[#d2c6b6] bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-[#31463a] hover:bg-white"
                              >
                                View product
                              </Link>
                              {showReviews ? (
                                <OrderProductReviewBox
                                  productHandle={item.productHandle}
                                  productTitle={item.title}
                                  orderNumber={orderNumber}
                                  canReview={canReview}
                                  inline
                                  hideNotice
                                />
                              ) : null}
                            </div>
                            {!canReview && showReviews ? (
                              <div className="mt-1 text-[11px] text-[#6b766a] whitespace-nowrap">
                                Review is available after this order is delivered.
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {standalone.map((item) => (
        <div key={item.id} className="rounded-xl border border-[#e3d9ca] bg-white/80 p-3">
          <div className="flex flex-row-reverse items-start gap-3">
            <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-lg border border-[#ddd2c1] bg-[#f3ebdf]">
              <Image
                src={normalizeImageUrl(item.image, "/images/succulent-collection.webp")}
                alt={item.imageAlt || item.title}
                fill
                sizes="112px"
                className="object-cover"
                unoptimized={shouldBypassImageOptimization(item.image)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-[#24372d]">{item.title}</p>
              <p className="mt-1 text-xs text-[#5f6a60]">Qty: {item.quantity}</p>
              <p className="mt-1 text-xs font-semibold text-[#2f4438]">
                {formatPrice(
                  item.discountedTotalPrice?.amount || item.price.amount,
                  item.discountedTotalPrice?.currencyCode || item.price.currencyCode
                )}
              </p>
              <p className="mt-1 text-[11px] text-[#6b766a]">
                {formatPrice(item.price.amount, item.price.currencyCode)} x {item.quantity} Qty
              </p>
              {item.productHandle ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/products/${item.productHandle}`}
                      className="inline-flex rounded-lg border border-[#d2c6b6] bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-[#31463a] hover:bg-white"
                    >
                      View product
                    </Link>
                    {showReviews ? (
                      <OrderProductReviewBox
                        productHandle={item.productHandle}
                        productTitle={item.title}
                        orderNumber={orderNumber}
                        canReview={canReview}
                        inline
                        hideNotice
                      />
                    ) : null}
                  </div>
                  {!canReview && showReviews ? (
                    <div className="mt-1 text-[11px] text-[#6b766a] whitespace-nowrap">
                      Review is available after this order is delivered.
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
