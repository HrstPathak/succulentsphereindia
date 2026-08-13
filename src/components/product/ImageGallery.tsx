"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";

export default function ImageGallery({
  images,
  altPrefix,
  imageAlts = [],
}: {
  images: string[];
  altPrefix: string;
  imageAlts?: string[];
}) {
  const normalizedImages = images.map((image) => normalizeImageUrl(image));
  const [index, setIndex] = useState(0);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const swipeDeltaRef = useRef(0);
  const imageSignature = normalizedImages.join("|");

  useEffect(() => {
    setIndex(0);
  }, [imageSignature]);

  useEffect(() => {
    setMainImageLoaded(false);
  }, [imageSignature, index]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (normalizedImages.length <= 1) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeDeltaRef.current = 0;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (normalizedImages.length <= 1) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStartRef.current.x;
    const dy = touch.clientY - swipeStartRef.current.y;

    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      swipeDeltaRef.current = dx;
    }
  };

  const handleTouchEnd = () => {
    if (normalizedImages.length <= 1) return;
    const swipeDistance = swipeDeltaRef.current;
    const threshold = 40;

    if (Math.abs(swipeDistance) >= threshold) {
      if (swipeDistance < 0) {
        setIndex((i) => (i + 1) % images.length);
      } else if (swipeDistance > 0) {
        setIndex((i) => (i - 1 + images.length) % images.length);
      }
    }

    swipeDeltaRef.current = 0;
  };

  return (
    <div className="w-full">
      <div
        className="relative overflow-hidden rounded-[28px] border border-black/5 bg-[linear-gradient(135deg,#faf7f1,#f1ece3)] shadow-[0_18px_50px_rgba(30,44,33,0.08)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#08131c,#0d1822)]"
        ref={containerRef}
        style={{ paddingTop: "100%", touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          aria-hidden="true"
          className={`product-image-skeleton absolute inset-0 transition-opacity duration-300 ${
            mainImageLoaded ? "opacity-0" : "opacity-100"
          }`}
        />
        <div className={`absolute inset-0 transition-opacity duration-500 ${mainImageLoaded ? "opacity-100" : "opacity-0"}`}>
          <Image
            src={normalizedImages[index] || "/assets/product-1.jpg"}
            alt={imageAlts[index] || `${altPrefix} ${index + 1} indoor succulent`}
            fill
            style={{ objectFit: "cover", transformOrigin: "center" }}
            sizes="(max-width: 640px) 100vw, 50vw"
            priority={index === 0}
            placeholder="blur"
            blurDataURL={SHIMMER_BLUR_DATA_URL}
            unoptimized={shouldBypassImageOptimization(normalizedImages[index])}
            onLoad={() => {
              setMainImageLoaded(true);
            }}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/12 via-black/0 to-transparent" />
        {normalizedImages.length > 1 ? (
          <>
            <button
              aria-label="Previous image"
              onClick={() => setIndex((i) => (i - 1 + normalizedImages.length) % normalizedImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/85 p-2.5 text-[#2f4538] shadow-[0_10px_24px_rgba(18,28,20,0.18)] backdrop-blur"
            >
              &#8249;
            </button>
            <button
              aria-label="Next image"
              onClick={() => setIndex((i) => (i + 1) % normalizedImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/85 p-2.5 text-[#2f4538] shadow-[0_10px_24px_rgba(18,28,20,0.18)] backdrop-blur"
            >
              &#8250;
            </button>
          </>
        ) : null}
      </div>

      <div className="mt-3 flex gap-3 overflow-x-auto pb-1 pr-2 snap-x snap-mandatory hide-scrollbar">
        {normalizedImages.map((img, i) => (
          <button
            key={img + i}
            onClick={() => setIndex(i)}
            aria-label={`Show image ${i + 1}`}
            className={`relative h-20 w-20 flex-shrink-0 snap-start overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,#faf7f1,#f0e7d9)] shadow-[0_8px_18px_rgba(30,44,33,0.08)] transition-all duration-200 ${
              i === index ? "ring-2 ring-[var(--color-brand)]" : "border-black/5 hover:-translate-y-0.5"
            }`}
          >
            <Image
              src={img}
              alt={imageAlts[i] || `${altPrefix} thumb ${i + 1}`}
              fill
              style={{ objectFit: "cover" }}
              sizes="80px"
              loading="lazy"
              placeholder="blur"
              blurDataURL={SHIMMER_BLUR_DATA_URL}
              unoptimized={shouldBypassImageOptimization(img)}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
