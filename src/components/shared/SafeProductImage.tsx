"use client";

import Image from "next/image";
import { useState } from "react";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";

const FALLBACK_SRC = "/assets/product-1.jpg";

type SafeProductImageProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
};

/**
 * Product image that degrades instead of rendering an empty box.
 *
 * A product whose `images[0]` points at a removed or mistyped host (which is
 * common once media moves between hosts) used to leave a blank frame on the
 * card: `next/image` fires `error` and nothing ever recovered. Every product
 * card, the product gallery hero and the best-seller tiles render through here,
 * so one bad URL now degrades to the bundled placeholder instead of a hole in
 * the layout.
 *
 * The retry swaps `src` to the local placeholder exactly once, so a broken URL
 * cannot cause a render loop.
 */
export default function SafeProductImage({
  src,
  alt,
  sizes,
  className,
  style,
  priority,
}: SafeProductImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = failed ? FALLBACK_SRC : normalizeImageUrl(src, FALLBACK_SRC);

  return (
    <Image
      src={resolved}
      alt={alt}
      fill
      style={style}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      placeholder="blur"
      blurDataURL={SHIMMER_BLUR_DATA_URL}
      unoptimized={shouldBypassImageOptimization(resolved)}
      className={className}
      onError={() => {
        // Only fall back once, and never "retry" the placeholder itself.
        if (!failed && resolved !== FALLBACK_SRC) setFailed(true);
      }}
    />
  );
}