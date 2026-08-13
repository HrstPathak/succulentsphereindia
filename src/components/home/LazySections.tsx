"use client";

import dynamic from "next/dynamic";
import LazyClientSection from "../ui/LazyClientSection";

const LazyRecentlyViewed = dynamic(() => import("../shop/RecentlyViewedProducts"), { ssr: false });
const LazyOnTheFeed = dynamic(() => import("./OnTheFeed"), { ssr: false });

export function LazyRecentlyViewedSection() {
  return (
    <LazyClientSection minHeight={220}>
      <LazyRecentlyViewed />
    </LazyClientSection>
  );
}

export function LazyOnTheFeedSection() {
  return (
    <LazyClientSection minHeight={520}>
      <LazyOnTheFeed />
    </LazyClientSection>
  );
}
